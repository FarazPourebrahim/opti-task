"""Model construction, training and evaluation: OA2's bi-encoder recipe (`oa2/recipes/assignment.py`,
`_run_bi_encoder`) ported so that the trained model is RETURNED instead of erased. DESIGN.md §5 explains every step.

The recipe itself is unchanged: same LoRA config, loss, negatives, masking, optimiser, schedule and seed order, so a
run with OA2's data budget reproduces OA2's model (up to GPU floating-point noise).
"""
from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F


class BiEncoder:
    """The SentenceTransformer under training plus the helpers to embed and score texts with it."""

    def __init__(self, cfg: dict, snapshot_path: str, precision: str):
        from oa2.models import (STEncoder, apply_lora, enable_gradient_checkpointing, get_device, load_st,
                                st_backbone, st_set_backbone, weight_dtype)
        t = cfg["training"]
        self.cfg = cfg
        self.precision = precision
        self.device = get_device()
        self.query_prefix = cfg["prompt"]["query_prefix_resolved"]
        self.doc_prefix = cfg["prompt"]["doc_prefix"]
        self.eval_batch = int(t["eval_batch"])
        st = load_st(snapshot_path, {})
        backbone = st_backbone(st)
        self.gradient_checkpointing = bool(t["gradient_checkpointing"]) and enable_gradient_checkpointing(backbone)
        st.to(weight_dtype(precision, True))           # frozen base weights in the half type (fp32 on CPU)
        st_set_backbone(st, apply_lora(backbone, t["lora"]))
        st.to(self.device)
        self.st = st
        self.enc = STEncoder(st, int(t["max_seq_len"]))
        self._members = None

    def embed(self, texts) -> torch.Tensor:
        from oa2.models import to_device
        return F.normalize(self.enc(to_device(self.enc.tokenize(texts), self.device)).float(), dim=-1)

    def refresh_members(self, profiles: list[str]) -> None:
        """Member vectors are computed once per evaluation, exactly as in production."""
        from oa2.models import autocast
        with torch.no_grad(), autocast(self.precision):
            self._members = torch.cat([self.embed([self.doc_prefix + p for p in profiles[i:i + self.eval_batch]])
                                       for i in range(0, len(profiles), self.eval_batch)])

    def score_tasks(self, texts) -> np.ndarray:
        """[T, M] cosine scores of task texts against the current member vectors."""
        from oa2.models import autocast
        out = []
        with torch.no_grad(), autocast(self.precision):
            for i in range(0, len(texts), self.eval_batch):
                q = self.embed([self.query_prefix + x for x in texts[i:i + self.eval_batch]])
                out.append((q @ self._members.T).float().cpu().numpy())
        return np.concatenate(out, 0) if out else np.zeros((0, len(self._members)))


def training_tuples(data) -> tuple[list, dict]:
    """(task, positive, negatives) tuples: one per relevant member of each training task (DESIGN.md §5.2)."""
    examples, relevant = [], {}
    for row in data.train_examples.itertuples(index=False):
        pos = [int(u) for u in row.positives]
        relevant[row.Issue_ID] = set(pos)
        base_negs = [int(u) for u in list(row.hard_negs) + list(row.random_negs)]
        for j, p in enumerate(pos):
            negs = base_negs + ([int(row.overq_user)] if j == 0 and row.overq_user >= 0 else [])
            examples.append((row.Issue_ID, p, negs))
    return examples, relevant


def train(model: BiEncoder, data, work_dir: Path) -> dict:
    """Fine-tune with MultipleNegativesRankingLoss; resumable; returns fit() output with the best epoch restored."""
    from oa2.common import LOG, atomic_write_json, read_json
    from oa2.metrics import assignment_eval
    from oa2.training import fit
    cfg, t = model.cfg, model.cfg["training"]
    text = dict(zip(data.tasks["Issue_ID"], data.tasks["text"]))
    profile = dict(zip(data.members["User_ID"], data.members["profile_text"]))
    profiles = data.members["profile_text"].tolist()
    examples, relevant = training_tuples(data)
    qp, dp, scale = model.query_prefix, model.doc_prefix, float(t["mnrl_scale"])
    val = data.split("val")

    def evaluate():
        model.refresh_members(profiles)
        overall, _ = assignment_eval(model.score_tasks(val["text"].tolist()), val, data, with_slices=False)
        return overall["ndcg@10"], overall

    def step_loss(idx):
        exs = [examples[i] for i in idx]
        b = len(exs)
        anchors = model.embed([qp + text[e[0]] for e in exs])
        cols, owners = [e[1] for e in exs], list(range(b))
        for i, e in enumerate(exs):
            cols.extend(e[2])
            owners.extend([i] * len(e[2]))
        uniq = sorted(set(cols))
        where = {u: j for j, u in enumerate(uniq)}
        cand = model.embed([dp + profile[u] for u in uniq])[[where[u] for u in cols]]
        sim = scale * anchors @ cand.T
        # Mask in-batch candidates that are themselves relevant to the anchor task (48 profiles -> frequent collisions)
        mask = torch.zeros(sim.shape, dtype=torch.bool)
        for i, e in enumerate(exs):
            rel = relevant[e[0]]
            for c, (u, o) in enumerate(zip(cols, owners)):
                if o != i and u in rel:
                    mask[i, c] = True
        sim = sim.masked_fill(mask.to(sim.device), float("-inf"))
        return F.cross_entropy(sim, torch.arange(b, device=sim.device))

    work_dir.mkdir(parents=True, exist_ok=True)
    zs_path = work_dir / "zero_shot.json"
    zero_shot = read_json(zs_path)
    if zero_shot is None:
        LOG.info("Zero-shot validation (pretrained model, before fine-tuning) on %d tasks ...", len(val))
        model.st.eval()
        _, zero_shot = evaluate()
        atomic_write_json(zs_path, zero_shot)
    LOG.info("Zero-shot val ndcg@10: %s", zero_shot.get("ndcg@10"))

    params = [p for p in model.enc.parameters() if p.requires_grad]
    t0 = time.perf_counter()
    out = fit(modules=[model.enc], param_groups=[{"params": params, "lr": t["lr_lora"]}], n_items=len(examples),
              step_loss=step_loss, evaluate=evaluate, epochs=int(t["epochs"]), tcfg=t,
              per_device_batch=int(t["per_device_batch"]), precision=model.precision, work_dir=work_dir,
              seed=int(cfg["seed"]))
    out["zero_shot_val"] = zero_shot
    out["n_training_tuples"] = len(examples)
    out["train_time_s"] = time.perf_counter() - t0 + out.get("train_time_prior_s", 0.0)
    return out


def evaluate_test(score_tasks, refresh_members, data) -> tuple[dict, dict, np.ndarray]:
    """Headline metrics (classified test tasks), slices, and the raw [T, M] score matrix."""
    from oa2.metrics import assignment_eval
    test = data.split("test")
    refresh_members(data.members["profile_text"].tolist())
    scores = score_tasks(test["text"].tolist())
    overall, slices = assignment_eval(scores, test, data, with_slices=True)
    return overall, slices, scores


def predictions_frame(data, scores: np.ndarray):
    """Long table Issue_ID x User_ID with score and true label, same layout as OA2's predictions files."""
    from oa2.recipes.assignment import _predictions
    return _predictions(data, data.split("test"), scores)
