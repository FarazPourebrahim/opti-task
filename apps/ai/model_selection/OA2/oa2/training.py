"""Shared training loop (README §7): AdamW + linear warmup/decay, gradient accumulation to the effective
batch, AMP, early stopping on the validation primary metric, best-checkpoint restore, latency timing."""
from __future__ import annotations

import gc
import math
import os
import time
from pathlib import Path

import numpy as np
import torch

from .common import LOG, atomic_path, atomic_write_json, now_iso, read_json
from .models import autocast


def is_oom(exc: BaseException) -> bool:
    if isinstance(exc, torch.cuda.OutOfMemoryError):
        return True
    return isinstance(exc, RuntimeError) and "out of memory" in str(exc).lower()


def free_memory() -> None:
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def cuda_sync() -> None:
    if torch.cuda.is_available():
        torch.cuda.synchronize()


def micro_batches(n: int, size: int, seed: int, epoch: int) -> list[np.ndarray]:
    """Deterministic per-epoch shuffle, chunked into micro-batches of indices."""
    perm = np.random.default_rng([seed, epoch]).permutation(n)
    return [perm[i:i + size] for i in range(0, n, size)]


def _trainable_state(modules) -> list[dict]:
    return [{n: p.detach().to("cpu", copy=True) for n, p in m.named_parameters() if p.requires_grad}
            for m in modules]


# ---------------------------------------------------------------- mid-unit resume
# A unit interrupted mid-training (Ctrl+C, crash, power cut) continues from its last resume checkpoint instead of
# restarting from zero. The checkpoint lives in the unit's work dir (wiped on a fresh start, kept for an interrupted
# unit) and is written every RESUME_EVERY_S seconds (right after an optimizer step, so no gradient is half-accumulated)
# and at every epoch boundary. The interval is deliberately NOT a config key: it would change every run ID.
RESUME_FILE = "resume.pt"
RESUME_META = "resume_meta.json"
RESUME_EVERY_S = float(os.environ.get("OA2_RESUME_EVERY_MIN", "15")) * 60


def resume_meta(work_dir: Path) -> dict | None:
    """Small sidecar of the resume checkpoint (per-device batch etc.), readable without loading the checkpoint."""
    if not (Path(work_dir) / RESUME_FILE).exists():
        return None
    return read_json(Path(work_dir) / RESUME_META)


def _save_resume(work_dir: Path, modules, opt, sched, scaler, loop: dict, per_device_batch: int) -> None:
    t0 = time.perf_counter()
    state = {
        # Trainable tensors stay on the GPU here; torch.save copies them to host one storage at a time, so saving a
        # full fine-tune does not need a second full copy of the weights in RAM.
        "trainable": [{n: p.detach() for n, p in m.named_parameters() if p.requires_grad} for m in modules],
        "optimizer": opt.state_dict(), "scheduler": sched.state_dict(), "scaler": scaler.state_dict(),
        "rng_cpu": torch.get_rng_state(),
        "rng_cuda": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None,
        "loop": loop,
    }
    with atomic_path(Path(work_dir) / RESUME_FILE) as tmp:  # a crash mid-save keeps the previous checkpoint intact
        torch.save(state, tmp)
    atomic_write_json(Path(work_dir) / RESUME_META,
                      {"per_device_batch": per_device_batch, "epoch": loop["epoch"], "next_micro": loop["next_micro"],
                       "finished": loop["finished"], "saved_at": now_iso()})
    LOG.info("  resume checkpoint saved (epoch %d, micro-batch %d%s) in %.1fs", loop["epoch"], loop["next_micro"],
             ", training finished" if loop["finished"] else "", time.perf_counter() - t0)


