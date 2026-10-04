"""Task A - story-point estimation (README §4, §6.2): encoder/embedder + ordinal head, or generative LoRA SFT."""
from __future__ import annotations

import time

import numpy as np
import pandas as pd
import torch

from ..common import LOG, seed_everything
from ..data import StoryPointData
from ..metrics import story_point_metrics, story_point_slices
from ..models import (CausalScorer, STEncoder, apply_lora, autocast, compose_ids, count_params,
                      enable_gradient_checkpointing, get_device, head_loss, head_predict, load_causal_lm,
                      load_hf_encoder, load_st, make_head, np_softmax, st_backbone, st_set_backbone, to_device,
                      weight_dtype)
from ..training import fit, measure_latency
from . import RunContext, chunks, limit_rows

GEN_PROMPT_PRE = ("<|im_start|>user\nEstimate the story points for this Jira issue. "
                  "Answer with exactly one of: {choices}.\n\n")
GEN_PROMPT_SUF = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"


def run(ctx: RunContext, data: StoryPointData) -> dict:
    seed_everything(ctx.seed)
    if ctx.unit.family == "generative":
        return _run_generative(ctx, data)
    return _run_head(ctx, data)


def _predictions_frame(df: pd.DataFrame, pred, probs, k: int) -> pd.DataFrame:
    out = pd.DataFrame({"Issue_ID": df["Issue_ID"].to_numpy(), "true_bucket": df["bucket"].to_numpy(),
                        "pred_bucket": np.asarray(pred, dtype=np.int64), "raw_sp": df["raw_sp"].to_numpy()})
    for j in range(k):
        out[f"p_{j}"] = np.asarray(probs)[:, j] if probs is not None else np.nan
    return out


def _finish(ctx, data, train_df, predict, fit_out, total, trainable, method, run_batch, train_time,
            latency_batch: int | None = None) -> dict:
    """Test exactly once with the restored best-validation weights, then slices and latency."""
    k = len(data.buckets)
    test = data.test
    LOG.info("Evaluating the best checkpoint (epoch %s) on the test split (%d rows) ...", fit_out["best_epoch"], len(test))
    with torch.no_grad():
        pred, probs = predict(test)
    test_metrics = story_point_metrics(test["bucket"], pred, test["raw_sp"], data.buckets, probs)
    slices = story_point_slices(test, pred, data.buckets, probs)
    LOG.info("Test qwk %.4f  mae_bucket %.4f  within_one %.4f", test_metrics["qwk"] or float("nan"),
             test_metrics["mae_bucket"], test_metrics["within_one_acc"])
    items = test["text"].tolist()[: ctx.tcfg["latency_samples"]]
    eff = measure_latency(run_batch, items, latency_batch or ctx.eval_batch, ctx.tcfg["latency_warmup"])
    return {
        "total_params": total, "trainable_params": trainable, "finetune_method": method,
        "n_train": len(train_df), "n_val": len(data.val), "n_test": len(test),
        "training": {**{k_: v for k_, v in fit_out.items() if k_ != "best_val_metrics"},
                     "train_time_s": train_time + fit_out.get("train_time_prior_s", 0.0)},  # + time before a resume
        "metrics": {"zero_shot_val": None, "val": fit_out["best_val_metrics"], "test": test_metrics, "slices": slices},
        "efficiency": eff,
        "predictions": _predictions_frame(test, pred, probs, k),
    }


# ---------------------------------------------------------------- encoder / embedder + head

def _run_head(ctx: RunContext, data: StoryPointData) -> dict:
    t = ctx.tcfg
    dev = get_device()
    k = len(data.buckets)
    kind = ctx.unit.recipe
    entry = ctx.unit.entry
    max_len = int(t["max_seq_len"])

    if ctx.unit.family == "encoder":
        enc = load_hf_encoder(ctx.snapshot_path, entry, max_len)
        total, _ = count_params(enc)
        lora = False
        if t["gradient_checkpointing"] and not enable_gradient_checkpointing(enc.model):
            ctx.notes.append("Gradient checkpointing not supported by this model; trained without it.")
        enc.to(dev)
        ctx.notes.append("Encoder pooling: attention-masked mean pooling over the last hidden state.")
    else:
        st = load_st(ctx.snapshot_path, entry)
        total, _ = count_params(st)
        lora = total > float(t["lora_param_threshold_m"]) * 1e6
        backbone = st_backbone(st)
        if t["gradient_checkpointing"] and not enable_gradient_checkpointing(backbone):
            ctx.notes.append("Gradient checkpointing not supported by this model; trained without it.")
        if lora:
            st.to(weight_dtype(ctx.precision, True))
            st_set_backbone(st, apply_lora(backbone, t["lora"]))
        st.to(dev)
        enc = STEncoder(st, max_len)
        ctx.notes.append("Embedder pooling: the model's native Sentence-Transformers pooling (incl. normalisation "
                         "if the model ships it); the ordinal head reads the sentence embedding.")
    head = make_head(kind, enc.dim, k).to(dev)
    _, trainable = count_params(enc, head)
    method = "lora" if lora else "full"
    groups = [{"params": [p for p in enc.parameters() if p.requires_grad], "lr": t["lr_lora"] if lora else t["lr_full"]},
              {"params": list(head.parameters()), "lr": t["lr_head"]}]

    train = limit_rows(ctx, data.train, "rows")
    texts = train["text"].tolist()
    y = torch.tensor(train["bucket"].to_numpy(), dtype=torch.long)

    def step_loss(idx):
        e = to_device(enc.tokenize([texts[i] for i in idx]), dev)
        return head_loss(kind, head(enc(e)), y[idx].to(dev), k)

    def run_batch(batch_texts):
        with autocast(ctx.precision):
            return head(enc(to_device(enc.tokenize(batch_texts), dev)))

    def predict(df):
        order = np.argsort(df["text"].str.len().to_numpy(), kind="stable")
        all_texts = df["text"].tolist()
        pred = np.zeros(len(df), dtype=np.int64)
        probs = None if kind == "regression" else np.zeros((len(df), k))
        for c in chunks(order, ctx.eval_batch):
            p, pr = head_predict(kind, run_batch([all_texts[i] for i in c]), k)
            pred[c] = p
            if probs is not None:
                probs[c] = pr
        return pred, probs

    def evaluate():
        pred, probs = predict(data.val)
        m = story_point_metrics(data.val["bucket"], pred, data.val["raw_sp"], data.buckets, probs)
        return m["qwk"], m

    t0 = time.perf_counter()
    fit_out = fit(modules=[enc, head], param_groups=groups, n_items=len(train), step_loss=step_loss, evaluate=evaluate,
                  epochs=int(t["epochs"]), tcfg=t, per_device_batch=ctx.per_device_batch, precision=ctx.precision,
                  work_dir=ctx.work_dir, seed=ctx.seed)
    train_time = time.perf_counter() - t0
    return _finish(ctx, data, train, predict, fit_out, total, trainable, method, run_batch, train_time)


