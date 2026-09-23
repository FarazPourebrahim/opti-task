"""Checkpoint / resume store and single-instance lock (README §9).

State is one JSON file (`.state/state.json`) rewritten atomically after every transition.
"""
from __future__ import annotations

import json
import os
import socket
from pathlib import Path

from .common import atomic_write_json, now_iso, read_json

STATES = ("pending", "running", "completed", "failed", "skipped")


class StateStore:
    def __init__(self, state_dir: Path):
        self.path = Path(state_dir) / "state.json"
        self.data = read_json(self.path, default=None) or {"schema_version": 1, "units": {}}

    def get(self, run_id: str) -> dict:
        return self.data["units"].get(run_id, {})

    def status(self, run_id: str) -> str:
        return self.get(run_id).get("status", "pending")

    def set(self, run_id: str, status: str, **fields) -> None:
        assert status in STATES, status
        entry = self.data["units"].setdefault(run_id, {})
        entry.update(fields)
        entry["status"] = status
        entry["updated_at"] = now_iso()
        self.save()

    def save(self) -> None:
        atomic_write_json(self.path, self.data)


# ---------------------------------------------------------------- lock

def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.restype = wintypes.HANDLE
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return ctypes.get_last_error() == 5  # access denied => process exists
        try:
            code = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return True
            return code.value == 259  # STILL_ACTIVE
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class LockHeldError(RuntimeError):
    pass


class InstanceLock:
    """Lock file holding the owner's PID; a stale lock (dead PID on this host) is taken over."""

    def __init__(self, state_dir: Path):
        self.path = Path(state_dir) / "run.lock"
        self.owned = False

    def acquire(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps({"pid": os.getpid(), "host": socket.gethostname(), "started": now_iso()})
        for _ in range(2):
            try:
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except FileExistsError:
                info = read_json(self.path, default={}) or {}
                pid, host = int(info.get("pid", -1)), info.get("host")
                if host not in (None, socket.gethostname()):
                    raise LockHeldError(
                        f"Lock {self.path} is held by host {host!r} (pid {pid}); delete it manually if that run is gone.")
                if _pid_alive(pid) and pid != os.getpid():
                    raise LockHeldError(
                        f"Another OA2 run is active (pid {pid}, since {info.get('started')}). Lock: {self.path}")
                print(f"[OA2] Taking over stale lock from pid {pid}.", flush=True)
                try:
                    os.remove(self.path)
                except FileNotFoundError:
                    pass
                continue
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(payload)
            self.owned = True
            return
        raise LockHeldError(f"Could not acquire lock {self.path}")

    def release(self) -> None:
        if not self.owned:
            return
        info = read_json(self.path, default={}) or {}
        if int(info.get("pid", -1)) == os.getpid():
            try:
                os.remove(self.path)
            except FileNotFoundError:
                pass
        self.owned = False

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, *exc):
        self.release()
        return False
