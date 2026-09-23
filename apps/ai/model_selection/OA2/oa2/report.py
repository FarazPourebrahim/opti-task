"""Report outputs (README §10): per-run JSON, predictions, leaderboards regenerated from JSON, SUMMARY.md."""
from __future__ import annotations

import glob
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .common import LOG, atomic_path, atomic_write_json, atomic_write_text, git_commit, read_json

SCHEMA_VERSION = "1.0"

TASK_INFO = {
    "story_point": {
        "dir": "reports_story_point",
        "primary": "qwk",
        "description": "Ordinal classification of Jira issue text into story-point buckets [1,2,3,5,8,13,21], "
                       "for suggesting estimates on task creation.",
    },
    "task_assignment": {
        "dir": "reports_tast_assignment",
        "primary": "ndcg@10",
        "description": "Learning to rank: score a (task text, team-member profile) pair for suitability and sort "
                       "all 48 members, for suggesting a ranked assignee shortlist on task creation.",
    },
}

CAVEATS = {
    "common": [
        "TAWOS is public open-source Jira data (39 projects); results may not transfer to other teams' conventions.",
        "Models see the final issue text; some issues were edited after estimation (see the "
        "text_changed_after_estimation slice for the gap).",
        "Single seed, no hyperparameter search: every model gets the same fixed budget.",
    ],
    "story_point": [
        "Story points are project-relative; the project key is part of the input and per-project metrics are "
        "reported.",
        "Raw story points are mapped to 7 log-scale buckets; 0-point issues are excluded.",
    ],
    "task_assignment": [
        "Team is synthetic; Task B labels are a scorer's opinion (Plausibility), not observed outcomes.",
        "Headline test metrics use classified tasks only; 'Unclassified' tasks are a separate slice.",
        "Nine members (one per area) are held out of training entirely to measure cold start.",
    ],
}

COMMON_COLS = ["run_id", "task", "model_key", "hf_repo_id", "revision_sha", "family", "recipe", "finetune_method",
               "total_params", "trainable_params", "license", "best_epoch", "train_time_s", "peak_gpu_mem_mb",
               "latency_ms_bs1_median", "throughput_items_per_s", "data_fingerprint", "finished_at"]
TASK_COLS = {
    "story_point": ["test_qwk", "test_mae_bucket", "test_within_one_acc", "test_exact_acc", "test_macro_f1",
                    "test_mae_raw_points", "test_spearman", "test_ece", "val_qwk", "delta_qwk_vs_tfidf"],
    "task_assignment": ["test_ndcg@10", "test_ndcg@5", "test_recall@5", "test_recall@10", "test_hit@1", "test_mrr",
                        "test_spearman_plausibility", "test_overqualified_top1_rate", "test_underqualified_top1_rate",
                        "test_heldout_ndcg@10", "zero_shot_val_ndcg@10", "val_ndcg@10", "delta_ndcg@10_vs_tfidf"],
}
TFIDF_KEY = {"story_point": "baseline_tfidf_ridge", "task_assignment": "baseline_tfidf_cosine"}
INT_COLS = ["total_params", "trainable_params", "best_epoch", "peak_gpu_mem_mb"]


# ---------------------------------------------------------------- paths

def task_dir(output_dir: Path, task: str) -> Path:
    return Path(output_dir) / TASK_INFO[task]["dir"]


def run_json_path(output_dir: Path, unit) -> Path:
    return task_dir(output_dir, unit.task) / "runs" / f"{unit.run_id}.json"


def predictions_path(output_dir: Path, unit) -> Path:
    return task_dir(output_dir, unit.task) / "predictions" / f"{unit.run_id}.csv.gz"


def log_path(output_dir: Path, unit) -> Path:
    return Path(output_dir) / "logs" / f"{unit.run_id}.log"


