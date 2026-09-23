"""Shared helpers: hashing, atomic writes, seeding, logging, environment info, graceful stop."""
from __future__ import annotations

import contextlib
import hashlib
import json
import logging
import math
import os
import platform
import random
import shutil
import signal
import socket
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

LOG = logging.getLogger("oa2")


class UnitSkipped(Exception):
    """Raised when a unit must be marked `skipped` (README §6.1), e.g. unverified or gated repo."""

    def __init__(self, reason: str, message: str = ""):
        super().__init__(message or reason)
        self.reason = reason


# ---------------------------------------------------------------- hashing / json

def to_jsonable(obj):
    """Recursively convert numpy / path / NaN values into strict-JSON-safe Python values."""
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return to_jsonable(obj.tolist())
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        v = float(obj)
        return v if math.isfinite(v) else None
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, Path):
        return str(obj)
    return obj


def stable_hash(obj, n: int | None = None) -> str:
    text = json.dumps(to_jsonable(obj), sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return digest[:n] if n else digest


# ---------------------------------------------------------------- atomic writes

@contextlib.contextmanager
def atomic_path(path: Path):
    """Yield a temp path next to `path`; on success it is renamed over `path`."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    os.close(fd)
    try:
        yield Path(tmp)
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def atomic_write_text(path: Path, text: str) -> None:
    with atomic_path(path) as tmp:
        with open(tmp, "w", encoding="utf-8", newline="") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())


def atomic_write_json(path: Path, obj) -> None:
    atomic_write_text(path, json.dumps(to_jsonable(obj), indent=2, ensure_ascii=False) + "\n")


def read_json(path: Path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


# ---------------------------------------------------------------- filesystem

def dir_size_bytes(path: Path) -> int:
    path = Path(path)
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    total = 0
    for p in path.rglob("*"):
        with contextlib.suppress(OSError):
            if p.is_file() and not p.is_symlink():
                total += p.stat().st_size
    return total


def rmtree(path: Path) -> None:
    def _onerror(func, p, _exc):
        with contextlib.suppress(OSError):
            os.chmod(p, 0o700)
            func(p)
    path = Path(path)
    if path.exists():
        shutil.rmtree(path, onerror=_onerror)


# ---------------------------------------------------------------- seeding

def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed % (2 ** 32))
    try:
        import torch
    except ImportError:
        return
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    torch.use_deterministic_algorithms(True, warn_only=True)


def rng_for(seed: int, name: str) -> np.random.Generator:
    """Independent deterministic generator per purpose, so adding one draw never shifts another."""
    return np.random.default_rng([seed, int(hashlib.md5(name.encode()).hexdigest()[:8], 16)])


# ---------------------------------------------------------------- time / logging

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


_FMT = logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S")


def setup_console_logging() -> None:
    LOG.setLevel(logging.INFO)
    if not LOG.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(_FMT)
        LOG.addHandler(h)
    LOG.propagate = False


@contextlib.contextmanager
def unit_log_file(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    h = logging.FileHandler(path, encoding="utf-8")
    h.setFormatter(_FMT)
    LOG.addHandler(h)
    try:
        yield
    finally:
        LOG.removeHandler(h)
        h.close()


# ---------------------------------------------------------------- environment

def _version(pkg: str):
    from importlib import metadata
    try:
        return metadata.version(pkg)
    except metadata.PackageNotFoundError:
        return None


def environment_info() -> dict:
    info = {
        "python": platform.python_version(),
        "torch": _version("torch"),
        "transformers": _version("transformers"),
        "sentence_transformers": _version("sentence-transformers"),
        "peft": _version("peft"),
        "huggingface_hub": _version("huggingface_hub"),
        "scikit_learn": _version("scikit-learn"),
        "pandas": _version("pandas"),
        "numpy": _version("numpy"),
        "cuda": None,
        "gpu": None,
        "os": f"{platform.system()} {platform.release()} ({platform.version()})",
        "hostname_hash": hashlib.sha256(socket.gethostname().encode()).hexdigest()[:12],
    }
    try:
        import torch
        info["cuda"] = torch.version.cuda
        if torch.cuda.is_available():
            info["gpu"] = torch.cuda.get_device_name(0)
    except ImportError:
        pass
    return info


def git_commit(start: Path) -> str | None:
    """Read HEAD's commit from the .git folder directly (no git subprocess)."""
    for d in [Path(start).resolve(), *Path(start).resolve().parents]:
        git = d / ".git"
        if git.is_file():  # worktree: "gitdir: <path>"
            text = git.read_text(encoding="utf-8").strip()
            if text.startswith("gitdir:"):
                git = (d / text.split(":", 1)[1].strip()).resolve()
        if git.is_dir():
            head = (git / "HEAD").read_text(encoding="utf-8").strip()
            if not head.startswith("ref:"):
                return head
            ref = head.split(":", 1)[1].strip()
            for base in (git, _common_dir(git)):
                ref_file = base / ref
                if ref_file.exists():
                    return ref_file.read_text(encoding="utf-8").strip()
                packed = base / "packed-refs"
                if packed.exists():
                    for line in packed.read_text(encoding="utf-8").splitlines():
                        if line.endswith(" " + ref):
                            return line.split(" ", 1)[0]
            return None
    return None


def _common_dir(git: Path) -> Path:
    common = git / "commondir"
    if common.exists():
        return (git / common.read_text(encoding="utf-8").strip()).resolve()
    return git


# ---------------------------------------------------------------- graceful stop (README §9 rule 8)

class GracefulStop:
    """First Ctrl+C/SIGTERM: stop at the next safe point (never inside a critical section).
    Second one: exit immediately."""

    def __init__(self):
        self.requested = False
        self._critical = 0

    def install(self) -> None:
        signal.signal(signal.SIGINT, self._handler)
        for name in ("SIGTERM", "SIGBREAK"):
            sig = getattr(signal, name, None)
            if sig is not None:
                with contextlib.suppress(OSError, ValueError):
                    signal.signal(sig, self._handler)

    def _handler(self, signum, _frame):
        if self.requested:
            print("\n[OA2] Second interrupt: exiting immediately.", flush=True)
            os._exit(130)
        self.requested = True
        print(f"\n[OA2] Stop requested (signal {signum}); finishing writes, press Ctrl+C again to force.", flush=True)
        if self._critical == 0:
            raise KeyboardInterrupt

    @contextlib.contextmanager
    def critical(self):
        """Writes of state/reports run to completion even if a stop is requested meanwhile."""
        self._critical += 1
        try:
            yield
        finally:
            self._critical -= 1
        if self._critical == 0 and self.requested:
            raise KeyboardInterrupt
