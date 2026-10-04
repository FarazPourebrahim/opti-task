"""Erase step (README §8.5): training work dir and the model's Hugging Face cache entry."""
from __future__ import annotations

from pathlib import Path

from .common import LOG, dir_size_bytes, rmtree
from .training import RESUME_FILE, RESUME_META, free_memory


def erase_work_dir(path: Path) -> int:
    size = dir_size_bytes(path)
    # Resume files go first: a crash part-way through this delete must never leave a resumable checkpoint
    # without the best.pt it depends on.
    for name in (RESUME_META, RESUME_FILE):
        (Path(path) / name).unlink(missing_ok=True)
    rmtree(path)
    return size


def erase_hf_repo(repo_id: str | None, cache_dir: str | None) -> int:
    """Delete every cached revision of `repo_id`; returns bytes freed."""
    if not repo_id:
        return 0
    from huggingface_hub import scan_cache_dir
    try:
        info = scan_cache_dir(cache_dir)
    except Exception as e:  # noqa: BLE001 - cache may not exist yet
        LOG.warning("Could not scan HF cache: %s", e)
        return 0
    freed = 0
    for repo in info.repos:
        if repo.repo_id == repo_id and repo.repo_type == "model":
            hashes = [r.commit_hash for r in repo.revisions]
            if hashes:
                strategy = info.delete_revisions(*hashes)
                freed += strategy.expected_freed_size
                strategy.execute()
            rmtree(Path(repo.repo_path))  # leftovers (refs, .no_exist)
    return freed


def erase_unit(work_dir: Path, repo_id: str | None, cache_dir: str | None, keep_repo: bool,
               keep_work: bool = False) -> int:
    free_memory()
    freed = 0 if keep_work else erase_work_dir(work_dir)
    if keep_repo:
        LOG.info("Keeping %s in the HF cache: the next unit uses it.", repo_id)
    else:
        freed += erase_hf_repo(repo_id, cache_dir)
    free_memory()
    LOG.info("Erased weights/checkpoints: %.1f MB freed.", freed / 2 ** 20)
    import torch
    if torch.cuda.is_available():  # leak guard: a model left on the GPU makes every later unit run out of memory
        left_mb = torch.cuda.memory_allocated() / 2 ** 20
        if left_mb > LEAK_WARN_MB:
            LOG.warning("GPU memory still allocated after this unit: %.0f MB -- possible leak; later units may run "
                        "out of memory.", left_mb)
        else:
            LOG.info("GPU memory still allocated after this unit: %.0f MB (normal overhead).", left_mb)
    return freed


LEAK_WARN_MB = 256  # cuBLAS workspaces and similar fixed overhead stay well below this
