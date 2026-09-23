#!/usr/bin/env python
"""OA2 model-selection benchmark: pull -> train -> test -> report -> erase, one run unit at a time, resumable.

See README.md in this folder for the full specification.

    python run_model_selection.py [--config config.yaml] [--task story_point|task_assignment|all]
        [--only KEY[,KEY...]] [--force RUN_ID|KEY] [--retry-failed] [--status] [--dry-run]
        [--keep-weights] [--limit-train N]
"""
from __future__ import annotations

import os

# Must be set before torch initialises CUDA (deterministic cuBLAS).
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import argparse
import sys
import traceback
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from oa2 import data as data_mod  # noqa: E402
from oa2 import registry, report  # noqa: E402
from oa2.checkpoint import InstanceLock, LockHeldError, StateStore  # noqa: E402
from oa2.common import (LOG, GracefulStop, UnitSkipped, environment_info, now_iso, rmtree,  # noqa: E402
                        setup_console_logging, unit_log_file)

REQUIRED_KEYS = ["seed", "dataset_dir", "output_dir", "tasks", "story_point", "task_assignment", "training", "models"]


# ---------------------------------------------------------------- config / CLI

def load_config(path: Path) -> dict:
    path = Path(path).resolve()
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    missing = [k for k in REQUIRED_KEYS if k not in cfg]
    if missing:
        raise SystemExit(f"config {path} is missing keys: {missing}")
    base = path.parent
    cfg["dataset_dir"] = str((base / cfg["dataset_dir"]).resolve())
    cfg["output_dir"] = str((base / cfg["output_dir"]).resolve())
    cfg["hf_cache_dir"] = str((base / cfg["hf_cache_dir"]).resolve()) if cfg.get("hf_cache_dir") else None
    cfg.setdefault("data", {}).setdefault("max_text_chars", 8000)
    keys = [m["key"] for m in cfg["models"]]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        raise SystemExit(f"duplicate model keys in config: {dupes}")
    if not Path(cfg["dataset_dir"]).is_dir():
        raise SystemExit(f"dataset_dir not found: {cfg['dataset_dir']}")
    return cfg


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="OA2 model-selection benchmark (see README.md).")
    p.add_argument("--config", default=str(HERE / "config.yaml"))
    p.add_argument("--task", choices=["story_point", "task_assignment", "all"], default="all")
    p.add_argument("--only", help="comma-separated model keys (baseline keys allowed) to run")
    p.add_argument("--force", action="append", default=[], help="re-run a completed/skipped unit: run_id or model key "
                                                                  "(repeatable, comma-separated allowed)")
    p.add_argument("--retry-failed", action="store_true", help="re-queue units in state 'failed'")
    p.add_argument("--status", action="store_true", help="print the unit table and exit")
    p.add_argument("--dry-run", action="store_true",
                   help="prepare data, verify repo ids, list units; no training")
    p.add_argument("--keep-weights", action="store_true", help="debugging: skip the erase step")
    p.add_argument("--limit-train", type=int, default=None,
                   help="smoke test: cap training rows/tasks (report marked smoke, excluded from leaderboard)")
    args = p.parse_args(argv)
    if args.limit_train is not None and args.limit_train <= 0:
        p.error("--limit-train must be positive")
    args.force = {x.strip() for f in args.force for x in f.split(",") if x.strip()}
    return args


def select_units(units, args):
    if args.task != "all":
        units = [u for u in units if u.task == args.task]
    if args.only:
        keys = {k.strip() for k in args.only.split(",") if k.strip()}
        unknown = keys - {u.model_key for u in units}
        if unknown:
            raise SystemExit(f"--only: unknown model key(s) for the selected task(s): {sorted(unknown)}")
        units = [u for u in units if u.model_key in keys]
    return units


# ---------------------------------------------------------------- status / dry run