def fit(*, modules, param_groups, n_items, step_loss, evaluate, epochs, tcfg, per_device_batch, precision,
        work_dir: Path, seed: int) -> dict:
    """Train with early stopping; restore the best-validation weights into `modules` before returning.
    If `work_dir` holds a matching resume checkpoint (an interrupted earlier attempt), continue from it.

    step_loss(idx: np.ndarray) -> scalar loss (called under autocast)
    evaluate() -> (primary: float, metrics: dict) on the validation split
    """
    from transformers import get_linear_schedule_with_warmup

    accum = max(1, tcfg["effective_batch"] // per_device_batch)
    n_micro = math.ceil(n_items / per_device_batch)
    steps_per_epoch = math.ceil(n_micro / accum)
    total_steps = max(1, steps_per_epoch * epochs)
    params = [p for g in param_groups for p in g["params"]]
    opt = torch.optim.AdamW(param_groups, weight_decay=tcfg["weight_decay"])
    sched = get_linear_schedule_with_warmup(opt, int(tcfg["warmup_ratio"] * total_steps), total_steps)
    scaler = torch.amp.GradScaler("cuda", enabled=(precision == "fp16" and torch.cuda.is_available()))
    work_dir.mkdir(parents=True, exist_ok=True)
    best_path = work_dir / "best.pt"
    shape = {"n_items": n_items, "per_device_batch": per_device_batch, "accum": accum, "epochs": epochs}

    history, best, best_epoch, best_metrics, bad = [], -math.inf, None, None, 0
    start_epoch, start_micro, loss_sum, loss_n = 1, 0, 0.0, 0
    finished, prior_s, resumed_from = False, 0.0, None
    resume_path = work_dir / RESUME_FILE
    if resume_path.exists():
        dev = next((p.device for p in params), torch.device("cpu"))
        state = torch.load(resume_path, map_location=dev, weights_only=False)
        loop = state["loop"]
        discard = None
        if loop.get("shape") != shape:
            discard = f"it does not match this training run ({loop.get('shape')} vs {shape})"
        elif loop["best_epoch"] is not None and not best_path.exists():
            discard = "its best.pt is missing (resuming would test the wrong weights)"
        if discard:
            LOG.warning("Discarding resume checkpoint: %s; starting training from scratch.", discard)
            for f in (resume_path, work_dir / RESUME_META, best_path):  # never let a stale best.pt be restored later
                f.unlink(missing_ok=True)
        else:
            for m, sd in zip(modules, state["trainable"]):
                m.load_state_dict(sd, strict=False)
            opt.load_state_dict(state["optimizer"])
            sched.load_state_dict(state["scheduler"])
            scaler.load_state_dict(state["scaler"])
            torch.set_rng_state(state["rng_cpu"].cpu())
            if state["rng_cuda"] is not None and torch.cuda.is_available():
                torch.cuda.set_rng_state_all([s.cpu() for s in state["rng_cuda"]])
            history, best, best_epoch, best_metrics, bad = (loop["history"], loop["best"], loop["best_epoch"],
                                                            loop["best_metrics"], loop["bad"])
            start_epoch, start_micro = loop["epoch"], loop["next_micro"]
            loss_sum, loss_n, finished, prior_s = loop["loss_sum"], loop["loss_n"], loop["finished"], loop["elapsed_s"]
            resumed_from = {"epoch": start_epoch, "micro_batch": start_micro, "training_finished": finished}
            LOG.warning("RESUMING from checkpoint: epoch %d, micro-batch %d%s (%.0f s of training already done).",
                        start_epoch, start_micro, ", training already finished" if finished else "", prior_s)
        del state
        free_memory()

    t_fit = time.perf_counter()
    last_save = time.perf_counter()

    def loop_state(epoch, next_micro, done=False):
        return {"shape": shape, "epoch": epoch, "next_micro": next_micro, "loss_sum": loss_sum, "loss_n": loss_n,
                "history": history, "best": best, "best_epoch": best_epoch, "best_metrics": best_metrics, "bad": bad,
                "finished": done, "elapsed_s": prior_s + time.perf_counter() - t_fit}

    LOG.info("Training: %d items, micro-batch %d x accum %d (effective %d), %d optimizer steps/epoch, max %d epochs",
             n_items, per_device_batch, accum, per_device_batch * accum, steps_per_epoch, epochs)
    epoch = start_epoch
    while not finished and epoch <= epochs:
        t0 = time.perf_counter()
        for m in modules:
            m.train()
        batches = micro_batches(n_items, per_device_batch, seed, epoch)
        opt.zero_grad(set_to_none=True)
        first = start_micro if epoch == start_epoch else 0
        if first == 0:
            loss_sum, loss_n = 0.0, 0
        log_every = max(1, len(batches) // 20)
        for i in range(first, len(batches)):
            idx = batches[i]
            with autocast(precision):
                loss = step_loss(idx)
            scaler.scale(loss / accum).backward()
            loss_sum += float(loss.detach())
            loss_n += 1
            if (i + 1) % accum == 0 or i == len(batches) - 1:
                scaler.unscale_(opt)
                torch.nn.utils.clip_grad_norm_(params, tcfg["max_grad_norm"])
                scaler.step(opt)
                scaler.update()
                sched.step()
                opt.zero_grad(set_to_none=True)
                if time.perf_counter() - last_save >= RESUME_EVERY_S and i + 1 < len(batches):
                    _save_resume(work_dir, modules, opt, sched, scaler, loop_state(epoch, i + 1), per_device_batch)
                    last_save = time.perf_counter()
            if (i + 1) % log_every == 0:
                LOG.info("  epoch %d  micro-batch %d/%d  loss %.4f", epoch, i + 1, len(batches), loss_sum / loss_n)
        # Epoch's training part is done: checkpoint before the (possibly long) validation pass.
        _save_resume(work_dir, modules, opt, sched, scaler, loop_state(epoch, len(batches)), per_device_batch)
        last_save = time.perf_counter()
        for m in modules:
            m.eval()
        with torch.no_grad():
            primary, metrics = evaluate()
        primary_cmp = primary if primary is not None and math.isfinite(primary) else -math.inf
        history.append({"epoch": epoch, "train_loss": loss_sum / max(loss_n, 1), "val_primary": primary,
                        "epoch_time_s": round(time.perf_counter() - t0, 2)})
        LOG.info("Epoch %d done: train_loss %.4f  val_primary %s  (%.0fs)", epoch, loss_sum / max(loss_n, 1),
                 primary, time.perf_counter() - t0)
        if primary_cmp > best:
            best, best_epoch, best_metrics, bad = primary_cmp, epoch, metrics, 0
            with atomic_path(best_path) as tmp:  # a power cut mid-write must not leave a corrupt best.pt
                torch.save(_trainable_state(modules), tmp)
        else:
            bad += 1
            if bad >= tcfg["early_stopping_patience"]:
                LOG.info("Early stopping: no validation improvement for %d epoch(s).", bad)
                finished = True
        epoch += 1
        finished = finished or epoch > epochs
        loss_sum, loss_n = 0.0, 0
        _save_resume(work_dir, modules, opt, sched, scaler, loop_state(epoch, 0, finished), per_device_batch)
        last_save = time.perf_counter()
    train_elapsed = prior_s + time.perf_counter() - t_fit
    del opt, sched, scaler
    free_memory()
    if best_path.exists():
        states = torch.load(best_path, map_location="cpu")
        for m, sd in zip(modules, states):
            m.load_state_dict(sd, strict=False)
    for m in modules:
        m.eval()
    return {"history": history, "best_epoch": best_epoch, "epochs_run": len(history), "best_val_metrics": best_metrics,
            "optimizer_steps_per_epoch": steps_per_epoch, "grad_accumulation": accum,
            "resumed_from": resumed_from, "train_time_prior_s": prior_s, "fit_elapsed_s": train_elapsed}


def measure_latency(run_one, items: list, batch_size: int, warmup: int) -> dict:
    """Median per-item latency at batch size 1 and at `batch_size` (README §7), after `warmup` calls."""
    if not items:
        return {"latency_ms_bs1_median": None, "latency_ms_batched_median": None,
                "batch_size_for_latency": batch_size, "throughput_items_per_s": None, "n_timed": 0}
    with torch.no_grad():
        for i in range(warmup):
            run_one([items[i % len(items)]])
        single = []
        for it in items:
            cuda_sync()
            t = time.perf_counter()
            run_one([it])
            cuda_sync()
            single.append((time.perf_counter() - t) * 1000)
        batched = []
        for i in range(0, len(items), batch_size):
            chunk = items[i:i + batch_size]
            cuda_sync()
            t = time.perf_counter()
            run_one(chunk)
            cuda_sync()
            batched.append((time.perf_counter() - t) * 1000 / len(chunk))
    med_b = float(np.median(batched))
    return {"latency_ms_bs1_median": float(np.median(single)), "latency_ms_batched_median": med_b,
            "batch_size_for_latency": batch_size, "throughput_items_per_s": 1000.0 / med_b if med_b > 0 else None,
            "n_timed": len(items)}
