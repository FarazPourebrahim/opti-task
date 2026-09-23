"""Shared training loop (README §7): AdamW + linear warmup/decay, gradient accumulation to the effective
batch, AMP, early stopping on the validation primary metric, best-checkpoint restore, latency timing."""
from __future__ import annotations

import gc
import math
import time
from pathlib import Path

import numpy as np
import torch

from .common import LOG
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


def fit(*, modules, param_groups, n_items, step_loss, evaluate, epochs, tcfg, per_device_batch, precision,
        work_dir: Path, seed: int) -> dict:
    """Train with early stopping; restore the best-validation weights into `modules` before returning.

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

    history, best, best_epoch, best_metrics, bad = [], -math.inf, None, None, 0
    LOG.info("Training: %d items, micro-batch %d x accum %d (effective %d), %d optimizer steps/epoch, max %d epochs",
             n_items, per_device_batch, accum, per_device_batch * accum, steps_per_epoch, epochs)
    for epoch in range(1, epochs + 1):
        t0 = time.perf_counter()
        for m in modules:
            m.train()
        batches = micro_batches(n_items, per_device_batch, seed, epoch)
        opt.zero_grad(set_to_none=True)
        loss_sum, loss_n, step = 0.0, 0, 0
        log_every = max(1, len(batches) // 20)
        for i, idx in enumerate(batches):
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
                step += 1
            if (i + 1) % log_every == 0:
                LOG.info("  epoch %d  micro-batch %d/%d  loss %.4f", epoch, i + 1, len(batches), loss_sum / loss_n)
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
            torch.save(_trainable_state(modules), best_path)
        else:
            bad += 1
            if bad >= tcfg["early_stopping_patience"]:
                LOG.info("Early stopping: no validation improvement for %d epoch(s).", bad)
                break
    del opt, sched, scaler
    free_memory()
    if best_path.exists():
        states = torch.load(best_path, map_location="cpu")
        for m, sd in zip(modules, states):
            m.load_state_dict(sd, strict=False)
    for m in modules:
        m.eval()
    return {"history": history, "best_epoch": best_epoch, "epochs_run": len(history), "best_val_metrics": best_metrics,
            "optimizer_steps_per_epoch": steps_per_epoch, "grad_accumulation": accum}


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