# ---------------------------------------------------------------- generative (LoRA SFT on a bucket answer)

def _run_generative(ctx: RunContext, data: StoryPointData) -> dict:
    t = ctx.tcfg
    dev = get_device()
    k = len(data.buckets)
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

    choices = ", ".join(str(b) for b in data.buckets)
    pre = sc.ids(GEN_PROMPT_PRE.format(choices=choices))
    suf = sc.ids(GEN_PROMPT_SUF)
    end = sc.token_id("<|im_end|>")
    answers = [sc.ids(str(b)) + [end] for b in data.buckets]
    width = max(len(a) for a in answers)
    ctx.notes.append("Generative recipe: Qwen chat template with an empty think block; the answer is the bucket "
                     "number followed by <|im_end|>. Qwen tokenises digits one by one, so multi-digit buckets "
                     "are scored by summed sequence log-probability of each candidate (softmax over the 7 "
                     "candidates gives the class probabilities).")

    def prompt(text):
        return compose_ids(pre, sc.ids(text), [], [], suf, max_len, reserve=width)

    def answer_logprobs(seqs, ans_lens):
        """Summed log-prob of the last `ans_lens[i]` tokens of each sequence."""
        h = sc.hidden(seqs)[:, -width - 1:-1]
        logp = torch.log_softmax(sc.logits_for(h), -1)
        tgt = torch.tensor([s[-width:] for s in seqs], device=dev)
        tok_lp = logp.gather(-1, tgt.unsqueeze(-1)).squeeze(-1)
        pos = torch.arange(width, device=dev).unsqueeze(0)
        mask = pos >= (width - torch.tensor(ans_lens, device=dev).unsqueeze(1))
        return (tok_lp * mask).sum(1)

    train = limit_rows(ctx, data.train, "rows")
    texts = train["text"].tolist()
    ys = train["bucket"].to_numpy()

    def step_loss(idx):
        seqs = [prompt(texts[i]) + answers[ys[i]] for i in idx]
        return -answer_logprobs(seqs, [len(answers[ys[i]]) for i in idx]).mean()

    def run_batch(batch_texts):
        seqs, lens = [], []
        for text in batch_texts:
            p = prompt(text)
            for a in answers:
                seqs.append(p + a)
                lens.append(len(a))
        with autocast(ctx.precision):
            return answer_logprobs(seqs, lens).view(len(batch_texts), k)

    per_call = max(1, ctx.eval_batch // k)

    def predict(df):
        order = np.argsort(df["text"].str.len().to_numpy(), kind="stable")
        all_texts = df["text"].tolist()
        scores = np.zeros((len(df), k))
        for c in chunks(order, per_call):
            scores[c] = run_batch([all_texts[i] for i in c]).float().cpu().numpy()
        probs = np_softmax(scores, 1)
        return probs.argmax(1), probs

    def evaluate():
        pred, probs = predict(data.val)
        m = story_point_metrics(data.val["bucket"], pred, data.val["raw_sp"], data.buckets, probs)
        return m["qwk"], m

    t0 = time.perf_counter()
    fit_out = fit(modules=[model], param_groups=[{"params": [p for p in model.parameters() if p.requires_grad],
                                                  "lr": t["lr_lora"]}],
                  n_items=len(train), step_loss=step_loss, evaluate=evaluate, epochs=int(t["epochs"]), tcfg=t,
                  per_device_batch=ctx.per_device_batch, precision=ctx.precision, work_dir=ctx.work_dir, seed=ctx.seed)
    train_time = time.perf_counter() - t0
    return _finish(ctx, data, train, predict, fit_out, total, trainable, "lora", run_batch, train_time, per_call)
