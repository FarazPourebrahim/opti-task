#!/usr/bin/env python
"""OA3: train, evaluate, export and verify the production assignee-ranking model. See README.md.

    python train_assignee.py                                  # full run (resumable: just run it again)
    python train_assignee.py --prepare-only                   # build the data + manifests, print sizes, no training
    python train_assignee.py --limit-train 50 --limit-eval 50 # smoke run, separate run ID, minutes not hours

Stages (each is skipped when its output already exists for this run ID):
  1 prepare data  2 download model  3 train (resumes from .work/<run_id>/)  4 test  5 compare with OA2
  6 export (artifacts/<run_id>/model/)  7 verify the export  8 write reports/<run_id>/
"""
from __future__ import annotations

import os

# Must be set before torch initialises CUDA (deterministic cuBLAS), as in OA2.
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import argparse
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from oa3.config import import_oa2, load_config, run_id  # noqa: E402


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="OA3: train the production assignee-ranking model (see README.md).")
    p.add_argument("--config", default=str(HERE / "config.yaml"))
    p.add_argument("--prepare-only", action="store_true", help="build data and manifests, print sizes, then stop")
    p.add_argument("--limit-train", type=int, default=None, help="smoke run: cap the number of training tasks")
    p.add_argument("--limit-eval", type=int, default=None, help="smoke run: cap the number of val and test tasks")
    p.add_argument("--device", default=None, help="override the device (e.g. cpu); default: cuda if available")
    args = p.parse_args(argv)
    for name in ("limit_train", "limit_eval"):
        v = getattr(args, name)
        if v is not None and v <= 0:
            p.error(f"--{name.replace('_', '-')} must be positive")
    return args


def main(argv=None) -> int:
    args = parse_args(argv)
    if args.device == "cpu":
        os.environ["CUDA_VISIBLE_DEVICES"] = ""          # oa2.models.get_device() then picks the CPU
    cfg = load_config(Path(args.config))
    import_oa2(cfg)

    from oa2.common import (LOG, atomic_write_json, environment_info, git_commit, now_iso, seed_everything,
                            setup_console_logging, unit_log_file)
    from oa3 import data as data_mod
    setup_console_logging()

    # ---- 1. data
    t0 = time.perf_counter()
    full = data_mod.prepare(cfg)
    rid = run_id(cfg, full.fingerprint, args.limit_train, args.limit_eval)
    data = data_mod.apply_limits(full, args.limit_train, args.limit_eval, int(cfg["seed"]))
    report_dir = HERE / "reports" / rid
    manifest_dir = report_dir / "data"
    data_mod.write_manifest(data, manifest_dir)
    meta = full.meta
    LOG.info("Run %s | data %s | pools %s | sampled %s | training tuples %d | held-out members %s",
             rid, full.fingerprint, meta["available_classified_pools"], meta["sampled_split_sizes"],
             meta["n_training_tuples"], full.held_out)
    if args.prepare_only:
        LOG.info("--prepare-only: manifests written to %s", manifest_dir)
        return 0

    with unit_log_file(HERE / "logs" / f"{rid}.log"):
        return _run(cfg, args, data, rid, report_dir, manifest_dir, t0, LOG, atomic_write_json, environment_info,
                    git_commit, now_iso, seed_everything)


