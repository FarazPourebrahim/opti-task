"""Per-task training/evaluation recipes. Every recipe returns a result dict consumed by report.build_report."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ..common import LOG, rng_for


@dataclass
class RunContext:
    unit: object                 # registry.Unit
    cfg: dict
    snapshot_path: str | None
    precision: str
    per_device_batch: int
    work_dir: Path
    limit_train: int | None
    notes: list = field(default_factory=list)

    @property
    def tcfg(self) -> dict:
        return self.unit.hparams

    @property
    def seed(self) -> int:
        return int(self.cfg["seed"])

    @property
    def eval_batch(self) -> int:
        """Eval batch shrinks in proportion when the OOM retry halves the training micro-batch."""
        t = self.tcfg
        return max(1, int(t["eval_batch"]) * self.per_device_batch // int(t["per_device_batch"]))


def limit_rows(ctx: RunContext, df: pd.DataFrame, what: str) -> pd.DataFrame:
    """--limit-train smoke mode: deterministic random subset of the training rows."""
    n = ctx.limit_train
    if not n or len(df) <= n:
        return df
    idx = np.sort(rng_for(ctx.seed, "limit_train").choice(len(df), size=n, replace=False))
    ctx.notes.append(f"SMOKE RUN: training {what} capped at {n} of {len(df)} (--limit-train).")
    LOG.info("Smoke mode: %s capped at %d of %d", what, n, len(df))
    return df.iloc[idx].reset_index(drop=True)


def chunks(seq, size: int):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]