def preserve_previous_outputs(output_dir: Path, unit, partial: bool) -> None:
    """Never overwrite earlier reports: move them to archive/ before a unit (re-)runs.
    Predictions left by an interrupted attempt (`partial`) are discarded instead."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report = run_json_path(output_dir, unit)
    preds = predictions_path(output_dir, unit)
    had_report = report.exists()
    if had_report:
        dest = report.parent / "archive" / f"{unit.run_id}__{stamp}.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        report.replace(dest)
        LOG.info("Archived previous report to %s", dest)
    if preds.exists():
        if partial and not had_report:
            preds.unlink()
        else:
            dest = preds.parent / "archive" / f"{unit.run_id}__{stamp}.csv.gz"
            dest.parent.mkdir(parents=True, exist_ok=True)
            preds.replace(dest)


def write_predictions(df: pd.DataFrame, path: Path) -> None:
    with atomic_path(path) as tmp:
        df.to_csv(tmp, index=False, compression="gzip", float_format="%.6g")


# ---------------------------------------------------------------- per-run JSON

def build_report(unit, *, status, reason, result, revision, fingerprint, data_meta, precision, per_device_batch,
                 oom_retry, started, finished, notes, error, env, peak_mem_mb, disk_freed_mb=0) -> dict:
    info = TASK_INFO[unit.task]
    result = result or {}
    training = result.get("training", {})
    metrics = result.get("metrics", {})
    caveats = CAVEATS["common"] + CAVEATS[unit.task]
    if unit.smoke:
        caveats = ["SMOKE RUN (--limit-train): not comparable, excluded from the leaderboard."] + caveats
    hp = dict(unit.hparams)
    if not unit.is_baseline:
        hp.update({"per_device_batch_used": per_device_batch, "precision": precision,
                   "grad_accumulation": training.get("grad_accumulation"),
                   "optimizer": "AdamW, linear decay with warmup"})
    data = {"fingerprint": fingerprint, "n_train": result.get("n_train"), "n_val": result.get("n_val"),
            "n_test": result.get("n_test"), "label_distribution": (data_meta or {}).get("label_distribution")}
    if unit.task == "task_assignment":
        data["held_out_member_ids"] = (data_meta or {}).get("held_out_member_ids")
        data["sampled_split_sizes"] = (data_meta or {}).get("sampled_split_sizes")
    else:
        data["split_sizes"] = (data_meta or {}).get("split_sizes")
    return {
        "schema_version": SCHEMA_VERSION,
        "run_id": unit.run_id,
        "status": status,
        "status_reason": reason,
        "smoke": bool(unit.smoke),
        "context": {
            "project": "Opti-Task",
            "benchmark": "OA2 model selection",
            "task": unit.task,
            "task_description": info["description"],
            "primary_metric": info["primary"],
            "dataset": "TAWOS v1.1 staffing extension (synthetic 48-member team)",
            "caveats": caveats,
        },
        "model": {
            "key": unit.model_key,
            "hf_repo_id": unit.entry.get("hf_repo_id"),
            "revision_sha": revision,
            "family": unit.family,
            "license": unit.entry.get("license"),
            "total_params": result.get("total_params"),
            "trainable_params": result.get("trainable_params"),
            "recipe": unit.recipe,
            "finetune_method": result.get("finetune_method", "none" if unit.is_baseline else None),
        },
        "data": data,
        "training": {
            "hyperparameters": hp,
            "best_epoch": training.get("best_epoch"),
            "epochs_run": training.get("epochs_run"),
            "history": training.get("history", []),
            "oom_retry": bool(oom_retry),
            "resumed_from_epoch": None,
            "train_time_s": training.get("train_time_s"),
            "peak_gpu_mem_mb": peak_mem_mb,
        },
        "metrics": {
            "zero_shot_val": metrics.get("zero_shot_val"),
            "val": metrics.get("val"),
            "test": metrics.get("test"),
            "slices": metrics.get("slices"),
        },
        "efficiency": result.get("efficiency"),
        "environment": env,
        "timestamps": {"started": started, "finished": finished},
        "disk_freed_mb": disk_freed_mb,
        "notes": notes,
        "error": error,
    }


def write_report(output_dir: Path, unit, report: dict) -> Path:
    path = run_json_path(output_dir, unit)
    atomic_write_json(path, report)
    return path


# ---------------------------------------------------------------- leaderboards

def _load_runs(output_dir: Path, task: str) -> list[dict]:
    runs = []
    for p in sorted(glob.glob(str(task_dir(output_dir, task) / "runs" / "*.json"))):
        r = read_json(Path(p))
        if isinstance(r, dict) and r.get("run_id"):
            runs.append(r)
    return runs


def _flat_row(r: dict, task: str) -> dict:
    m, t, e = r["model"], r["training"], r.get("efficiency") or {}
    test, val = r["metrics"].get("test") or {}, r["metrics"].get("val") or {}
    row = {
        "run_id": r["run_id"], "task": task, "model_key": m["key"], "hf_repo_id": m.get("hf_repo_id"),
        "revision_sha": m.get("revision_sha"), "family": m.get("family"), "recipe": m.get("recipe"),
        "finetune_method": m.get("finetune_method"), "total_params": m.get("total_params"),
        "trainable_params": m.get("trainable_params"), "license": m.get("license"), "best_epoch": t.get("best_epoch"),
        "train_time_s": t.get("train_time_s"), "peak_gpu_mem_mb": t.get("peak_gpu_mem_mb"),
        "latency_ms_bs1_median": e.get("latency_ms_bs1_median"), "throughput_items_per_s": e.get("throughput_items_per_s"),
        "data_fingerprint": r["data"].get("fingerprint"), "finished_at": r["timestamps"].get("finished"),
    }
    if task == "story_point":
        for k in ("qwk", "mae_bucket", "within_one_acc", "exact_acc", "macro_f1", "mae_raw_points", "spearman", "ece"):
            row[f"test_{k}"] = test.get(k)
        row["val_qwk"] = val.get("qwk")
    else:
        for k in ("ndcg@10", "ndcg@5", "recall@5", "recall@10", "hit@1", "mrr", "spearman_plausibility",
                  "overqualified_top1_rate", "underqualified_top1_rate"):
            row[f"test_{k}"] = test.get(k)
        row["test_heldout_ndcg@10"] = ((r["metrics"].get("slices") or {}).get("held_out_members") or {}).get("ndcg@10")
        row["zero_shot_val_ndcg@10"] = (r["metrics"].get("zero_shot_val") or {}).get("ndcg@10")
        row["val_ndcg@10"] = val.get("ndcg@10")
    return row


def build_leaderboard(output_dir: Path, task: str) -> pd.DataFrame:
    primary = "test_" + TASK_INFO[task]["primary"]
    delta_col = TASK_COLS[task][-1]
    rows = [_flat_row(r, task) for r in _load_runs(output_dir, task)
            if r.get("status") == "completed" and not r.get("smoke")]
    df = pd.DataFrame(rows, columns=COMMON_COLS + [c for c in TASK_COLS[task] if c != delta_col])
    for c in [c for c in TASK_COLS[task] if c != delta_col] + ["train_time_s", "latency_ms_bs1_median",
                                                               "throughput_items_per_s"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    # delta vs the TF-IDF baseline computed on the same data fingerprint (latest one if re-run)
    base = df[df["model_key"] == TFIDF_KEY[task]].sort_values("finished_at")
    ref = dict(zip(base["data_fingerprint"], base[primary]))
    df[delta_col] = df[primary] - pd.to_numeric(df["data_fingerprint"].map(ref), errors="coerce")
    for c in INT_COLS:
        df[c] = pd.to_numeric(df[c], errors="coerce").round().astype("Int64")
    df = df.sort_values(primary, ascending=False, na_position="last", kind="mergesort").reset_index(drop=True)
    return df[COMMON_COLS + TASK_COLS[task]]


def regenerate(output_dir: Path) -> None:
    """Rebuild both leaderboards and SUMMARY.md from the run JSON files."""
    boards = {}
    for task in TASK_INFO:
        df = build_leaderboard(output_dir, task)
        boards[task] = df
        path = task_dir(output_dir, task) / "leaderboard.csv"
        try:
            with atomic_path(path) as tmp:
                df.to_csv(tmp, index=False, float_format="%.4f")
        except PermissionError as e:  # e.g. the CSV is open in Excel on Windows
            LOG.warning("Could not write %s (%s); it will be rebuilt after the next unit.", path, e)
    try:
        atomic_write_text(Path(output_dir) / "SUMMARY.md", _summary(output_dir, boards))
    except PermissionError as e:
        LOG.warning("Could not write SUMMARY.md (%s).", e)


# ---------------------------------------------------------------- SUMMARY.md

def _fmt(v, digits=4):
    if v is None or (isinstance(v, float) and math.isnan(v)) or v is pd.NA:
        return "-"
    if isinstance(v, float):
        return f"{v:.{digits}f}"
    return str(v)


def _params_m(v):
    return "-" if v is None or v is pd.NA or (isinstance(v, float) and math.isnan(v)) else f"{int(v) / 1e6:.1f}M"


def _md_table(df: pd.DataFrame, cols: list[str]) -> str:
    if df.empty:
        return "_No completed units yet._\n"
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for _, r in df.iterrows():
        cells = []
        for c in cols:
            if c == "total_params":
                cells.append(_params_m(r[c]))
            elif c in ("train_time_s", "latency_ms_bs1_median"):
                cells.append(_fmt(r[c], 1))
            else:
                cells.append(_fmt(r[c]))
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"


def _picks(df: pd.DataFrame, primary: str) -> list[str]:
    scored = df[pd.to_numeric(df[primary], errors="coerce").notna()]
    if scored.empty:
        return []
    best = scored.iloc[0]
    out = [f"- Best by `{primary}`: **{best['model_key']}** ({best['recipe']}) = {_fmt(best[primary])}"]
    models = scored[scored["family"] != "baseline"].copy()
    if not models.empty:
        top = float(models[primary].max())
        near = models[models[primary] >= top - 0.01].copy()
        near["_lat"] = pd.to_numeric(near["latency_ms_bs1_median"], errors="coerce")
        near = near.sort_values(["total_params", "_lat"], na_position="last", kind="mergesort")
        pick = near.iloc[0]
        out.append(f"- Efficiency-adjusted (smallest, then fastest, pretrained model within 0.01 of the best "
                   f"pretrained `{primary}` = {_fmt(top)}): **{pick['model_key']}** ({pick['recipe']}), "
                   f"{_params_m(pick['total_params'])} params, {_fmt(pick[primary])}, "
                   f"{_fmt(pick['latency_ms_bs1_median'], 1)} ms bs1")
    return out


def _summary(output_dir: Path, boards: dict) -> str:
    parts = [
        "# OA2 model selection — summary",
        "",
        "_Generated by `run_model_selection.py`; regenerated after every unit. Numbers only._",
        "",
        "Opti-Task benchmarks small open-weight models for two features: **(A) story-point estimation**, ordinal "
        "classification of Jira issue text into buckets [1, 2, 3, 5, 8, 13, 21] (primary metric: test QWK), and "
        "**(B) assignee recommendation**, ranking 48 team-member profiles per task (primary metric: test nDCG@10, "
        "gain = Plausibility). Data: TAWOS v1.1 Jira corpus with a synthetic 48-person team. Caveats: the team and "
        "Task B labels are synthetic (a scorer's opinion, not outcomes); story points are project-relative; models "
        "read the final issue text; single seed, no hyperparameter search. Smoke runs are excluded.",
        "",
    ]
    cols = {
        "story_point": ["model_key", "recipe", "finetune_method", "total_params", "test_qwk", "test_mae_bucket",
                        "test_within_one_acc", "test_macro_f1", "test_ece", "delta_qwk_vs_tfidf", "train_time_s",
                        "latency_ms_bs1_median"],
        "task_assignment": ["model_key", "recipe", "finetune_method", "total_params", "test_ndcg@10", "test_recall@5",
                            "test_hit@1", "test_heldout_ndcg@10", "zero_shot_val_ndcg@10", "delta_ndcg@10_vs_tfidf",
                            "train_time_s", "latency_ms_bs1_median"],
    }
    titles = {"story_point": "Task A — story-point estimation", "task_assignment": "Task B — assignee ranking"}
    fingerprints = set()
    problems = []
    for task, df in boards.items():
        primary = "test_" + TASK_INFO[task]["primary"]
        parts += [f"## {titles[task]}", "", _md_table(df, cols[task])]
        parts += _picks(df, primary) + [""]
        fingerprints.update(df["data_fingerprint"].dropna().unique().tolist())
        for r in _load_runs(output_dir, task):
            if r.get("status") in ("failed", "skipped"):
                err = (r.get("error") or {}).get("message") if r.get("error") else None
                problems.append((task, r["run_id"], r["status"], r.get("status_reason"), err))
    parts += ["## Failed / skipped units", ""]
    if problems:
        parts += ["| task | run_id | status | reason | message |", "|---|---|---|---|---|"]
        for task, rid, st, reason, msg in problems:
            msg = (msg or "").replace("|", "\\|").replace("\n", " ")[:160]
            parts.append(f"| {task} | `{rid}` | {st} | {reason or '-'} | {msg or '-'} |")
    else:
        parts.append("_None._")
    commit = git_commit(Path(output_dir))
    parts += ["", "## Provenance", "",
              f"- Data fingerprint(s): {', '.join(f'`{f}`' for f in sorted(fingerprints)) or '-'}",
              f"- Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
              f"- Repo commit: `{commit or 'unknown'}`", ""]
    return "\n".join(parts)
