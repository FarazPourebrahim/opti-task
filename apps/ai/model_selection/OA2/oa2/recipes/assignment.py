"""Task B - assignee ranking (README §5, §6.2): cross-encoder, bi-encoder, and causal-LM yes/no scorers."""
from __future__ import annotations

import time

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F

from ..common import LOG, atomic_write_json, read_json, seed_everything
from ..data import AssignmentData
from ..metrics import assignment_eval
from ..models import (CausalScorer, STEncoder, apply_lora, autocast, compose_ids, count_params,
                      enable_gradient_checkpointing, get_device, load_causal_lm, load_hf_encoder, load_st,
                      st_backbone, st_set_backbone, to_device, weight_dtype)
from ..training import fit, measure_latency
from . import RunContext, chunks, limit_rows

MNRL_SCALE = 20.0

# (before task, between task and profile, after profile). {instruction} = task_assignment.query_instruction
YES_NO_TEMPLATES = {
    # Qwen3-Reranker's documented relevance template.
    "reranker": (
        "<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the Instruct "
        "provided. Note that the answer can only be \"yes\" or \"no\".<|im_end|>\n<|im_start|>user\n"
        "<Instruct>: {instruction}\n<Query>: ",
        "\n<Document>: ",
        "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"),
    "generative": (
        "<|im_start|>user\nTask:\n",
        "\n\nTeam member: ",
        "\n\nIs this team member a good fit for the task? Answer yes or no.<|im_end|>\n"
        "<|im_start|>assistant\n<think>\n\n</think>\n\n"),
}


def run(ctx: RunContext, data: AssignmentData) -> dict:
    seed_everything(ctx.seed)
    fam = ctx.unit.family
    if fam == "encoder":
        return _run_cross_encoder(ctx, data)
    if fam == "embedder":
        return _run_bi_encoder(ctx, data)
    return _run_yes_no(ctx, data)


# ---------------------------------------------------------------- shared

class _Lookup:
    def __init__(self, data: AssignmentData):
        self.text = dict(zip(data.tasks["Issue_ID"], data.tasks["text"]))
        self.profile = dict(zip(data.members["User_ID"], data.members["profile_text"]))
        self.profiles = data.members["profile_text"].tolist()


def _pointwise_pairs(ex: pd.DataFrame):
    """Positives with soft target = Plausibility; hard and random negatives with target 0 (README §5.5)."""
    iids, uids, tgt = [], [], []
    for row in ex.itertuples(index=False):
        for u, p in zip(row.positives, row.pos_plaus):
            iids.append(row.Issue_ID); uids.append(int(u)); tgt.append(float(p))
        for u in list(row.hard_negs) + list(row.random_negs):
            iids.append(row.Issue_ID); uids.append(int(u)); tgt.append(0.0)
    return iids, uids, torch.tensor(tgt, dtype=torch.float32)


def _score_pairwise(texts, profiles, fn_batch, batch_size) -> np.ndarray:
    """Score every (task, member) pair with fn_batch(task_texts, profile_texts) -> 1-D scores."""
    t_n, m_n = len(texts), len(profiles)
    order = np.argsort([len(x) for x in texts], kind="stable")
    flat = [(int(t), m) for t in order for m in range(m_n)]
    out = np.zeros((t_n, m_n))
    for c in chunks(flat, batch_size):
        vals = fn_batch([texts[t] for t, _ in c], [profiles[m] for _, m in c])
        vals = vals.float().cpu().numpy()
        for (t, m), v in zip(c, vals):
            out[t, m] = v
    return out


def _predictions(data: AssignmentData, tasks: pd.DataFrame, scores: np.ndarray) -> pd.DataFrame:
    rel = data.relevance(tasks["Issue_ID"].to_numpy())
    t_n, m_n = scores.shape
    rank = rel["rank"].ravel()
    return pd.DataFrame({
        "Issue_ID": np.repeat(tasks["Issue_ID"].to_numpy(), m_n),
        "User_ID": np.tile(data.member_ids, t_n),
        "score": scores.ravel(),
        "plausibility": rel["rel"].ravel(),
        "rank_true": pd.Series(rank).where(rank > 0).astype("Int64").array,
    })


