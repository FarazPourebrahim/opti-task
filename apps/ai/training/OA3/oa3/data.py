"""Task B data for OA3 (DESIGN.md §4). Same preparation as OA2 (`oa2/data.py`), with two differences:

1. The training sample is NESTED: the classified training pool is shuffled once with a fixed seed and the first
   `train_tasks` tasks are taken. A larger budget is therefore always a strict superset of a smaller one, and
   "the new tasks" of a bigger run are exactly the tail of the same order.
2. Every sampled task ID is written to a manifest (`reports/<run_id>/data/*.csv`), so a model can be traced back to
   the exact tasks it was trained, validated and tested on.

Validation, test and held-out members use OA2's own sampling functions and seed names, so with OA2's test sizes the
test set is the SAME 2,000 + 500 tasks OA2 scored (checked at runtime against OA2's saved predictions).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .config import OA3_DIR

DATA_VERSION = "oa3-1"
TRAIN_ORDER_SEED_NAME = "oa3_train_order"


def fingerprint(cfg: dict) -> str:
    from oa2.common import stable_hash
    from oa2.data import PREP_VERSION, _source_signature
    return stable_hash({"oa3_data_version": DATA_VERSION, "oa2_prep_version": PREP_VERSION, "seed": cfg["seed"],
                        "files": _source_signature(Path(cfg["dataset_dir"])), "data": cfg["data"]}, 16)


def nested_sample(pool: np.ndarray, n: int, seed: int, name: str = TRAIN_ORDER_SEED_NAME) -> np.ndarray:
    """First `n` IDs of one fixed seeded permutation of the sorted pool, returned sorted.
    nested_sample(pool, a) is a subset of nested_sample(pool, b) whenever a <= b."""
    from oa2.common import rng_for
    order = rng_for(seed, name).permutation(np.sort(np.asarray(pool)))
    return np.sort(order[:n])


def _cache_cfg(cfg: dict) -> dict:
    # oa2.data._save/_load cache under <output_dir>/.cache/data/task_assignment_<fingerprint>/
    return {**cfg, "output_dir": str(OA3_DIR)}


def prepare(cfg: dict):
    """Load the prepared AssignmentData from the cache, building it once if missing."""
    from oa2.common import LOG
    from oa2.data import _load, _save
    fp = fingerprint(cfg)
    cached = _load(_cache_cfg(cfg), "task_assignment", fp)
    if cached is not None:
        LOG.info("Data cache hit (fingerprint %s)", fp)
        return cached
    data = _build(cfg, fp)
    _save(data, _cache_cfg(cfg), "task_assignment")
    return data


def _build(cfg: dict, fp: str):
    from oa2.common import LOG, rng_for
    from oa2.data import (SPLITS, AssignmentData, _build_train_examples, _load_issue_base, _pair_stats,
                          _pick_held_out, _sample_ids, chrono_split, member_profile_text)
    d = cfg["data"]
    seed = int(cfg["seed"])
    ddir = Path(cfg["dataset_dir"])
    base = _load_issue_base(ddir, d["max_text_chars"])
    df = base[["Issue_ID", "Project_ID", "project_key", "type", "created", "text"]].copy()
    del base
    df["split"] = chrono_split(df, d["split"])
    prof = pd.read_csv(ddir / "Task_Profile.csv", usecols=["Issue_ID", "Primary_Area", "Required_Level"],
                       keep_default_na=False)
    df = df.merge(prof, on="Issue_ID", how="left")
    df = df.rename(columns={"Primary_Area": "primary_area", "Required_Level": "required_level"})
    df["unclassified"] = df["primary_area"].eq("Unclassified")

    def pool(split, uncl):
        return df.loc[(df["split"] == split) & (df["unclassified"] == uncl), "Issue_ID"].to_numpy()

    pools = {"train": len(pool("train", False)), "val": len(pool("val", False)), "test": len(pool("test", False)),
             "test_unclassified": len(pool("test", True))}
    if d["train_tasks"] > pools["train"]:
        LOG.warning("train_tasks %d > %d available classified training tasks; using all of them.",
                    d["train_tasks"], pools["train"])
    chosen = {
        "train": nested_sample(pool("train", False), d["train_tasks"], seed),
        # OA2's functions and seed names: same sizes as OA2 -> same tasks as OA2.
        "val": _sample_ids(pool("val", False), d["val_tasks"], rng_for(seed, "ta_val")),
        "test": np.concatenate([
            _sample_ids(pool("test", False), d["test_tasks"], rng_for(seed, "ta_test")),
            _sample_ids(pool("test", True), d["test_unclassified_tasks"], rng_for(seed, "ta_test_unclassified"))]),
    }
    tasks = (pd.concat([df[df["Issue_ID"].isin(chosen[s]) & (df["split"] == s)] for s in SPLITS])
             [["Issue_ID", "split", "project_key", "type", "primary_area", "required_level", "unclassified", "text"]]
             .sort_values(["split", "Issue_ID"]).reset_index(drop=True))

    users = pd.read_csv(ddir / "User.csv", keep_default_na=False)
    members = pd.DataFrame({
        "User_ID": users["ID"].astype(np.int64),
        "level": users["Expertise_Level"],
        "area": users["Expertise_Area"],
        "years": users["Years_Experience"],
        "role": users["Role_In_Project"],
        "role_class": users["Role_Class"],
        "profile_text": users.apply(member_profile_text, axis=1),
    }).sort_values("User_ID").reset_index(drop=True)
    held_out = _pick_held_out(members, seed) if d["hold_out_members"] else []

    LOG.info("Loading Task_Assignment.csv ...")
    asg = pd.read_csv(ddir / "Task_Assignment.csv")
    pairs = (asg[asg["Issue_ID"].isin(tasks["Issue_ID"])].sort_values(["Issue_ID", "Rank", "User_ID"])
             .reset_index(drop=True))
    ta = {k: d[k] for k in ("n_hard_negatives", "n_random_negatives", "overqualified_min_gap")}
    LOG.info("Building training examples for %d tasks ...", len(chosen["train"]))
    examples = _build_train_examples(tasks[tasks["split"] == "train"]["Issue_ID"].to_numpy(),
                                     pairs, members, held_out, ta, seed)
    meta = {
        "fingerprint": fp,
        "available_classified_pools": pools,
        "sampled_split_sizes": {s: int((tasks["split"] == s).sum()) for s in SPLITS},
        "test_unclassified": int(tasks[tasks["split"] == "test"]["unclassified"].sum()),
        "held_out_member_ids": held_out,
        "n_training_tuples": int(sum(len(p) for p in examples["positives"])),
        "label_distribution": {s: _pair_stats(pairs[pairs["Issue_ID"].isin(tasks[tasks["split"] == s]["Issue_ID"])])
                               for s in SPLITS},
    }
    return AssignmentData(fp, tasks, pairs, members, examples, held_out, meta)


def apply_limits(data, limit_train: int | None, limit_eval: int | None, seed: int):
    """Smoke mode: deterministic subsets of the training tasks and of the val/test tasks."""
    from oa2.common import rng_for
    from oa2.data import AssignmentData
    if not (limit_train or limit_eval):
        return data
    keep = []
    for split in ("train", "val", "test"):
        ids = data.tasks.loc[data.tasks["split"] == split, "Issue_ID"].to_numpy()
        n = limit_train if split == "train" else limit_eval
        if n and len(ids) > n:
            ids = np.sort(rng_for(seed, f"smoke_{split}").choice(ids, size=n, replace=False))
        keep.append(ids)
    keep = np.concatenate(keep)
    tasks = data.tasks[data.tasks["Issue_ID"].isin(keep)].reset_index(drop=True)
    examples = data.train_examples[data.train_examples["Issue_ID"].isin(keep)].reset_index(drop=True)
    pairs = data.pairs[data.pairs["Issue_ID"].isin(keep)].reset_index(drop=True)
    meta = {**data.meta, "smoke": {"limit_train": limit_train, "limit_eval": limit_eval}}
    return AssignmentData(data.fingerprint, tasks, pairs, data.members, examples, data.held_out, meta)


def write_manifest(data, out_dir: Path) -> dict:
    """Task-ID lists of every split + the member table: what exactly this model saw (DESIGN.md §4.4)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    for split in ("train", "val", "test"):
        part = data.tasks.loc[data.tasks["split"] == split, ["Issue_ID", "unclassified"]]
        path = out_dir / f"{split}_task_ids.csv"
        part.to_csv(path, index=False)
        files[split] = path.name
    mem = data.members[["User_ID", "level", "area", "years", "role", "role_class", "profile_text"]].copy()
    mem["held_out"] = mem["User_ID"].isin(data.held_out)
    mem.to_csv(out_dir / "members.csv", index=False)
    files["members"] = "members.csv"
    return files