def _counts(units, store) -> str:
    c = {"completed": 0, "running": 0, "failed": 0, "skipped": 0, "pending": 0}
    for u in units:
        c[store.status(u.run_id)] += 1
    return (f"{c['completed']} completed, {c['running']} interrupted, {c['failed']} failed, "
            f"{c['skipped']} skipped, {c['pending']} pending")


def print_status(units, store) -> None:
    print(f"{'#':>3}  {'status':<10} {'run_id':<72} reason")
    for u in units:
        e = store.get(u.run_id)
        status = e.get("status", "pending")
        shown = "interrupted" if status == "running" else status
        print(f"{u.order:>3}  {shown:<10} {u.run_id:<72} {e.get('reason') or ''}")
    print(f"\n{_counts(units, store)}")


def dry_run(cfg, units, fps, store) -> int:
    tasks = [t for t in registry.TASKS if any(u.task == t for u in units)]
    prepared = data_mod.prepare(cfg, tasks, fps)
    print("\n=== Data")
    if "story_point" in prepared:
        m = prepared["story_point"].meta
        print(f"story_point  fingerprint {fps['story_point']}")
        print(f"  issues with story points: {m.get('n_with_story_point')}, zeros dropped: {m.get('n_zero_dropped')}, "
              f"rows: {m.get('n_rows')}, projects: {m.get('n_projects')}")
        print(f"  split sizes: {m.get('split_sizes')}")
        print(f"  train label distribution: {m['label_distribution']['train']}")
    if "task_assignment" in prepared:
        d = prepared["task_assignment"]
        m = d.meta
        print(f"task_assignment  fingerprint {fps['task_assignment']}")
        print(f"  full chronological split (all issues): {m.get('full_split_sizes')}")
        print(f"  sampled tasks: {m.get('sampled_split_sizes')} (test unclassified: {m.get('test_unclassified')})")
        print(f"  held-out members: {d.held_out}")
        ex = d.train_examples
        n_pos = int(ex['positives'].map(len).sum())
        n_neg = int(ex['hard_negs'].map(len).sum() + ex['random_negs'].map(len).sum())
        print(f"  training tasks: {len(ex)}, positive pairs: {n_pos}, negative pairs: {n_neg}")

    print("\n=== Repository verification")
    seen = set()
    for u in units:
        if u.is_baseline or u.model_key in seen:
            continue
        seen.add(u.model_key)
        try:
            info = registry.verify_repo(u.entry)
            print(f"  OK       {u.model_key:<24} {u.repo}  @ {info['revision_sha']}"
                  + ("  (gated: needs HF_TOKEN + accepted license)" if info["gated"] else ""))
        except UnitSkipped as e:
            print(f"  SKIP     {u.model_key:<24} {u.repo}  -> {e.reason}")
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR    {u.model_key:<24} {u.repo}  -> {type(e).__name__}: {e}")

    print("\n=== Run units (execution order)")
    print_status(units, store)
    return 0


# ---------------------------------------------------------------- execution