def _finish(ctx, data, score_tasks, fit_out, zero_shot, total, trainable, method, n_train, train_time,
            before_eval=None) -> dict:
    test = data.split("test")
    if before_eval:
        before_eval()
    LOG.info("Evaluating the best checkpoint (epoch %s) on the test split (%d tasks x %d members) ...",
             fit_out["best_epoch"], len(test), len(data.members))
    with torch.no_grad():
        scores = score_tasks(test["text"].tolist())
    overall, slices = assignment_eval(scores, test, data, with_slices=True)
    LOG.info("Test ndcg@10 %.4f  hit@1 %.4f  held-out ndcg@10 %s", overall["ndcg@10"] or float("nan"),
             overall["hit@1"] or float("nan"), slices["held_out_members"].get("ndcg@10"))
    items = test["text"].tolist()[: ctx.tcfg["latency_samples"]]
    eff = measure_latency(score_tasks, items, int(ctx.tcfg["latency_batch_tasks"]), ctx.tcfg["latency_warmup"])
    overall["latency_ms_per_task"] = eff["latency_ms_bs1_median"]
    return {
        "total_params": total, "trainable_params": trainable, "finetune_method": method,
        "n_train": n_train, "n_val": len(data.split("val")), "n_test": len(test),
        "training": {**{k: v for k, v in fit_out.items() if k != "best_val_metrics"},
                     "train_time_s": train_time + fit_out.get("train_time_prior_s", 0.0)},  # + time before a resume
        "metrics": {"zero_shot_val": zero_shot, "val": fit_out["best_val_metrics"], "test": overall, "slices": slices},
        "efficiency": eff,
        "predictions": _predictions(data, test, scores),
    }


def _zero_shot(ctx, val_eval, module) -> dict:
    """Validation metrics of the pretrained model before fine-tuning. Cached in the unit's work dir so a unit resumed
    after an interruption does not recompute them (the work dir is wiped on every fresh start)."""
    path = ctx.work_dir / "zero_shot.json"
    cached = read_json(path)
    if cached is not None:
        LOG.info("Zero-shot metrics reused from the interrupted attempt.")
        return cached
    with torch.no_grad():
        module.eval()
        _, zero_shot = val_eval()
    atomic_write_json(path, zero_shot)
    return zero_shot


def _val_eval(data, score_tasks, before_eval=None):
    val = data.split("val")

    def evaluate():
        if before_eval:
            before_eval()
        overall, _ = assignment_eval(score_tasks(val["text"].tolist()), val, data, with_slices=False)
        return overall["ndcg@10"], overall
    return evaluate


# ---------------------------------------------------------------- encoder: cross-encoder

def _run_cross_encoder(ctx: RunContext, data: AssignmentData) -> dict:
    t = ctx.tcfg
    dev = get_device()
    look = _Lookup(data)
    enc = load_hf_encoder(ctx.snapshot_path, ctx.unit.entry, int(t["max_seq_len"]))
    total, _ = count_params(enc)
    if t["gradient_checkpointing"] and not enable_gradient_checkpointing(enc.model):
        ctx.notes.append("Gradient checkpointing not supported by this model; trained without it.")
    enc.to(dev)
    head = nn.Linear(enc.dim, 1).to(dev)
    _, trainable = count_params(enc, head)
    ctx.notes.append("Cross-encoder input: tokenizer pair encoding (task, profile) = [CLS] task [SEP] profile [SEP]; "
                     "only the task text is truncated. Pooling: attention-masked mean -> linear -> 1 logit; "
                     "score = sigmoid(logit). Loss: BCE with soft target Plausibility.")

    ex = limit_rows(ctx, data.train_examples, "tasks")
    iids, uids, tgt = _pointwise_pairs(ex)

    def logits(task_texts, prof_texts):
        return head(enc(to_device(enc.tokenize(task_texts, prof_texts), dev))).squeeze(-1).float()

    def step_loss(idx):
        lg = logits([look.text[iids[i]] for i in idx], [look.profile[uids[i]] for i in idx])
        return F.binary_cross_entropy_with_logits(lg, tgt[idx].to(dev))

    def score_tasks(texts):
        with autocast(ctx.precision):
            return _score_pairwise(texts, look.profiles, lambda a, b: torch.sigmoid(logits(a, b)), ctx.eval_batch)

    t0 = time.perf_counter()
    fit_out = fit(modules=[enc, head], param_groups=[
        {"params": [p for p in enc.parameters() if p.requires_grad], "lr": t["lr_full"]},
        {"params": list(head.parameters()), "lr": t["lr_head"]}],
        n_items=len(iids), step_loss=step_loss, evaluate=_val_eval(data, score_tasks), epochs=int(t["epochs"]),
        tcfg=t, per_device_batch=ctx.per_device_batch, precision=ctx.precision, work_dir=ctx.work_dir, seed=ctx.seed)
    train_time = time.perf_counter() - t0
    ctx.notes.append(f"Training pairs (pointwise): {len(iids)} from {len(ex)} tasks.")
    return _finish(ctx, data, score_tasks, fit_out, None, total, trainable, "full", len(iids), train_time)


