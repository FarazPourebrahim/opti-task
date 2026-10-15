"""Export the trained model for production and verify the export (DESIGN.md §7).

Export = merge the LoRA adapter into the base weights, cast to the export dtype, save as a plain SentenceTransformer
folder, and write `inference_config.json`: the prompt and text templates the model was trained with, so the serving
code never has to guess them. Verification reloads that folder through `oa3.inference.AssigneeRanker` (the exact
production code path) and re-scores the test set; the result must match the in-memory model within a tolerance.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import torch

from .inference import CONFIG_FILE, FORMAT_VERSION, AssigneeRanker


def merge_and_save(model, cfg: dict, out_dir: Path, info: dict) -> dict:
    from oa2.common import atomic_write_json, rmtree
    from oa2.models import st_backbone, st_set_backbone
    st = model.st
    backbone = st_backbone(st)
    merged = backbone.merge_and_unload() if hasattr(backbone, "merge_and_unload") else backbone
    if hasattr(merged, "gradient_checkpointing_disable"):
        merged.gradient_checkpointing_disable()
    st_set_backbone(st, merged)
    dtype = cfg["export"]["dtype"]
    st.to(getattr(torch, dtype))
    st.eval()
    rmtree(out_dir)
    out_dir.mkdir(parents=True)
    # No auto model card: OA2's load_st detaches model_card_data (it leaked GPU memory); we write our own README.
    st.save(str(out_dir), create_model_card=False)
    config = {
        "format_version": FORMAT_VERSION,
        "model_name": info["run_id"],
        "task": "assignee ranking: score (task, team-member profile) pairs; higher = better fit",
        "base_model": cfg["model"]["hf_repo_id"],
        "base_revision": cfg["model"]["revision"],
        "base_local_path": cfg["model"].get("local_path"),  # set only when trained from a local folder (unverified)
        "license": cfg["model"]["license"],
        "architecture": "bi-encoder (shared encoder for tasks and profiles), last-token pooling, L2-normalised",
        "similarity": "cosine (dot product of the normalised embeddings)",
        "embedding_dim": int(st.get_sentence_embedding_dimension()),
        "dtype": dtype,
        "max_seq_len": int(cfg["training"]["max_seq_len"]),
        "max_text_chars": int(cfg["data"]["max_text_chars"]),
        "query_instruction": cfg["prompt"]["query_instruction"],
        "query_prefix": cfg["prompt"]["query_prefix_resolved"],
        "doc_prefix": cfg["prompt"]["doc_prefix"],
        "task_text_template": "[Project: {project_key}] [Type: {issue_type}] [Components: {components or 'none'}]\\n"
                              "{title}\\n{description}",
        "profile_text_template": "Level: {level}. Area: {area}. Years of experience: {years_experience}. "
                                 "Role: {role} ({role_class}).",
        "text_rules": "see oa3/inference.py: clean_text, task_text, profile_text (must be used unchanged)",
        "training": info["training_summary"],
        "test_metrics": info["test_metrics"],
        "data_fingerprint": info["data_fingerprint"],
        "git_commit": info["git_commit"],
        "created_at": info["created_at"],
    }
    atomic_write_json(out_dir / CONFIG_FILE, config)
    # Ship the self-contained loader and the data manifest with the weights.
    shutil.copy2(Path(__file__).with_name("inference.py"), out_dir / "inference.py")
    if info.get("manifest_dir"):
        shutil.copytree(info["manifest_dir"], out_dir / "training_data", dirs_exist_ok=True)
    (out_dir / "README.md").write_text(_model_card(config, info), encoding="utf-8")
    return config


def verify(out_dir: Path, data, device: str, reference_ndcg: float, tolerance: float, latency_cfg: dict) -> dict:
    """Reload the export with the production loader, re-score the test set, time single-task requests."""
    from oa2.metrics import assignment_eval
    from oa2.training import measure_latency
    ranker = AssigneeRanker.load(out_dir, device=device)
    test = data.split("test")
    member_vecs = ranker.embed_profile_texts(data.members["profile_text"].tolist())
    scores = ranker.scores(ranker.embed_task_texts(test["text"].tolist()), member_vecs)
    overall, _ = assignment_eval(scores, test, data, with_slices=False)
    diff = abs(float(overall["ndcg@10"]) - float(reference_ndcg))
    items = test["text"].tolist()[: int(latency_cfg["latency_samples"])]
    lat = measure_latency(lambda texts: ranker.scores(ranker.embed_task_texts(texts, batch_size=len(texts)),
                                                      member_vecs),
                          items, int(latency_cfg["latency_batch_tasks"]), int(latency_cfg["latency_warmup"]))
    loaded_dtype = str(next(ranker.model.parameters()).dtype).replace("torch.", "")
    return {"passed": diff <= tolerance, "ndcg@10_exported": overall["ndcg@10"], "ndcg@10_trained": reference_ndcg,
            "abs_diff": diff, "tolerance": tolerance, "device": device, "loaded_dtype": loaded_dtype,
            "latency": lat, "metrics_exported": overall}


def _model_card(config: dict, info: dict) -> str:
    m = config["test_metrics"]
    fmt = lambda v: "n/a" if v is None else f"{v:.4f}"  # noqa: E731
    return f"""# {config['model_name']}

Assignee-ranking model for opti-task, trained by OA3 (`apps/ai/training/OA3`). Fine-tuned from
`{config['base_model']}` @ `{config['base_revision'][:12]}` ({config['license']}) with LoRA, adapter merged.

**What it does:** turns a task text and a team-member profile into {config['embedding_dim']}-d vectors; the cosine
similarity of the two ranks members for the task. It does not generate text and cannot be prompted.

**Use it through `inference.py` in this folder** (copied from `oa3/inference.py`): it builds the task and profile
texts and the query prefix exactly as in training. Hand-built strings silently lower quality.
See `apps/ai/training/OA3/INTEGRATION.md`.

| Test metric (classified tasks) | Value |
|---|---|
| nDCG@10 | {fmt(m.get('ndcg@10'))} |
| hit@1 | {fmt(m.get('hit@1'))} |
| MRR | {fmt(m.get('mrr'))} |
| recall@10 | {fmt(m.get('recall@10'))} |
| held-out members nDCG@10 | {fmt(info.get('held_out_ndcg'))} |

Data fingerprint `{config['data_fingerprint']}`, git commit `{config['git_commit']}`, created {config['created_at']}.
`training_data/` lists every train/val/test task ID and the member table used.
"""
