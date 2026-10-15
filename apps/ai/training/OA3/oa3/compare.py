"""Paired comparison with OA2's Qwen3-Embedding run on the same test tasks (DESIGN.md §6.2).

OA2 saved its test scores (`predictions/*.csv.gz`, one row per task x member). When OA3's test set is the same set of
tasks, both models' per-task nDCG@10 are compared with a paired bootstrap, the same way REPORT.md computed its CIs.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


def per_task_ndcg(scores: np.ndarray, rel: np.ndarray, k: int = 10) -> np.ndarray:
    """nDCG@k per row; same ordering/tie rule as oa2.metrics.ranking_metrics. NaN where a task has no relevant member."""
    order = np.argsort(-scores, axis=1, kind="stable")
    ranked = np.take_along_axis(rel, order, 1)[:, :k]
    ideal = -np.sort(-rel, axis=1)[:, :k]
    disc = 1.0 / np.log2(np.arange(2, k + 2))
    dcg, idcg = (ranked * disc).sum(1), (ideal * disc).sum(1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(idcg > 0, dcg / idcg, np.nan)


def compare_with_oa2(data, scores: np.ndarray, pred_path: str | None, resamples: int, seed: int) -> dict:
    if not pred_path or not Path(pred_path).exists():
        return {"available": False, "reason": f"OA2 predictions not found: {pred_path}"}
    test = data.split("test")
    oa2 = pd.read_csv(pred_path)
    ours_ids, oa2_ids = set(test["Issue_ID"]), set(oa2["Issue_ID"])
    same = ours_ids == oa2_ids
    out = {"available": True, "same_test_tasks": same, "n_ours": len(ours_ids), "n_oa2": len(oa2_ids),
           "n_shared": len(ours_ids & oa2_ids)}
    if not same:
        out["reason"] = "test task sets differ (different data budget or dataset); no paired comparison"
        return out
    mat = oa2.pivot(index="Issue_ID", columns="User_ID", values="score")
    oa2_scores = mat.loc[test["Issue_ID"].to_numpy(), data.member_ids].to_numpy(dtype=np.float64)
    rel = data.relevance(test["Issue_ID"].to_numpy())["rel"]
    cls = ~test["unclassified"].to_numpy().astype(bool)
    a = per_task_ndcg(np.asarray(scores, dtype=np.float64)[cls], rel[cls])
    b = per_task_ndcg(oa2_scores[cls], rel[cls])
    ok = np.isfinite(a) & np.isfinite(b)
    a, b = a[ok], b[ok]
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(a), size=(resamples, len(a)))
    diffs = (a[idx] - b[idx]).mean(1)
    out.update({
        "ndcg@10_oa3": float(a.mean()), "ndcg@10_oa2": float(b.mean()), "delta": float((a - b).mean()),
        "delta_ci95": [float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))],
        "share_tasks_better": float((a > b + 1e-12).mean()), "share_tasks_worse": float((a < b - 1e-12).mean()),
        "n_tasks": int(len(a)), "bootstrap_resamples": resamples,
    })
    return out