def _execute_model(u, cfg, dat, path, precision, pdb, work, args, run_state):
    """Run the unit's recipe; on CUDA OOM retry once at half the micro-batch (same effective batch)."""
    import torch
    from oa2.recipes import RunContext, assignment, story_point
    from oa2.training import free_memory, is_oom

    recipe = story_point if u.task == "story_point" else assignment

    def attempt(batch):
        rmtree(work)
        if torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()
        ctx = RunContext(u, cfg, path, precision, batch, work, args.limit_train, [])
        res = recipe.run(ctx, dat)
        res["notes"] = ctx.notes
        return res

    try:
        return attempt(pdb)
    except Exception as e:  # noqa: BLE001
        if not is_oom(e) or pdb <= 1:
            raise
        LOG.warning("CUDA out of memory at per-device batch %d; retrying once at %d (accumulation doubled).",
                    pdb, pdb // 2)
    free_memory()  # outside the except block so the failed attempt's frames are released
    run_state["oom_retry"] = True
    run_state["per_device_batch"] = pdb // 2
    res = attempt(pdb // 2)
    res["notes"].insert(0, f"OOM at per-device batch {pdb}; retried once at {pdb // 2} with doubled gradient "
                           "accumulation (effective batch unchanged).")
    return res


def run_unit(u, cfg, dat, store, args, stop, env, keep_repo: bool) -> str:
    import torch
    from oa2.cleanup import erase_unit
    from oa2.models import resolve_precision
    from oa2.recipes import RunContext, baselines
    from oa2.training import is_oom

    out = Path(cfg["output_dir"])
    work = out / ".work" / u.run_id
    prev = store.status(u.run_id)
    with unit_log_file(report.log_path(out, u)):
        LOG.info("=" * 100)
        LOG.info("Unit %d: %s  (previous state: %s)", u.order, u.run_id, "interrupted" if prev == "running" else prev)
        with stop.critical():
            if prev == "running":
                LOG.warning("Unit was interrupted last time: wiping its work dir and partial outputs, restarting.")
            report.preserve_previous_outputs(out, u, partial=(prev == "running"))
            rmtree(work)
            store.set(u.run_id, "running", task=u.task, model_key=u.model_key, recipe=u.recipe, smoke=u.smoke,
                      started_at=now_iso(), attempts=int(store.get(u.run_id).get("attempts", 0)) + 1)

        started = now_iso()
        status, reason, error, result, revision = "completed", None, None, None, None
        run_state = {"oom_retry": False, "per_device_batch": int(u.hparams.get("per_device_batch", 1))}
        precision = "fp32" if u.is_baseline else resolve_precision(u.hparams.get("precision_override"))
        notes = []
        cuda = torch.cuda.is_available() and not u.is_baseline
        try:
            if u.is_baseline:
                ctx = RunContext(u, cfg, None, "fp32", 1, work, args.limit_train, notes)
                result = baselines.run(ctx, dat)
                notes.append("Baseline: CPU only; latency measured on CPU.")
            else:
                LOG.info("Verifying %s ...", u.repo)
                revision = registry.verify_repo(u.entry)["revision_sha"]
                if "bitnet" in u.model_key.lower():
                    notes.append("BitNet run through the standard Transformers/Sentence-Transformers path; its "
                                 "bitnet.cpp CPU-runtime speed was NOT measured.")
                path = registry.pull(u.repo, revision, cfg.get("hf_cache_dir"))
                LOG.info("Precision %s, per-device batch %d", precision, run_state["per_device_batch"])
                result = _execute_model(u, cfg, dat, path, precision, run_state["per_device_batch"], work, args,
                                        run_state)
                notes.extend(result.pop("notes", []))
        except UnitSkipped as e:
            status, reason = "skipped", e.reason
            error = {"type": "UnitSkipped", "message": str(e), "traceback": None}
            LOG.warning("Skipped: %s (%s)", e.reason, e)
        except KeyboardInterrupt:
            raise
        except Exception as e:  # noqa: BLE001 - failures never stop the run (README §9 rule 5)
            status = "failed"
            reason = "oom" if is_oom(e) else type(e).__name__
            error = {"type": type(e).__name__, "message": str(e), "traceback": traceback.format_exc()}
            LOG.error("Unit failed: %s: %s\n%s", type(e).__name__, e, error["traceback"])
        finished = now_iso()
        peak = round(torch.cuda.max_memory_allocated() / 2 ** 20, 1) if cuda else None
        if not u.is_baseline:
            notes.append("train_time_s covers the fit loop including the per-epoch validation passes.")
            notes.append("Mid-training resume is not implemented: an interrupted unit restarts from scratch.")
        if u.smoke:
            notes.append("SMOKE RUN: excluded from the leaderboard.")

        rep = report.build_report(
            u, status=status, reason=reason, result=result, revision=revision, fingerprint=dat.fingerprint,
            data_meta={**dat.meta, "held_out_member_ids": getattr(dat, "held_out", None)}, precision=precision,
            per_device_batch=run_state["per_device_batch"], oom_retry=run_state["oom_retry"], started=started,
            finished=finished, notes=notes, error=error, env=env, peak_mem_mb=peak)
        preds = (result or {}).pop("predictions", None)
        with stop.critical():  # write the report before deleting anything (README §8.4)
            if preds is not None and status == "completed":
                report.write_predictions(preds, report.predictions_path(out, u))
            report.write_report(out, u, rep)
            report.regenerate(out)
        del preds, result

        freed = 0
        if args.keep_weights:
            LOG.warning("--keep-weights: not erasing %s or the HF cache.", work)
        else:
            freed = erase_unit(work, None if u.is_baseline else u.repo, cfg.get("hf_cache_dir"), keep_repo)
        with stop.critical():
            rep["disk_freed_mb"] = round(freed / 2 ** 20, 1)
            report.write_report(out, u, rep)
            store.set(u.run_id, status, reason=reason, finished_at=finished,
                      error=None if error is None else {"type": error["type"], "message": error["message"][:2000]})
        LOG.info("Unit %s -> %s%s", u.run_id, status, f" ({reason})" if reason else "")
        return status


def run_all(cfg, units, fps, store, args, stop) -> int:
    LOG.info("State: %s", _counts(units, store))
    forced = args.force
    known = {u.run_id for u in units} | {u.model_key for u in units}
    for f in sorted(forced - known):
        LOG.warning("--force %s matches no selected unit.", f)
    queue = []
    for u in units:
        st = store.status(u.run_id)
        if u.run_id in forced or u.model_key in forced:
            queue.append(u)
        elif st in ("completed", "skipped"):
            continue
        elif st == "failed" and not args.retry_failed:
            continue
        else:
            queue.append(u)
    n_failed_left = sum(1 for u in units if store.status(u.run_id) == "failed" and u not in queue)
    if n_failed_left:
        LOG.info("%d failed unit(s) not re-queued (use --retry-failed).", n_failed_left)
    out = Path(cfg["output_dir"])
    if not queue:
        LOG.info("Nothing to run.")
        with stop.critical():
            report.regenerate(out)
        return 0
    LOG.info("Queue: %d unit(s), starting with %s", len(queue), queue[0].run_id)
    tasks = [t for t in registry.TASKS if any(u.task == t for u in queue)]
    prepared = data_mod.prepare(cfg, tasks, fps)
    env = environment_info()
    for i, u in enumerate(queue):
        nxt = queue[i + 1] if i + 1 < len(queue) else None
        keep_repo = bool(nxt and not nxt.is_baseline and u.repo and nxt.repo == u.repo)
        run_unit(u, cfg, prepared[u.task], store, args, stop, env, keep_repo)
    with stop.critical():
        report.regenerate(out)
    LOG.info("Done. State: %s", _counts(units, store))
    LOG.info("Reports: %s", out)
    return 0


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    args = parse_args(argv)
    setup_console_logging()
    cfg = load_config(Path(args.config))
    fps = data_mod.fingerprints(cfg)
    units = select_units(registry.build_units(cfg, fps, args.limit_train), args)
    state_dir = Path(cfg["output_dir"]) / ".state"
    store = StateStore(state_dir)

    if args.status:
        print_status(units, store)
        return 0
    if args.dry_run:
        return dry_run(cfg, units, fps, store)

    stop = GracefulStop()
    stop.install()
    try:
        with InstanceLock(state_dir):
            return run_all(cfg, units, fps, store, args, stop)
    except LockHeldError as e:
        LOG.error("%s", e)
        return 2
    except KeyboardInterrupt:
        LOG.warning("Stopped. The interrupted unit stays 'running' and will restart cleanly on the next start.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