def _run(cfg, args, data, rid, report_dir, manifest_dir, t0, LOG, atomic_write_json, environment_info, git_commit,
         now_iso, seed_everything) -> int:
    import torch
    from oa2.metrics import assignment_eval  # noqa: F401  (imported early so a broken oa2 fails before training)
    from oa2.models import count_params, resolve_precision
    from oa2.registry import pull
    from oa2.report import write_predictions
    from oa2.training import free_memory
    from oa3.compare import compare_with_oa2
    from oa3.export import merge_and_save, verify
    from oa3.trainer import BiEncoder, evaluate_test, predictions_frame, train

    started = now_iso()
    precision = resolve_precision(cfg["training"].get("precision"))
    device = "cuda" if torch.cuda.is_available() else "cpu"
    LOG.info("Device %s, precision %s", device, precision)

    # ---- 2. model (pinned revision, HF cache; or a local folder on machines without Hugging Face access)
    snapshot = cfg["model"].get("local_path")
    if snapshot:
        LOG.warning("Using the local model folder %s; the pinned revision is NOT checked.", snapshot)
    else:
        snapshot = pull(cfg["model"]["hf_repo_id"], cfg["model"]["revision"], cfg.get("hf_cache_dir"))

    # ---- 3. train (resumes automatically; a finished run just restores its best epoch)
    seed_everything(int(cfg["seed"]))
    model = BiEncoder(cfg, snapshot, precision)
    total, trainable = count_params(model.enc)
    LOG.info("Parameters: %d total, %d trainable (LoRA)", total, trainable)
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()
    fit_out = train(model, data, HERE / ".work" / rid)
    peak_mb = torch.cuda.max_memory_allocated() / 2 ** 20 if torch.cuda.is_available() else None

    # ---- 4. test
    LOG.info("Testing the best epoch (%s) on %d test tasks ...", fit_out["best_epoch"], len(data.split("test")))
    overall, slices, scores = evaluate_test(model.score_tasks, model.refresh_members, data)
    held_ndcg = slices["held_out_members"].get("ndcg@10")
    LOG.info("Test ndcg@10 %.4f  hit@1 %.4f  mrr %.4f  held-out ndcg@10 %s", overall["ndcg@10"], overall["hit@1"],
             overall["mrr"], held_ndcg)
    report_dir.mkdir(parents=True, exist_ok=True)
    write_predictions(predictions_frame(data, scores), report_dir / "test_predictions.csv.gz")

    # ---- 5. paired comparison with OA2 (same test tasks)
    ev = cfg["evaluation"]
    comparison = compare_with_oa2(data, scores, ev.get("oa2_reference_predictions"), int(ev["bootstrap_resamples"]),
                                  int(cfg["seed"]))
    if comparison.get("delta") is not None:
        LOG.info("vs OA2 (same %d test tasks): OA3 %.4f vs OA2 %.4f, delta %+.4f, 95%% CI [%+.4f, %+.4f]",
                 comparison["n_tasks"], comparison["ndcg@10_oa3"], comparison["ndcg@10_oa2"], comparison["delta"],
                 *comparison["delta_ci95"])
    else:
        LOG.info("No paired comparison with OA2: %s", comparison.get("reason"))

    # ---- 6. export
    commit = git_commit(HERE)
    training_summary = {
        "recipe": "OA2 bi-encoder: LoRA r16/a32 all-linear, MNRL scale 20 with relevant in-batch masking, "
                  "4 hard + 2 random (+1 over-qualified) negatives",
        "train_tasks": int((data.tasks["split"] == "train").sum()), "training_tuples": fit_out["n_training_tuples"],
        "epochs_run": fit_out["epochs_run"], "best_epoch": fit_out["best_epoch"],
        "held_out_member_ids": data.held_out, "train_time_s": round(fit_out["train_time_s"], 1),
    }
    export_dir = HERE / "artifacts" / rid / "model"
    LOG.info("Exporting the merged model to %s ...", export_dir)
    export_cfg = merge_and_save(model, cfg, export_dir, {
        "run_id": rid, "training_summary": training_summary, "test_metrics": overall, "held_out_ndcg": held_ndcg,
        "data_fingerprint": data.fingerprint, "git_commit": commit, "created_at": now_iso(),
        "manifest_dir": manifest_dir})
    del model
    free_memory()

    # ---- 7. verify the export through the production loader
    LOG.info("Verifying the export (reload with oa3.inference.AssigneeRanker, re-score the test set) ...")
    verification = verify(export_dir, data, device, overall["ndcg@10"], float(cfg["export"]["verify_tolerance"]), ev)
    LOG.info("Verification %s: exported ndcg@10 %.4f vs trained %.4f (|diff| %.5f, tolerance %.4f); "
             "latency %.1f ms/task at batch 1 (%s, %s)", "PASSED" if verification["passed"] else "FAILED",
             verification["ndcg@10_exported"], verification["ndcg@10_trained"], verification["abs_diff"],
             verification["tolerance"], verification["latency"]["latency_ms_bs1_median"] or float("nan"),
             device, verification["loaded_dtype"])

    # ---- 8. report
    report = {
        "schema_version": 1, "run_id": rid, "status": "completed" if verification["passed"] else "export_mismatch",
        "smoke": bool(args.limit_train or args.limit_eval),
        "model": {"hf_repo_id": cfg["model"]["hf_repo_id"], "revision": cfg["model"]["revision"],
                  "local_path": cfg["model"].get("local_path"),
                  "total_params": total, "trainable_params": trainable, "precision": precision},
        "config": {k: cfg[k] for k in ("seed", "data", "prompt", "training", "export")},
        "data": {**{k: v for k, v in data.meta.items() if k != "held_out"},
                 "manifest": manifest_dir.relative_to(HERE).as_posix()},
        "training": {"train_tasks": training_summary["train_tasks"],
                     **{k: v for k, v in fit_out.items() if k not in ("best_val_metrics", "zero_shot_val")}},
        "metrics": {"zero_shot_val": fit_out["zero_shot_val"], "val": fit_out["best_val_metrics"], "test": overall,
                    "slices": slices},
        "comparison_with_oa2": comparison,
        "export": {"path": export_dir.relative_to(HERE).as_posix(), "inference_config": export_cfg},
        "verification": verification,
        "efficiency": {"peak_gpu_mem_mb": peak_mb, "latency_exported": verification["latency"]},
        "environment": environment_info(), "git_commit": commit,
        "timestamps": {"started_at": started, "finished_at": now_iso(), "wall_s": round(time.perf_counter() - t0, 1)},
    }
    atomic_write_json(report_dir / "report.json", report)
    (report_dir / "SUMMARY.md").write_text(_summary(report), encoding="utf-8")
    LOG.info("Report: %s", report_dir / "report.json")
    return 0 if verification["passed"] else 2


