"""Data preparation (README §3-§5): canonical text, labels, chronological splits, sampling, cache.

Prepared tables are cached as Parquet under `.cache/data/<task>_<fingerprint>/`. The fingerprint hashes
the source files' sizes and mtimes plus the preparation config, so any change triggers a rebuild.
"""
from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .common import LOG, atomic_write_json, read_json, rmtree, rng_for, stable_hash

PREP_VERSION = "1"
USED_FILES = ["Issue.csv", "Project.csv", "Component.csv", "Issue_Component.csv",
              "User.csv", "Task_Assignment.csv", "Task_Profile.csv"]
LEVELS = ["Intern", "Junior", "Mid-level", "Senior", "Staff", "Principal"]
LEVEL_RANK = {name: i for i, name in enumerate(LEVELS)}
SPLITS = ("train", "val", "test")

# README §4.2 table: raw value -> bucket value. Checked on every preparation.
_BUCKET_TABLE = {0.1: 1, 0.5: 1, 1: 1, 2: 2, 3: 3, 4: 5, 5: 5, 6: 5, 7: 8, 10: 8, 11: 13, 16: 13, 17: 21, 40: 21, 100: 21}


# ---------------------------------------------------------------- labels

def to_bucket(raw: float, buckets: list[int]) -> int:
    """Index of the bucket closest to `raw` on a log scale; ties go to the larger bucket."""
    v = min(max(float(raw), buckets[0]), buckets[-1])
    lv = math.log(v)
    best, best_d = 0, float("inf")
    for i, b in enumerate(buckets):
        d = abs(lv - math.log(b))
        if d < best_d - 1e-12 or abs(d - best_d) <= 1e-12:  # `<=` on a tie keeps the later (larger) bucket
            best, best_d = i, d
    return best


def _check_bucket_table(buckets: list[int]) -> None:
    if list(buckets) != [1, 2, 3, 5, 8, 13, 21]:
        return
    for raw, expected in _BUCKET_TABLE.items():
        got = buckets[to_bucket(raw, buckets)]
        if got != expected:
            raise AssertionError(f"bucket mapping for {raw} gave {got}, README §4.2 requires {expected}")


# ---------------------------------------------------------------- fingerprints

def _source_signature(dataset_dir: Path) -> list[dict]:
    sig = []
    for name in USED_FILES:
        st = (Path(dataset_dir) / name).stat()
        sig.append({"file": name, "size": st.st_size, "mtime_ns": st.st_mtime_ns})
    return sig


def fingerprints(cfg: dict) -> dict[str, str]:
    """One data fingerprint per task, so changing Task B sampling does not invalidate Task A runs."""
    common = {"prep_version": PREP_VERSION, "seed": cfg["seed"], "files": _source_signature(cfg["dataset_dir"]),
              "max_text_chars": cfg["data"]["max_text_chars"]}
    sp = cfg["story_point"]
    ta = cfg["task_assignment"]
    sp_prep = {k: sp[k] for k in ("buckets", "drop_zero", "split")}
    ta_prep = {k: ta[k] for k in ("train_tasks", "val_tasks", "test_tasks", "test_unclassified_tasks",
                                  "n_hard_negatives", "n_random_negatives", "overqualified_min_gap")}
    ta_prep["split"] = sp["split"]
    return {"story_point": stable_hash({**common, "story_point": sp_prep}, 16),
            "task_assignment": stable_hash({**common, "task_assignment": ta_prep}, 16)}


# ---------------------------------------------------------------- containers

@dataclass
class StoryPointData:
    fingerprint: str
    buckets: list[int]
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame
    meta: dict = field(default_factory=dict)


