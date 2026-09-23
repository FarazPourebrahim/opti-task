"""Model registry -> ordered run units with stable run_ids; Hugging Face repo verification and pull (README §6, §9.1)."""
from __future__ import annotations

import copy
from dataclasses import dataclass, field

from .common import LOG, UnitSkipped, stable_hash

TASKS = ("story_point", "task_assignment")

BASELINES = {
    "story_point": [
        {"key": "baseline_median_per_project", "recipe": "median_per_project"},
        {"key": "baseline_tfidf_ridge", "recipe": "tfidf_ridge"},
    ],
    "task_assignment": [
        {"key": "baseline_random", "recipe": "random"},
        {"key": "baseline_popularity", "recipe": "popularity"},
        {"key": "baseline_tfidf_cosine", "recipe": "tfidf_cosine"},
    ],
}
BASELINE_SETTINGS = {"tfidf": {"ngram_range": [1, 2], "max_features": 50000}, "ridge_alpha": 1.0}

TASK_B_RECIPE = {"encoder": "cross_encoder", "embedder": "bi_encoder",
                 "reranker": "reranker_yes_no", "generative": "generative_yes_no"}
FAMILIES = set(TASK_B_RECIPE)


@dataclass
class Unit:
    task: str
    model_key: str
    recipe: str
    family: str
    entry: dict
    hparams: dict
    run_id: str
    is_baseline: bool
    smoke: bool
    order: int = 0
    notes: list = field(default_factory=list)

    @property
    def repo(self) -> str | None:
        return self.entry.get("hf_repo_id")


def _resolve_hparams(cfg: dict, entry: dict, task: str) -> dict:
    t = copy.deepcopy(cfg["training"])
    for key in ("max_seq_len", "per_device_batch", "eval_batch"):
        if key in entry:
            t[key] = entry[key]
    t["precision_override"] = entry.get("precision")
    t["epochs"] = cfg[task]["epochs"]
    t["seed"] = cfg["seed"]
    if task == "task_assignment":
        instr = cfg["task_assignment"]["query_instruction"]
        t["query_instruction"] = instr
        t["query_prefix"] = str(entry.get("query_prefix", "")).format(instruction=instr)
        t["doc_prefix"] = str(entry.get("doc_prefix", ""))
        t["n_hard_negatives"] = cfg["task_assignment"]["n_hard_negatives"]
        t["n_random_negatives"] = cfg["task_assignment"]["n_random_negatives"]
    return t


def _make_run_id(task, key, recipe, payload) -> str:
    return f"{task}__{key}__{recipe}__{stable_hash(payload, 8)}"


def build_units(cfg: dict, fps: dict, limit_train: int | None) -> list[Unit]:
    """Baselines first, then models from smallest to largest parameter count (README §6.1)."""
    tasks = [t for t in TASKS if t in cfg["tasks"]]
    units: list[Unit] = []
    for task in tasks:
        for b in BASELINES[task]:
            hp = {"seed": cfg["seed"], **BASELINE_SETTINGS}
            payload = {"task": task, "model": b["key"], "recipe": b["recipe"], "hparams": hp,
                       "data_fingerprint": fps[task], "limit_train": limit_train}
            units.append(Unit(task, b["key"], b["recipe"], "baseline", {"key": b["key"], "family": "baseline"},
                              hp, _make_run_id(task, b["key"], b["recipe"], payload), True, bool(limit_train)))

    models = [m for m in cfg["models"] if m.get("enabled", True)]
    models = sorted(enumerate(models), key=lambda im: (float(im[1].get("params_m") or 1e9), im[0]))
    for _, entry in models:
        fam = entry["family"]
        if fam not in FAMILIES:
            raise ValueError(f"model {entry['key']}: unknown family {fam!r}")
        for task in tasks:
            if task not in entry.get("tasks", []):
                continue
            if task == "story_point":
                if fam == "reranker":
                    continue
                recipes = ["generative_sft"] if fam == "generative" else list(
                    entry.get("heads", cfg["story_point"]["heads"]))
            else:
                recipes = [TASK_B_RECIPE[fam]]
            for recipe in recipes:
                hp = _resolve_hparams(cfg, entry, task)
                payload = {"task": task, "model": entry["key"], "hf_repo_id": entry.get("hf_repo_id"),
                           "revision": entry.get("revision"), "family": fam, "recipe": recipe,
                           "trust_remote_code": bool(entry.get("trust_remote_code", False)),
                           "hparams": hp, "data_fingerprint": fps[task], "limit_train": limit_train}
                units.append(Unit(task, entry["key"], recipe, fam, dict(entry), hp,
                                  _make_run_id(task, entry["key"], recipe, payload), False, bool(limit_train)))
    for i, u in enumerate(units):
        u.order = i
    return units


# ---------------------------------------------------------------- Hugging Face

def _is_unverified(repo) -> bool:
    return not repo or "verify" in str(repo).lower() or "/" not in str(repo)


def verify_repo(entry: dict) -> dict:
    """Resolve the repo id and revision SHA. Raises UnitSkipped for missing/unverified/gated repos;
    other errors (e.g. network) propagate and mark the unit failed."""
    repo = entry.get("hf_repo_id")
    if _is_unverified(repo):
        raise UnitSkipped("repo_id_unverified", f"hf_repo_id {repo!r} is missing or marked 'verify'; not guessing.")
    from huggingface_hub import model_info
    from huggingface_hub.utils import GatedRepoError, RepositoryNotFoundError, RevisionNotFoundError

    try:
        info = model_info(repo, revision=entry.get("revision"))
    except GatedRepoError as e:
        raise UnitSkipped("gated_access_denied", str(e)) from e
    except RevisionNotFoundError as e:
        raise UnitSkipped("revision_not_found", str(e)) from e
    except RepositoryNotFoundError as e:
        raise UnitSkipped("repo_not_found", str(e)) from e
    return {"revision_sha": info.sha, "gated": bool(getattr(info, "gated", False)),
            "library_name": getattr(info, "library_name", None)}


_IGNORE = ["*.onnx", "onnx/*", "openvino/*", "*.h5", "*.msgpack", "*.ot", "tf_model*", "flax_model*",
           "rust_model*", "*.tflite", "coreml/*", "*.gguf", "*.mlmodel*"]


def pull(repo: str, revision: str, cache_dir: str | None) -> str:
    """Download the pinned revision into the HF cache; returns the local snapshot folder."""
    from huggingface_hub import snapshot_download
    from huggingface_hub.utils import GatedRepoError, HfHubHTTPError

    LOG.info("Pulling %s @ %s ...", repo, revision[:12] if revision else None)
    try:
        return snapshot_download(repo, revision=revision, cache_dir=cache_dir, ignore_patterns=_IGNORE)
    except GatedRepoError as e:
        raise UnitSkipped("gated_access_denied", str(e)) from e
    except HfHubHTTPError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (401, 403):
            raise UnitSkipped("gated_access_denied", str(e)) from e
        raise