def _summary(r: dict) -> str:
    t, c, v = r["metrics"]["test"], r["comparison_with_oa2"], r["verification"]
    f = lambda x: "n/a" if x is None else f"{x:.4f}"  # noqa: E731
    lines = [f"# {r['run_id']}", "", f"Status: **{r['status']}**{' (SMOKE RUN - not a production model)' if r['smoke'] else ''}", "",
             "| | Value |", "|---|---|",
             f"| Train tasks / tuples | {r['training']['train_tasks']} / {r['training']['n_training_tuples']} |",
             f"| Epochs run / best | {r['training']['epochs_run']} / {r['training']['best_epoch']} |",
             f"| Train time | {r['training']['train_time_s'] / 3600:.2f} h |",
             f"| Zero-shot val nDCG@10 | {f(r['metrics']['zero_shot_val'].get('ndcg@10'))} |",
             f"| Best val nDCG@10 | {f((r['metrics']['val'] or {}).get('ndcg@10'))} |",
             f"| **Test nDCG@10** | **{f(t.get('ndcg@10'))}** |",
             f"| Test hit@1 / MRR / recall@10 | {f(t.get('hit@1'))} / {f(t.get('mrr'))} / {f(t.get('recall@10'))} |",
             f"| Held-out members nDCG@10 | {f(r['metrics']['slices']['held_out_members'].get('ndcg@10'))} |",
             f"| Unclassified slice nDCG@10 | {f(r['metrics']['slices']['unclassified'].get('ndcg@10'))} |"]
    if c.get("delta") is not None:
        lines.append(f"| vs OA2 (same test tasks) | {c['delta']:+.4f} [{c['delta_ci95'][0]:+.4f}, {c['delta_ci95'][1]:+.4f}] |")
    lines += [f"| Export verification | {'passed' if v['passed'] else 'FAILED'} (|diff| {v['abs_diff']:.5f}) |",
              f"| Latency (exported, batch 1) | {v['latency']['latency_ms_bs1_median']:.1f} ms on {v['device']} ({v['loaded_dtype']}) |",
              "", f"Model folder: `{r['export']['path']}` (not committed). Full record: `report.json`.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
