"""Required baselines (README §4.6, §5.7). No download; evaluated exactly like model units."""
from __future__ import annotations

import time

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge

from ..common import rng_for, seed_everything
from ..metrics import assignment_eval, story_point_metrics, story_point_slices
from ..registry import BASELINE_SETTINGS
from ..training import measure_latency
from . import RunContext, limit_rows
from .assignment import _predictions as assignment_predictions
from .story_point import _predictions_frame as story_point_predictions


def run(ctx: RunContext, data) -> dict:
    seed_everything(ctx.seed)
    fn = {"median_per_project": _median_per_project, "tfidf_ridge": _tfidf_ridge, "random": _random,
          "popularity": _popularity, "tfidf_cosine": _tfidf_cosine}[ctx.unit.recipe]
    return fn(ctx, data)


def _tfidf() -> TfidfVectorizer:
    s = BASELINE_SETTINGS["tfidf"]
    return TfidfVectorizer(ngram_range=tuple(s["ngram_range"]), max_features=s["max_features"], dtype=np.float32)


def _no_training(train_time: float) -> dict:
    return {"history": [], "best_epoch": None, "epochs_run": 0, "train_time_s": train_time}


# ---------------------------------------------------------------- Task A

def _story_point_result(ctx, data, train, predict, n_params, train_time, note) -> dict:
    ctx.notes.append(note)
    k = len(data.buckets)
    val_pred = predict(data.val)
    test_pred = predict(data.test)
    tr = ctx.cfg["training"]
    rows = [data.test.iloc[[i]] for i in range(min(len(data.test), int(tr["latency_samples"])))]
    eff = measure_latency(lambda chunk: predict(_concat(chunk)), rows, int(tr["eval_batch"]),
                          int(tr["latency_warmup"]))
    return {
        "total_params": n_params, "trainable_params": n_params, "finetune_method": "none",
        "n_train": len(train), "n_val": len(data.val), "n_test": len(data.test),
        "training": _no_training(train_time),
        "metrics": {"zero_shot_val": None,
                    "val": story_point_metrics(data.val["bucket"], val_pred, data.val["raw_sp"], data.buckets),
                    "test": story_point_metrics(data.test["bucket"], test_pred, data.test["raw_sp"], data.buckets),
                    "slices": story_point_slices(data.test, test_pred, data.buckets)},
        "efficiency": eff,
        "predictions": story_point_predictions(data.test, test_pred, None, k),
    }


def _concat(frames):
    return pd.concat(frames, ignore_index=True)


def _median_per_project(ctx, data):
    train = limit_rows(ctx, data.train, "rows")
    t0 = time.perf_counter()
    med = train.groupby("project_key")["bucket"].median()
    fallback = float(train["bucket"].median())
    table = {p: int(np.floor(v + 0.5)) for p, v in med.items()}  # half-way medians round up (larger bucket)
    default = int(np.floor(fallback + 0.5))
    train_time = time.perf_counter() - t0

    def predict(df):
        return df["project_key"].map(table).fillna(default).astype(np.int64).to_numpy()
    return _story_point_result(ctx, data, train, predict, len(table), train_time,
                               "Median of the project's training bucket indices; a half-way median rounds up; "
                               "projects without training rows fall back to the global median.")


def _tfidf_ridge(ctx, data):
    train = limit_rows(ctx, data.train, "rows")
    k = len(data.buckets)
    t0 = time.perf_counter()
    vec = _tfidf()
    x = vec.fit_transform(train["text"])
    ridge = Ridge(alpha=BASELINE_SETTINGS["ridge_alpha"])
    ridge.fit(x, train["bucket"].to_numpy().astype(np.float64))
    train_time = time.perf_counter() - t0

    def predict(df):
        return np.clip(np.rint(ridge.predict(vec.transform(df["text"]))), 0, k - 1).astype(np.int64)
    return _story_point_result(ctx, data, train, predict, int(ridge.coef_.size + 1), train_time,
                               "TF-IDF (1-2-grams, 50k features, sklearn defaults otherwise) + Ridge(alpha=1.0) on "
                               "the bucket index, rounded and clipped to [0, 6]. total_params = ridge coefficients.")


# ---------------------------------------------------------------- Task B

def _assignment_result(ctx, data, n_train, score_fn, n_params, train_time, note) -> dict:
    ctx.notes.append(note)
    val, test = data.split("val"), data.split("test")
    val_overall, _ = assignment_eval(score_fn(val, "val"), val, data, with_slices=False)
    test_scores = score_fn(test, "test")
    test_overall, slices = assignment_eval(test_scores, test, data, with_slices=True)
    tr = ctx.cfg["training"]
    items = [test.iloc[[i]] for i in range(min(len(test), int(tr["latency_samples"])))]
    eff = measure_latency(lambda chunk: score_fn(_concat(chunk), "latency"), items, int(tr["latency_batch_tasks"]),
                          int(tr["latency_warmup"]))
    test_overall["latency_ms_per_task"] = eff["latency_ms_bs1_median"]
    return {
        "total_params": n_params, "trainable_params": n_params, "finetune_method": "none",
        "n_train": n_train, "n_val": len(val), "n_test": len(test),
        "training": _no_training(train_time),
        "metrics": {"zero_shot_val": None, "val": val_overall, "test": test_overall, "slices": slices},
        "efficiency": eff,
        "predictions": assignment_predictions(data, test, test_scores),
    }


def _random(ctx, data):
    m = len(data.members)

    def score(df, name):
        return rng_for(ctx.seed, f"baseline_random_{name}").random((len(df), m))
    return _assignment_result(ctx, data, 0, score, 0, 0.0, "Uniform random scores, seeded per split.")


def _popularity(ctx, data):
    ex = limit_rows(ctx, data.train_examples, "tasks")
    t0 = time.perf_counter()
    train_pairs = data.pairs[data.pairs["Issue_ID"].isin(ex["Issue_ID"]) & ~data.pairs["User_ID"].isin(data.held_out)]
    counts = train_pairs[train_pairs["Rank"] == 1]["User_ID"].value_counts()
    member_scores = data.members["User_ID"].map(counts).fillna(0).to_numpy(dtype=np.float64)
    train_time = time.perf_counter() - t0

    def score(df, _name):
        return np.tile(member_scores, (len(df), 1))
    return _assignment_result(ctx, data, len(ex), score, len(member_scores), train_time,
                              "Members ranked by how often they are Rank == 1 in the sampled training tasks "
                              "(held-out members excluded, so they score 0); ties broken by User_ID.")


def _tfidf_cosine(ctx, data):
    ex = limit_rows(ctx, data.train_examples, "tasks")
    t0 = time.perf_counter()
    train_texts = data.tasks.set_index("Issue_ID").loc[ex["Issue_ID"], "text"].tolist()
    profiles = data.members["profile_text"].tolist()
    vec = _tfidf()
    vec.fit(train_texts + profiles)
    prof = vec.transform(profiles)
    train_time = time.perf_counter() - t0

    def score(df, _name):
        return (vec.transform(df["text"]) @ prof.T).toarray()
    return _assignment_result(ctx, data, len(ex), score, len(vec.vocabulary_), train_time,
                              "TF-IDF (1-2-grams, 50k features) fitted on the training task texts plus the 48 "
                              "profiles; score = cosine(task, profile). total_params = vocabulary size.")
