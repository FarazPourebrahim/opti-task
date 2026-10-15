"""Config loading, path resolution, the `oa2` import, and the run ID."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

OA3_DIR = Path(__file__).resolve().parents[1]
REQUIRED = ["seed", "dataset_dir", "oa2_dir", "model", "data", "prompt", "training", "export", "evaluation"]


def load_config(path: Path) -> dict:
    path = Path(path).resolve()
    cfg = yaml.safe_load(path.read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED if k not in cfg]
    if missing:
        raise SystemExit(f"config {path} is missing keys: {missing}")
    base = path.parent
    for key in ("dataset_dir", "oa2_dir"):
        cfg[key] = str((base / cfg[key]).resolve())
    cfg["hf_cache_dir"] = str((base / cfg["hf_cache_dir"]).resolve()) if cfg.get("hf_cache_dir") else None
    if cfg["model"].get("local_path"):
        cfg["model"]["local_path"] = str((base / cfg["model"]["local_path"]).resolve())
    ev = cfg["evaluation"]
    if ev.get("oa2_reference_predictions"):
        ev["oa2_reference_predictions"] = str((base / ev["oa2_reference_predictions"]).resolve())
    cfg["prompt"]["query_prefix_resolved"] = cfg["prompt"]["query_prefix"].format(
        instruction=cfg["prompt"]["query_instruction"])
    if not Path(cfg["dataset_dir"]).is_dir():
        raise SystemExit(f"dataset_dir not found: {cfg['dataset_dir']}")
    if not (Path(cfg["oa2_dir"]) / "oa2" / "__init__.py").is_file():
        raise SystemExit(f"oa2_dir does not contain the oa2 package: {cfg['oa2_dir']}")
    return cfg


def import_oa2(cfg: dict) -> None:
    """Make OA2's `oa2` package importable. OA3 reuses it instead of copying it (DESIGN.md §2)."""
    if cfg["oa2_dir"] not in sys.path:
        sys.path.insert(0, cfg["oa2_dir"])


def run_id(cfg: dict, data_fp: str, limit_train: int | None, limit_eval: int | None) -> str:
    """Stable ID of one training run: changes whenever the data, model, prompt or recipe changes."""
    from oa2.common import stable_hash
    payload = {"data": data_fp, "model": cfg["model"], "prompt": cfg["prompt"], "training": cfg["training"],
               "limit_train": limit_train, "limit_eval": limit_eval}
    tag = ("smoke__" if (limit_train or limit_eval) else "") + ("local__" if cfg["model"].get("local_path") else "")
    slug = re.sub(r"[^a-z0-9]+", "_", cfg["model"]["hf_repo_id"].split("/")[-1].lower()).strip("_")
    return f"assignee__{tag}{slug}__{stable_hash(payload, 8)}"