@dataclass
class AssignmentData:
    fingerprint: str
    tasks: pd.DataFrame           # Issue_ID, text, split, project_key, type, primary_area, required_level, unclassified
    pairs: pd.DataFrame           # Issue_ID, User_ID, Capability, Plausibility, Rank (sampled tasks only)
    members: pd.DataFrame         # User_ID, level, area, profile_text ... sorted by User_ID
    train_examples: pd.DataFrame  # Issue_ID, positives, pos_plaus, hard_negs, random_negs, overq_user
    held_out: list[int]
    meta: dict = field(default_factory=dict)

    def split(self, name: str) -> pd.DataFrame:
        return self.tasks[self.tasks["split"] == name].reset_index(drop=True)

    @property
    def member_ids(self) -> np.ndarray:
        return self.members["User_ID"].to_numpy()

    def relevance(self, task_ids) -> dict:
        """Dense [T, M] matrices over all members for the given tasks (absent pair => relevance 0)."""
        task_ids = np.asarray(task_ids)
        t_index = pd.Index(task_ids)
        m_index = pd.Index(self.member_ids)
        sub = self.pairs[self.pairs["Issue_ID"].isin(task_ids)]
        ti = t_index.get_indexer(sub["Issue_ID"])
        mi = m_index.get_indexer(sub["User_ID"])
        rel = np.zeros((len(task_ids), len(m_index)), dtype=np.float64)
        rank = np.zeros((len(task_ids), len(m_index)), dtype=np.int64)
        rel[ti, mi] = sub["Plausibility"].to_numpy()
        rank[ti, mi] = sub["Rank"].to_numpy()
        top1 = np.where((rank == 1).any(1), (rank == 1).argmax(1), -1)
        return {"rel": rel, "rank": rank, "top1": top1}


# ---------------------------------------------------------------- text

_WS = re.compile(r"\s+")


def _clean(value, max_chars: int | None = None) -> str:
    s = "" if value is None else str(value)
    s = s.strip()
    # TAWOS stores many titles/descriptions wrapped in literal quotes ("..." or """...""").
    lead = len(s) - len(s.lstrip('"'))
    trail = len(s) - len(s.rstrip('"'))
    k = min(lead, trail, 3)
    if k and len(s) > 2 * k:
        s = s[k:len(s) - k]
    s = _WS.sub(" ", s).strip()
    if max_chars and len(s) > max_chars:
        s = s[:max_chars]
    return s


def member_profile_text(row) -> str:
    return (f"Level: {row['Expertise_Level']}. Area: {row['Expertise_Area']}. "
            f"Years of experience: {row['Years_Experience']}. Role: {row['Role_In_Project']} ({row['Role_Class']}).")


def _load_issue_base(ddir: Path, max_chars: int) -> pd.DataFrame:
    LOG.info("Loading Issue.csv (large file, only the needed columns) ...")
    issues = pd.read_csv(
        ddir / "Issue.csv", keep_default_na=False, dtype=str, low_memory=False,
        usecols=["ID", "Title", "Description_Text", "Type", "Story_Point", "Creation_Date", "Project_ID",
                 "Title_Changed_After_Estimation", "Description_Changed_After_Estimation"])
    issues["ID"] = issues["ID"].astype(np.int64)
    issues["Project_ID"] = issues["Project_ID"].astype(np.int64)
    projects = pd.read_csv(ddir / "Project.csv", usecols=["ID", "Project_Key"], keep_default_na=False)
    key_of = dict(zip(projects["ID"].astype(np.int64), projects["Project_Key"]))
    comps = pd.read_csv(ddir / "Component.csv", usecols=["ID", "Name"], keep_default_na=False)
    ic = pd.read_csv(ddir / "Issue_Component.csv", keep_default_na=False).merge(
        comps.rename(columns={"ID": "Component_ID"}), on="Component_ID", how="inner")
    ic["Name"] = ic["Name"].map(_clean)
    comp_of = ic.groupby("Issue_ID")["Name"].agg(lambda s: ", ".join(sorted({n for n in s if n})))

    LOG.info("Building canonical task text for %d issues ...", len(issues))
    project_key = issues["Project_ID"].map(key_of).fillna("").astype(str)
    comp = issues["ID"].map(comp_of).fillna("")
    comp = comp.where(comp != "", "none")
    itype = issues["Type"].map(_clean)
    title = issues["Title"].map(_clean)
    desc = issues["Description_Text"].map(lambda v: _clean(v, max_chars))
    text = ("[Project: " + project_key + "] [Type: " + itype + "] [Components: " + comp + "]\n"
            + title + "\n" + desc).str.rstrip()
    flag = lambda s: s.str.strip().str.lower().isin(["1", "true", "t", "yes"])  # noqa: E731
    return pd.DataFrame({
        "Issue_ID": issues["ID"],
        "Project_ID": issues["Project_ID"],
        "project_key": project_key,
        "type": itype,
        "created": pd.to_datetime(issues["Creation_Date"], errors="coerce"),
        "story_point_raw": pd.to_numeric(issues["Story_Point"].replace("", np.nan), errors="coerce"),
        "changed": flag(issues["Title_Changed_After_Estimation"]) | flag(issues["Description_Changed_After_Estimation"]),
        "text": text,
    })