# ---------------------------------------------------------------- embedder: bi-encoder

def _run_bi_encoder(ctx: RunContext, data: AssignmentData) -> dict:
    t = ctx.tcfg
    dev = get_device()
    look = _Lookup(data)
    st = load_st(ctx.snapshot_path, ctx.unit.entry)
    total, _ = count_params(st)
    lora = total > float(t["lora_param_threshold_m"]) * 1e6
    backbone = st_backbone(st)
    if t["gradient_checkpointing"] and not enable_gradient_checkpointing(backbone):
        ctx.notes.append("Gradient checkpointing not supported by this model; trained without it.")
    if lora:
        st.to(weight_dtype(ctx.precision, True))
        st_set_backbone(st, apply_lora(backbone, t["lora"]))
    st.to(dev)
    enc = STEncoder(st, int(t["max_seq_len"]))
    _, trainable = count_params(enc)
    qp, dp = t["query_prefix"], t["doc_prefix"]
    ctx.notes.append(f"Bi-encoder prefixes: query={qp!r}, document={dp!r}. Score = cosine similarity. Member "
                     "embeddings are precomputed once per evaluation (and once before latency timing).")
    ctx.notes.append("Loss: MultipleNegativesRankingLoss (scale 20) over the positive, its hard/random negatives and "
                     "in-batch candidates; in-batch candidates that are themselves relevant to the anchor task are "
                     "masked out (only 48 distinct profiles exist, so collisions are frequent). In-batch negatives "
                     "come from the per-device micro-batch.")
    ctx.notes.append("Every Task_Assignment pair has Plausibility > 0, so no over-qualified pair has relevance 0. "
                     "The task's most over-qualified present member (largest Capability - Plausibility, gap >= "
                     "overqualified_min_gap) is added as an extra negative for the task's top positive only.")

    ex = limit_rows(ctx, data.train_examples, "tasks")
    examples, relevant = [], {}
    for row in ex.itertuples(index=False):
        pos = [int(u) for u in row.positives]
        relevant[row.Issue_ID] = set(pos)
        base_negs = [int(u) for u in list(row.hard_negs) + list(row.random_negs)]
        for j, p in enumerate(pos):
            negs = base_negs + ([int(row.overq_user)] if j == 0 and row.overq_user >= 0 else [])
            examples.append((row.Issue_ID, p, negs))

    def embed(texts):
        return F.normalize(enc(to_device(enc.tokenize(texts), dev)).float(), dim=-1)

    def step_loss(idx):
        exs = [examples[i] for i in idx]
        b = len(exs)
        anchors = embed([qp + look.text[e[0]] for e in exs])
        cols, owners = [e[1] for e in exs], list(range(b))
        for i, e in enumerate(exs):
            cols.extend(e[2])
            owners.extend([i] * len(e[2]))
        uniq = sorted(set(cols))
        where = {u: j for j, u in enumerate(uniq)}
        cand = embed([dp + look.profile[u] for u in uniq])[[where[u] for u in cols]]
        sim = MNRL_SCALE * anchors @ cand.T
        mask = torch.zeros(sim.shape, dtype=torch.bool)
        for i, e in enumerate(exs):
            rel = relevant[e[0]]
            for c, (u, o) in enumerate(zip(cols, owners)):
                if o != i and u in rel:
                    mask[i, c] = True
        sim = sim.masked_fill(mask.to(dev), float("-inf"))
        return F.cross_entropy(sim, torch.arange(b, device=dev))

    member_emb = {}

    def refresh_members():
        with torch.no_grad(), autocast(ctx.precision):
            member_emb["m"] = embed([dp + p for p in look.profiles])

    def score_tasks(texts):
        out = []
        with autocast(ctx.precision):
            for c in chunks(list(texts), ctx.eval_batch):
                out.append((embed([qp + x for x in c]) @ member_emb["m"].T).float().cpu().numpy())
        return np.concatenate(out, 0) if out else np.zeros((0, len(look.profiles)))

    val_eval = _val_eval(data, score_tasks, refresh_members)
    zero_shot = _zero_shot(ctx, val_eval, enc)
    LOG.info("Zero-shot val ndcg@10: %s", zero_shot.get("ndcg@10"))
    t0 = time.perf_counter()
    fit_out = fit(modules=[enc], param_groups=[{"params": [p for p in enc.parameters() if p.requires_grad],
                                                "lr": t["lr_lora"] if lora else t["lr_full"]}],
                  n_items=len(examples), step_loss=step_loss, evaluate=val_eval, epochs=int(t["epochs"]), tcfg=t,
                  per_device_batch=ctx.per_device_batch, precision=ctx.precision, work_dir=ctx.work_dir, seed=ctx.seed)
    train_time = time.perf_counter() - t0
    ctx.notes.append(f"Training tuples (anchor, positive, negatives): {len(examples)} from {len(ex)} tasks.")
    return _finish(ctx, data, score_tasks, fit_out, zero_shot, total, trainable, "lora" if lora else "full",
                   len(examples), train_time, before_eval=refresh_members)


