"""Production inference for the exported assignee-ranking model. INTEGRATION.md explains how to use it.

This module is deliberately SELF-CONTAINED: it imports nothing from `oa2`/`oa3`, only numpy at import time and
sentence-transformers when a model is loaded. The AI service can copy this single file next to the exported model.

The text builders below must produce exactly the strings the model saw in training (`oa2/data.py`:
`_clean`, `_load_issue_base`, `member_profile_text`). `tests/test_parity.py` enforces that byte for byte; if you change
one here you must retrain the model (DESIGN.md §3).

    ranker = AssigneeRanker.load("artifacts/<run_id>/model")
    member_vecs = ranker.embed_members(members)            # once per profile change; store the vectors
    top = ranker.rank(task, member_vecs, [m.member_id for m in members], k=10)
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import numpy as np

CONFIG_FILE = "inference_config.json"
FORMAT_VERSION = 1

_WS = re.compile(r"\s+")


# ---------------------------------------------------------------- inputs

@dataclass(frozen=True)
class TaskInput:
    """A task as the product stores it. `project_key` is the short project key (e.g. "MESOS")."""
    project_key: str
    issue_type: str                  # Jira type, e.g. "Bug", "Story", "Task", "Improvement"
    title: str
    description: str = ""
    components: Sequence[str] = ()   # component names; empty -> "none"


@dataclass(frozen=True)
class MemberProfile:
    """A team member. Field values should come from the vocabularies listed in INTEGRATION.md §4."""
    member_id: int | str
    level: str                       # Junior | Mid-level | Senior | Staff | Principal
    area: str                        # e.g. Backend, Frontend, DevOps, ... (9 areas)
    years_experience: int
    role: str                        # job title, e.g. "Senior Developer"
    role_class: str                  # ic | lead | qa | writer | architect


@dataclass(frozen=True)
class RankedMember:
    member_id: int | str
    score: float                     # cosine similarity in [-1, 1]; only meaningful for ORDERING, not a probability


# ---------------------------------------------------------------- text builders (must match training)

def clean_text(value, max_chars: int | None = None) -> str:
    """Strip, remove up to 3 wrapping double quotes, collapse whitespace, cut to `max_chars` (oa2.data._clean)."""
    s = "" if value is None else str(value)
    s = s.strip()
    lead = len(s) - len(s.lstrip('"'))
    trail = len(s) - len(s.rstrip('"'))
    k = min(lead, trail, 3)
    if k and len(s) > 2 * k:
        s = s[k:len(s) - k]
    s = _WS.sub(" ", s).strip()
    if max_chars and len(s) > max_chars:
        s = s[:max_chars]
    return s


def task_text(task: TaskInput, max_text_chars: int = 8000) -> str:
    """Canonical task text: `[Project: KEY] [Type: T] [Components: a, b]\\n<title>\\n<description>`."""
    comps = ", ".join(sorted({c for c in (clean_text(x) for x in task.components) if c})) or "none"
    text = (f"[Project: {task.project_key}] [Type: {clean_text(task.issue_type)}] [Components: {comps}]\n"
            f"{clean_text(task.title)}\n{clean_text(task.description, max_text_chars)}")
    return text.rstrip()


def profile_text(member: MemberProfile) -> str:
    years = int(member.years_experience)  # "7", never "7.0": training used the integer column
    return (f"Level: {member.level}. Area: {member.area}. Years of experience: {years}. "
            f"Role: {member.role} ({member.role_class}).")


# ---------------------------------------------------------------- ranker

class AssigneeRanker:
    """Embeds tasks and member profiles with the fine-tuned bi-encoder and ranks members by cosine similarity."""

    def __init__(self, model, config: dict):
        self.model = model
        self.config = config
        self.query_prefix: str = config["query_prefix"]
        self.doc_prefix: str = config.get("doc_prefix", "")
        self.max_text_chars: int = int(config["max_text_chars"])
        model.max_seq_length = int(config["max_seq_len"])

    @classmethod
    def load(cls, path: str | Path, device: str | None = None, dtype: str | None = None) -> "AssigneeRanker":
        """Load an exported model folder. `dtype` defaults to the exported dtype on GPU and float32 on CPU
        (bf16 matmuls are slow on most CPUs)."""
        import torch
        from sentence_transformers import SentenceTransformer

        path = Path(path)
        config = json.loads((path / CONFIG_FILE).read_text(encoding="utf-8"))
        if config.get("format_version") != FORMAT_VERSION:
            raise ValueError(f"{path / CONFIG_FILE}: format_version {config.get('format_version')!r}, "
                             f"this loader expects {FORMAT_VERSION}")
        device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        name = dtype or (config["dtype"] if str(device).startswith("cuda") else "float32")
        model = SentenceTransformer(str(path), device=device, model_kwargs={"torch_dtype": getattr(torch, name)})
        return cls(model, config)

    # -- embeddings: L2-normalised float32, so a dot product IS the cosine similarity

    def _encode(self, texts: list[str], batch_size: int) -> np.ndarray:
        vecs = self.model.encode(texts, batch_size=batch_size, normalize_embeddings=True,
                                 convert_to_numpy=True, show_progress_bar=False)
        return np.asarray(vecs, dtype=np.float32)

    def embed_task_texts(self, texts: Sequence[str], batch_size: int = 32) -> np.ndarray:
        """Already-built task texts (see `task_text`). The query prefix is added here."""
        return self._encode([self.query_prefix + t for t in texts], batch_size)

    def embed_tasks(self, tasks: Sequence[TaskInput], batch_size: int = 32) -> np.ndarray:
        return self.embed_task_texts([task_text(t, self.max_text_chars) for t in tasks], batch_size)

    def embed_profile_texts(self, texts: Sequence[str], batch_size: int = 32) -> np.ndarray:
        return self._encode([self.doc_prefix + t for t in texts], batch_size)

    def embed_members(self, members: Sequence[MemberProfile], batch_size: int = 32) -> np.ndarray:
        return self.embed_profile_texts([profile_text(m) for m in members], batch_size)

    # -- ranking

    @staticmethod
    def scores(task_vecs: np.ndarray, member_vecs: np.ndarray) -> np.ndarray:
        """[T, D] x [M, D] -> [T, M] cosine similarities."""
        return np.atleast_2d(task_vecs) @ np.asarray(member_vecs).T

    def rank(self, task: TaskInput, member_vecs: np.ndarray, member_ids: Sequence, k: int | None = 10,
             task_vec: np.ndarray | None = None) -> list[RankedMember]:
        """Members sorted by suitability (best first). `member_vecs[i]` must belong to `member_ids[i]`.
        Pass `task_vec` to reuse an embedding computed earlier (e.g. stored with the task)."""
        if len(member_ids) != len(member_vecs):
            raise ValueError(f"{len(member_ids)} member ids but {len(member_vecs)} member vectors")
        if task_vec is None:
            task_vec = self.embed_tasks([task])[0]
        s = self.scores(task_vec, member_vecs)[0]
        order = np.argsort(-s, kind="stable")[:k]
        return [RankedMember(member_ids[i], float(s[i])) for i in order]
