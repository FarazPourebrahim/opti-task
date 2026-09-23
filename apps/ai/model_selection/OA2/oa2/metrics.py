"""Metrics and slicing for both tasks (README §4.5, §4.7, §5.6, §5.8)."""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from scipy.stats import rankdata, spearmanr
from sklearn.metrics import cohen_kappa_score, confusion_matrix, f1_score

from .data import LEVEL_RANK


def _nan_to_none(d: dict) -> dict:
    return {k: (None if isinstance(v, float) and not np.isfinite(v) else v) for k, v in d.items()}


# ---------------------------------------------------------------- Task A

def expected_calibration_error(conf: np.ndarray, correct: np.ndarray, n_bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    idx = np.clip(np.digitize(conf, edges[1:-1], right=True), 0, n_bins - 1)
    ece = 0.0
    for b in range(n_bins):
        m = idx == b
        if m.any():
            ece += m.mean() * abs(correct[m].mean() - conf[m].mean())
    return float(ece)


def story_point_metrics(y_true, y_pred, raw_sp, buckets, probs=None, with_confusion=True) -> dict:
    y_true = np.asarray(y_true, dtype=np.int64)
    y_pred = np.asarray(y_pred, dtype=np.int64)
    raw_sp = np.asarray(raw_sp, dtype=np.float64)
    k = len(buckets)
    n = len(y_true)
    out = {"n": int(n)}
    if n == 0:
        return out
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        qwk = cohen_kappa_score(y_true, y_pred, labels=list(range(k)), weights="quadratic")
        sp = spearmanr(y_true, y_pred).statistic if n > 1 else float("nan")
    present = sorted(set(y_true.tolist()) | set(y_pred.tolist()))
    out.update({
        "qwk": float(qwk),
        "mae_bucket": float(np.abs(y_true - y_pred).mean()),
        "within_one_acc": float((np.abs(y_true - y_pred) <= 1).mean()),
        "exact_acc": float((y_true == y_pred).mean()),
        "macro_f1": float(f1_score(y_true, y_pred, labels=present, average="macro", zero_division=0)),
        "mae_raw_points": float(np.abs(np.asarray(buckets)[y_pred] - raw_sp).mean()),
        "spearman": float(sp),
        "ece": None,
    })
    if probs is not None:
        probs = np.asarray(probs, dtype=np.float64)
        conf = probs[np.arange(n), y_pred]
        out["ece"] = expected_calibration_error(conf, (y_pred == y_true).astype(np.float64))
    if with_confusion:
        out["confusion_matrix"] = confusion_matrix(y_true, y_pred, labels=list(range(k))).tolist()
    return _nan_to_none(out)


def story_point_slices(test_df: pd.DataFrame, y_pred, buckets, probs=None) -> dict:
    y_pred = np.asarray(y_pred)
    groups = {}
    for key in sorted(test_df["project_key"].unique()):
        groups[f"project:{key}"] = (test_df["project_key"] == key).to_numpy()
    for t in sorted(test_df["type_slice"].unique()):
        groups[f"type:{t}"] = (test_df["type_slice"] == t).to_numpy()
    changed = test_df["changed"].to_numpy().astype(bool)
    groups["text_changed_after_estimation:true"] = changed
    groups["text_changed_after_estimation:false"] = ~changed
    out = {}
    for name, m in groups.items():
        out[name] = story_point_metrics(test_df["bucket"].to_numpy()[m], y_pred[m], test_df["raw_sp"].to_numpy()[m],
                                        buckets, None if probs is None else np.asarray(probs)[m])
    return out


# ---------------------------------------------------------------- Task B

def ranking_metrics(scores, rel, top1, member_level=None, required_level=None) -> dict:
    """scores/rel: [T, M]; top1: [T] member index of the Rank==1 member (-1 if none);
    member_level: [M] level ranks; required_level: [T] level ranks (NaN if unknown)."""
    scores = np.asarray(scores, dtype=np.float64)
    rel = np.asarray(rel, dtype=np.float64)
    t, m = scores.shape
    out = {"n_tasks": int(t)}
    if t == 0:
        return out
    order = np.argsort(-scores, axis=1, kind="stable")
    ranked_rel = np.take_along_axis(rel, order, 1)
    ideal = -np.sort(-rel, axis=1)
    disc = 1.0 / np.log2(np.arange(2, m + 2))
    relevant = rel > 0
    n_rel = relevant.sum(1)
    ranked_relevant = np.take_along_axis(relevant, order, 1)

    def ndcg(k):
        dcg = (ranked_rel[:, :k] * disc[:k]).sum(1)
        idcg = (ideal[:, :k] * disc[:k]).sum(1)
        with np.errstate(invalid="ignore", divide="ignore"):
            v = np.where(idcg > 0, dcg / idcg, np.nan)
        return float(np.nanmean(v)) if np.isfinite(v).any() else float("nan")

    def recall(k):
        with np.errstate(invalid="ignore", divide="ignore"):
            v = np.where(n_rel > 0, ranked_relevant[:, :k].sum(1) / n_rel, np.nan)
        return float(np.nanmean(v)) if np.isfinite(v).any() else float("nan")

    has_top = top1 >= 0
    pos = (order == top1[:, None]).argmax(1) + 1
    out.update({
        "ndcg@10": ndcg(10), "ndcg@5": ndcg(5),
        "recall@5": recall(5), "recall@10": recall(10),
        "hit@1": float((order[has_top, 0] == top1[has_top]).mean()) if has_top.any() else float("nan"),
        "mrr": float((1.0 / pos[has_top]).mean()) if has_top.any() else float("nan"),
        "spearman_plausibility": _rowwise_spearman(scores, rel),
    })
    if member_level is not None and required_level is not None:
        req = np.asarray(required_level, dtype=np.float64)
        top_level = np.asarray(member_level, dtype=np.float64)[order[:, 0]]
        known = np.isfinite(req)
        out["overqualified_top1_rate"] = float((top_level[known] > req[known]).mean()) if known.any() else float("nan")
        out["underqualified_top1_rate"] = float((top_level[known] < req[known]).mean()) if known.any() else float("nan")
    return _nan_to_none(out)


def _rowwise_spearman(a: np.ndarray, b: np.ndarray) -> float:
    ra = rankdata(a, axis=1)
    rb = rankdata(b, axis=1)
    ra = ra - ra.mean(1, keepdims=True)
    rb = rb - rb.mean(1, keepdims=True)
    den = np.sqrt((ra ** 2).sum(1) * (rb ** 2).sum(1))
    with np.errstate(invalid="ignore", divide="ignore"):
        rho = np.where(den > 0, (ra * rb).sum(1) / den, np.nan)
    return float(np.nanmean(rho)) if np.isfinite(rho).any() else float("nan")


def level_ranks(levels) -> np.ndarray:
    return np.array([LEVEL_RANK.get(str(v), np.nan) for v in levels], dtype=np.float64)


def assignment_eval(scores, tasks: pd.DataFrame, data, with_slices: bool) -> tuple[dict, dict]:
    """Headline ranking metrics over the *classified* tasks (rows aligned with `scores`), plus README §5.8
    slices. Unclassified tasks are only reported as their own slice (and inside `all_tasks`)."""
    rel = data.relevance(tasks["Issue_ID"].to_numpy())
    member_level = level_ranks(data.members["level"])
    req = level_ranks(tasks["required_level"])
    uncl = tasks["unclassified"].to_numpy().astype(bool)

    def sub(mask):
        mask = np.asarray(mask, dtype=bool)
        return ranking_metrics(scores[mask], rel["rel"][mask], rel["top1"][mask], member_level, req[mask])

    overall = sub(~uncl)
    if not with_slices:
        return overall, {}
    slices = {"all_tasks": sub(np.ones(len(tasks), dtype=bool))}
    for area in sorted(tasks["primary_area"].dropna().unique()):
        slices[f"primary_area:{area}"] = sub(tasks["primary_area"] == area)
    for level in sorted(tasks["required_level"].dropna().unique(), key=lambda v: LEVEL_RANK.get(v, 99)):
        slices[f"required_level:{level}"] = sub(tasks["required_level"] == level)
    slices["classified"] = overall
    slices["unclassified"] = sub(uncl)
    held_idx = np.flatnonzero(np.isin(data.member_ids, data.held_out))
    slices["held_out_members"] = sub((rel["rel"][:, held_idx] > 0).any(1))
    return overall, slices