def chrono_split(df: pd.DataFrame, ratios: dict) -> pd.Series:
    """Per-project chronological split on Creation_Date (tie-break on ID): train / val / test."""
    d = df[["Project_ID", "created", "Issue_ID"]].sort_values(
        ["Project_ID", "created", "Issue_ID"], na_position="last", kind="mergesort")
    pos = d.groupby("Project_ID").cumcount().to_numpy()
    n = d.groupby("Project_ID")["Issue_ID"].transform("size").to_numpy()
    cut1 = np.floor(n * ratios["train"]).astype(int)
    cut2 = np.floor(n * (ratios["train"] + ratios["val"])).astype(int)
    split = np.where(pos < cut1, "train", np.where(pos < cut2, "val", "test"))
    return pd.Series(split, index=d.index).reindex(df.index)


# ---------------------------------------------------------------- Task A

def _build_story_point(base: pd.DataFrame, cfg: dict, fp: str) -> StoryPointData:
    sp_cfg = cfg["story_point"]
    buckets = list(sp_cfg["buckets"])
    _check_bucket_table(buckets)
    df = base[base["story_point_raw"].notna()].copy()
    n_with_sp = len(df)
    n_zero = int((df["story_point_raw"] == 0).sum())
    if sp_cfg["drop_zero"]:
        df = df[df["story_point_raw"] != 0]
    df = df[df["story_point_raw"] > 0]  # negative values cannot be placed on a log scale
    df["bucket"] = df["story_point_raw"].map(lambda v: to_bucket(v, buckets)).astype(np.int64)
    df["split"] = chrono_split(df, sp_cfg["split"])
    top_types = df["type"].value_counts().sort_index().sort_values(ascending=False, kind="mergesort").index[:6]
    df["type_slice"] = df["type"].where(df["type"].isin(top_types), "other")
    df = df.rename(columns={"story_point_raw": "raw_sp"})
    cols = ["Issue_ID", "project_key", "type", "type_slice", "changed", "raw_sp", "bucket", "text"]
    parts = {s: df[df["split"] == s][cols].sort_values("Issue_ID").reset_index(drop=True) for s in SPLITS}
    raw_map = (df.groupby("raw_sp")["bucket"].first().map(lambda i: buckets[i]))
    meta = {
        "n_with_story_point": n_with_sp, "n_zero_dropped": n_zero if sp_cfg["drop_zero"] else 0,
        "n_rows": len(df), "n_projects": int(df["project_key"].nunique()),
        "split_sizes": {s: len(parts[s]) for s in SPLITS},
        "top_types": list(top_types),
        "raw_to_bucket": {str(k): int(v) for k, v in raw_map.items()},
        "label_distribution": {s: {str(buckets[i]): int(c) for i, c in
                                   parts[s]["bucket"].value_counts().sort_index().items()} for s in SPLITS},
    }
    return StoryPointData(fp, buckets, parts["train"], parts["val"], parts["test"], meta)


# ---------------------------------------------------------------- Task B

def _sample_ids(ids: np.ndarray, n: int, rng: np.random.Generator) -> np.ndarray:
    ids = np.sort(np.asarray(ids))
    if len(ids) <= n:
        return ids
    return np.sort(rng.choice(ids, size=n, replace=False))


def _pick_held_out(members: pd.DataFrame, seed: int) -> list[int]:
    """One member per area, seeded; never the only member (team-wide) at their level."""
    rng = rng_for(seed, "held_out_members")
    level_counts = members["level"].value_counts()
    held = []
    for area in pd.unique(members["area"]):
        cand = members[(members["area"] == area) & (members["level"].map(level_counts) > 1)]["User_ID"]
        cand = np.sort(cand.to_numpy())
        if len(cand):
            held.append(int(rng.choice(cand)))
    return sorted(held)