# ---------------------------------------------------------------- reranker / generative: P(yes)

def _run_yes_no(ctx: RunContext, data: AssignmentData) -> dict:
    t = ctx.tcfg
    dev = get_device()
    fam = ctx.unit.family
    look = _Lookup(data)
    max_len = int(t["max_seq_len"])
    model, tok = load_causal_lm(ctx.snapshot_path, ctx.unit.entry)
    total, _ = count_params(model)
    model.to(weight_dtype(ctx.precision, True))
    if t["gradient_checkpointing"] and not enable_gradient_checkpointing(model):
        ctx.notes.append("Gradient checkpointing not supported by this model; trained without it.")
    model = apply_lora(model, t["lora"], "CAUSAL_LM")
    model.to(dev)
    _, trainable = count_params(model)
    sc = CausalScorer(model, tok, dev, max_len)
    pre, mid, suf = (s.format(instruction=t["query_instruction"]) for s in YES_NO_TEMPLATES[fam])
    pre_ids, mid_ids, suf_ids = sc.ids(pre), sc.ids(mid), sc.ids(suf)
    yes_id, no_id = sc.token_id("yes"), sc.token_id("no")
    prof_ids = {p: sc.ids(p) for p in look.profiles}
    ctx.notes.append(f"{fam} yes/no scorer: score = P(yes) from the 2-way softmax over the 'yes'/'no' next-token "
                     "logits; LoRA fine-tuned with BCE on (logit_yes - logit_no) against soft target Plausibility. "
                     "The task text is truncated first so the template and profile always fit.")

    def diff(task_texts, prof_texts):
        seqs = [compose_ids(pre_ids, sc.ids(a)[:max_len], mid_ids, prof_ids[b], suf_ids, max_len)
                for a, b in zip(task_texts, prof_texts)]
        lg = sc.logits_for(sc.hidden(seqs)[:, -1], [yes_id, no_id])
        return lg[:, 0] - lg[:, 1]

    ex = limit_rows(ctx, data.train_examples, "tasks")
    iids, uids, tgt = _pointwise_pairs(ex)

    def step_loss(idx):
        d = diff([look.text[iids[i]] for i in idx], [look.profile[uids[i]] for i in idx])
        return F.binary_cross_entropy_with_logits(d, tgt[idx].to(dev))

    def score_tasks(texts):
        with autocast(ctx.precision):
            return _score_pairwise(texts, look.profiles, lambda a, b: torch.sigmoid(diff(a, b)), ctx.eval_batch)

    val_eval = _val_eval(data, score_tasks)
    zero_shot = None
    if fam == "reranker":
        zero_shot = _zero_shot(ctx, val_eval, model)
        LOG.info("Zero-shot val ndcg@10: %s", zero_shot.get("ndcg@10"))
    t0 = time.perf_counter()
    fit_out = fit(modules=[model], param_groups=[{"params": [p for p in model.parameters() if p.requires_grad],
                                                  "lr": t["lr_lora"]}],
                  n_items=len(iids), step_loss=step_loss, evaluate=val_eval, epochs=int(t["epochs"]), tcfg=t,
                  per_device_batch=ctx.per_device_batch, precision=ctx.precision, work_dir=ctx.work_dir, seed=ctx.seed)
    train_time = time.perf_counter() - t0
    ctx.notes.append(f"Training pairs (pointwise): {len(iids)} from {len(ex)} tasks.")
    return _finish(ctx, data, score_tasks, fit_out, zero_shot, total, trainable, "lora", len(iids), train_time)