def _build_assignment(base: pd.DataFrame, cfg: dict, fp: str) -> AssignmentData:
    ddir = Path(cfg["dataset_dir"])
    ta = cfg["task_assignment"]
    seed = cfg["seed"]
    df = base[["Issue_ID", "Project_ID", "project_key", "type", "created", "text"]].copy()
    df["split"] = chrono_split(df, cfg["story_point"]["split"])
    prof = pd.read_csv(ddir / "Task_Profile.csv", usecols=["Issue_ID", "Primary_Area", "Required_Level"],
                       keep_default_na=False)
    df = df.merge(prof, on="Issue_ID", how="left")
    df = df.rename(columns={"Primary_Area": "primary_area", "Required_Level": "required_level"})
    df["unclassified"] = df["primary_area"].eq("Unclassified")
    full_sizes = {s: int((df["split"] == s).sum()) for s in SPLITS}

    def pool(split, uncl):
        return df.loc[(df["split"] == split) & (df["unclassified"] == uncl), "Issue_ID"].to_numpy()

    chosen = {
        "train": _sample_ids(pool("train", False), ta["train_tasks"], rng_for(seed, "ta_train")),
        "val": _sample_ids(pool("val", False), ta["val_tasks"], rng_for(seed, "ta_val")),
        "test": np.concatenate([
            _sample_ids(pool("test", False), ta["test_tasks"], rng_for(seed, "ta_test")),
            _sample_ids(pool("test", True), ta["test_unclassified_tasks"], rng_for(seed, "ta_test_unclassified"))]),
    }
    frames = []
    for s in SPLITS:
        part = df[df["Issue_ID"].isin(chosen[s]) & (df["split"] == s)]
        frames.append(part)
    tasks = (pd.concat(frames)[["Issue_ID", "split", "project_key", "type", "primary_area", "required_level",
                                "unclassified", "text"]]
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
    held_out = _pick_held_out(members, seed)

    LOG.info("Loading Task_Assignment.csv ...")
    asg = pd.read_csv(ddir / "Task_Assignment.csv")
    pairs = asg[asg["Issue_ID"].isin(tasks["Issue_ID"])].sort_values(["Issue_ID", "Rank", "User_ID"])
    pairs = pairs.reset_index(drop=True)

    examples = _build_train_examples(tasks[tasks["split"] == "train"]["Issue_ID"].to_numpy(),
                                     pairs, members, held_out, ta, seed)
    meta = {
        "full_split_sizes": full_sizes,
        "sampled_split_sizes": {s: int((tasks["split"] == s).sum()) for s in SPLITS},
        "test_unclassified": int(tasks[(tasks["split"] == "test")]["unclassified"].sum()),
        "held_out_member_ids": held_out,
        "n_train_examples_tasks": len(examples),
        "label_distribution": {s: _pair_stats(pairs[pairs["Issue_ID"].isin(tasks[tasks["split"] == s]["Issue_ID"])])
                               for s in SPLITS},
    }
    return AssignmentData(fp, tasks, pairs, members, examples, held_out, meta)


def _pair_stats(p: pd.DataFrame) -> dict:
    if p.empty:
        return {}
    q = p["Plausibility"].quantile([0.1, 0.25, 0.5, 0.75, 0.9])
    return {"n_pairs": len(p), "n_tasks": int(p["Issue_ID"].nunique()),
            "mean_relevant_per_task": round(len(p) / max(p["Issue_ID"].nunique(), 1), 4),
            "plausibility_quantiles": {f"q{int(k * 100)}": round(float(v), 4) for k, v in q.items()}}


def _build_train_examples(train_ids, pairs, members, held_out, ta, seed) -> pd.DataFrame:
    """README §5.5: positives, hard negatives (same area, other level), random negatives. Held-out members
    are removed from every training pair."""
    held = set(held_out)
    area_of = dict(zip(members["User_ID"], members["area"]))
    level_of = dict(zip(members["User_ID"], members["level"]))
    pool_members = [int(u) for u in members["User_ID"] if u not in held]
    rng = rng_for(seed, "ta_negatives")
    tp = pairs[pairs["Issue_ID"].isin(train_ids) & ~pairs["User_ID"].isin(held)]
    grouped = {iid: g for iid, g in tp.groupby("Issue_ID", sort=True)}
    rows = []
    for iid in np.sort(train_ids):
        g = grouped.get(iid)
        if g is None:
            g = tp.iloc[:0]
        g = g.sort_values(["Plausibility", "User_ID"], ascending=[False, True])
        pos = [int(u) for u in g["User_ID"]]
        plaus = [float(v) for v in g["Plausibility"]]
        gap = (g["Capability"] - g["Plausibility"]).to_numpy()
        present = set(pos)
        zero_pool = [u for u in pool_members if u not in present]
        hard_cand = [u for u in zero_pool
                     if any(area_of[p] == area_of[u] and level_of[p] != level_of[u] for p in pos)]
        hard = [int(u) for u in rng.permutation(np.array(hard_cand, dtype=np.int64))[:ta["n_hard_negatives"]]]
        rest = np.array([u for u in zero_pool if u not in set(hard)], dtype=np.int64)
        rand = [int(u) for u in rng.permutation(rest)[:ta["n_random_negatives"]]]
        overq = -1
        if len(pos) > 1:
            j = int(np.argmax(gap[1:])) + 1
            if gap[j] >= ta["overqualified_min_gap"]:
                overq = pos[j]
        rows.append((int(iid), pos, plaus, hard, rand, overq))
    return pd.DataFrame(rows, columns=["Issue_ID", "positives", "pos_plaus", "hard_negs", "random_negs", "overq_user"])


# ---------------------------------------------------------------- cache + entry point

_TABLES = {"story_point": ["train", "val", "test"],
           "task_assignment": ["tasks", "pairs", "members", "train_examples"]}


def _cache_dir(cfg: dict, task: str, fp: str) -> Path:
    return Path(cfg["output_dir"]) / ".cache" / "data" / f"{task}_{fp}"


def _save(obj, cfg: dict, task: str) -> None:
    final = _cache_dir(cfg, task, obj.fingerprint)
    tmp = final.with_name(final.name + ".tmp")
    rmtree(tmp)
    tmp.mkdir(parents=True)
    for name in _TABLES[task]:
        getattr(obj, name).to_parquet(tmp / f"{name}.parquet", index=False)
    meta = dict(obj.meta)
    if task == "story_point":
        meta["buckets"] = obj.buckets
    else:
        meta["held_out"] = obj.held_out
    atomic_write_json(tmp / "meta.json", meta)
    rmtree(final)
    os.replace(tmp, final)


def _load(cfg: dict, task: str, fp: str):
    d = _cache_dir(cfg, task, fp)
    meta = read_json(d / "meta.json")
    if meta is None:
        return None
    t = {name: pd.read_parquet(d / f"{name}.parquet") for name in _TABLES[task]}
    if task == "story_point":
        return StoryPointData(fp, meta["buckets"], t["train"], t["val"], t["test"], meta)
    for col in ("positives", "pos_plaus", "hard_negs", "random_negs"):
        t["train_examples"][col] = t["train_examples"][col].map(list)
    return AssignmentData(fp, t["tasks"], t["pairs"], t["members"], t["train_examples"], list(meta["held_out"]), meta)


def prepare(cfg: dict, tasks: list[str], fps: dict[str, str]) -> dict:
    """Load cached prepared data, building (once) whatever is missing."""
    out, missing = {}, []
    for task in tasks:
        cached = _load(cfg, task, fps[task])
        if cached is not None:
            LOG.info("Data cache hit for %s (fingerprint %s)", task, fps[task])
            out[task] = cached
        else:
            missing.append(task)
    if missing:
        base = _load_issue_base(Path(cfg["dataset_dir"]), cfg["data"]["max_text_chars"])
        for task in missing:
            LOG.info("Preparing %s data (fingerprint %s) ...", task, fps[task])
            obj = (_build_story_point if task == "story_point" else _build_assignment)(base, cfg, fps[task])
            _save(obj, cfg, task)
            out[task] = obj
        del base
    return out
