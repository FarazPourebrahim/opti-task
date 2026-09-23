"""Model loading and building blocks: precision, LoRA, pooled text encoders, ordinal heads, causal-LM scorers."""
from __future__ import annotations

import contextlib
import inspect

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

AMP_DTYPES = {"bf16": torch.bfloat16, "fp16": torch.float16, "fp32": None}


# ---------------------------------------------------------------- device / precision

def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def resolve_precision(override: str | None = None) -> str:
    """README §7: bf16 if supported, else fp16 (fp32 on CPU or when a model entry demands it)."""
    if not torch.cuda.is_available():
        return "fp32"
    if override:
        return override
    major, _ = torch.cuda.get_device_capability(0)
    return "bf16" if major >= 8 and torch.cuda.is_bf16_supported() else "fp16"


def autocast(precision: str):
    dtype = AMP_DTYPES[precision]
    if dtype is None or not torch.cuda.is_available():
        return contextlib.nullcontext()
    return torch.autocast("cuda", dtype=dtype)


def weight_dtype(precision: str, lora: bool) -> torch.dtype:
    """Frozen LoRA base weights are stored in the half type; fully fine-tuned weights stay fp32 (AMP)."""
    if lora and AMP_DTYPES[precision] is not None:
        return AMP_DTYPES[precision]
    return torch.float32


def count_params(*modules) -> tuple[int, int]:
    seen, total, trainable = set(), 0, 0
    for m in modules:
        for p in m.parameters():
            if id(p) in seen:
                continue
            seen.add(id(p))
            total += p.numel()
            trainable += p.numel() if p.requires_grad else 0
    return total, trainable


def apply_lora(model: nn.Module, lcfg: dict, task_type: str | None = None) -> nn.Module:
    from peft import LoraConfig, get_peft_model
    conf = LoraConfig(r=lcfg["r"], lora_alpha=lcfg["alpha"], lora_dropout=lcfg["dropout"],
                      target_modules="all-linear", bias="none", task_type=task_type)
    return get_peft_model(model, conf)


def enable_gradient_checkpointing(hf_model) -> bool:
    try:
        hf_model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
        return True
    except Exception:  # noqa: BLE001 - some remote-code models do not support it
        return False


def to_device(enc: dict, device) -> dict:
    return {k: (v.to(device) if torch.is_tensor(v) else v) for k, v in enc.items()}


# ---------------------------------------------------------------- pooled text encoders

class HFEncoder(nn.Module):
    """Transformers AutoModel + attention-masked mean pooling (encoder family)."""

    def __init__(self, model, tokenizer, max_len: int):
        super().__init__()
        self.model = model
        self.tok = tokenizer
        self.max_len = max_len
        params = inspect.signature(self._base().forward).parameters
        has_kwargs = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())
        self._accepts = None if has_kwargs else set(params)

    def _base(self):
        return self.model.get_base_model() if hasattr(self.model, "get_base_model") else self.model

    @property
    def dim(self) -> int:
        return int(self._base().config.hidden_size)

    def tokenize(self, texts, pairs=None) -> dict:
        enc = self.tok(list(texts), list(pairs) if pairs is not None else None,
                       truncation="only_first" if pairs is not None else True,
                       max_length=self.max_len, padding=True, return_tensors="pt")
        enc = dict(enc)
        if self._accepts is not None:
            enc = {k: v for k, v in enc.items() if k in self._accepts}
        return enc

    def forward(self, enc: dict) -> torch.Tensor:
        out = self.model(**enc)
        h = out.last_hidden_state if hasattr(out, "last_hidden_state") else out[0]
        mask = enc["attention_mask"].unsqueeze(-1).to(h.dtype)
        return (h * mask).sum(1) / mask.sum(1).clamp(min=1.0)


class STEncoder(nn.Module):
    """SentenceTransformer with the model's native pooling/normalisation (embedder family)."""

    def __init__(self, st, max_len: int):
        super().__init__()
        self.st = st
        st.max_seq_length = min(max_len, st.max_seq_length or max_len)

    @property
    def dim(self) -> int:
        return int(self.st.get_sentence_embedding_dimension())

    def tokenize(self, texts) -> dict:
        return dict(self.st.tokenize(list(texts)))

    def forward(self, enc: dict) -> torch.Tensor:
        return self.st(dict(enc))["sentence_embedding"]


def load_hf_encoder(path: str, entry: dict, max_len: int):
    from transformers import AutoConfig, AutoModel, AutoTokenizer
    trc = bool(entry.get("trust_remote_code", False))
    config = AutoConfig.from_pretrained(path, trust_remote_code=trc)
    if getattr(config, "model_type", "") == "modernbert":
        config.reference_compile = False  # torch.compile/triton is not reliably available (e.g. Windows)
    tok = AutoTokenizer.from_pretrained(path, trust_remote_code=trc)
    model = AutoModel.from_pretrained(path, config=config, trust_remote_code=trc, torch_dtype=torch.float32)
    return HFEncoder(model, tok, max_len)


def load_st(path: str, entry: dict):
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(path, device="cpu", trust_remote_code=bool(entry.get("trust_remote_code", False)))


def st_backbone(st):
    return st[0].auto_model


def st_set_backbone(st, model) -> None:
    st[0].auto_model = model


def load_causal_lm(path: str, entry: dict):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    trc = bool(entry.get("trust_remote_code", False))
    tok = AutoTokenizer.from_pretrained(path, trust_remote_code=trc, padding_side="left")
    model = AutoModelForCausalLM.from_pretrained(path, trust_remote_code=trc, torch_dtype=torch.float32)
    model.config.use_cache = False
    return model, tok


# ---------------------------------------------------------------- heads (README §4.4)

class CoralHead(nn.Module):
    """CORAL: one shared weight vector, K-1 ordered bias thresholds (rank-consistent)."""

    def __init__(self, dim: int, k: int):
        super().__init__()
        self.fc = nn.Linear(dim, 1, bias=False)
        self.bias = nn.Parameter(torch.zeros(k - 1))

    def forward(self, x):
        return self.fc(x) + self.bias


def make_head(kind: str, dim: int, k: int) -> nn.Module:
    if kind == "coral":
        return CoralHead(dim, k)
    if kind == "regression":
        return nn.Linear(dim, 1)
    if kind == "multiclass":
        return nn.Linear(dim, k)
    raise ValueError(f"unknown head {kind!r}")


def head_loss(kind: str, logits: torch.Tensor, y: torch.Tensor, k: int) -> torch.Tensor:
    logits = logits.float()
    if kind == "coral":
        levels = (y.unsqueeze(1) > torch.arange(k - 1, device=y.device).unsqueeze(0)).float()
        return F.binary_cross_entropy_with_logits(logits, levels)
    if kind == "regression":
        return F.huber_loss(logits.squeeze(-1), y.float())
    return F.cross_entropy(logits, y)


def head_predict(kind: str, logits: torch.Tensor, k: int):
    """Returns (pred_index [B], class_probs [B, K] or None)."""
    logits = logits.float()
    if kind == "coral":
        cum = torch.sigmoid(logits)                     # P(y > j), j = 0..K-2
        pred = (cum > 0.5).sum(1)
        ones = torch.ones_like(cum[:, :1])
        zeros = torch.zeros_like(cum[:, :1])
        upper = torch.cat([ones, cum], 1)
        lower = torch.cat([cum, zeros], 1)
        probs = (upper - lower).clamp(min=0.0)
        probs = probs / probs.sum(1, keepdim=True).clamp(min=1e-12)
        return pred.cpu().numpy(), probs.cpu().numpy()
    if kind == "regression":
        pred = logits.squeeze(-1).round().clamp(0, k - 1).long()
        return pred.cpu().numpy(), None
    probs = torch.softmax(logits, 1)
    return probs.argmax(1).cpu().numpy(), probs.cpu().numpy()


# ---------------------------------------------------------------- causal-LM scoring

class CausalScorer:
    """Wraps a (LoRA) causal LM: builds left-padded batches from token-id lists and projects only the
    needed hidden states onto the vocabulary, so full [B, T, V] logits are never materialised."""

    def __init__(self, model, tokenizer, device, max_len: int):
        self.model = model
        self.tok = tokenizer
        self.device = device
        self.max_len = max_len
        base = model.get_base_model() if hasattr(model, "get_base_model") else model
        self.decoder = base.model
        self.lm_head = base.lm_head
        self.pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id

    def ids(self, text: str) -> list[int]:
        return self.tok(text, add_special_tokens=False)["input_ids"]

    def token_id(self, token: str) -> int:
        tid = self.tok.convert_tokens_to_ids(token)
        if tid is None or tid == self.tok.unk_token_id:
            raise ValueError(f"token {token!r} not in vocabulary")
        return int(tid)

    def hidden(self, seqs: list[list[int]]) -> torch.Tensor:
        width = max(len(s) for s in seqs)
        ids = torch.full((len(seqs), width), self.pad_id, dtype=torch.long)
        mask = torch.zeros((len(seqs), width), dtype=torch.long)
        for i, s in enumerate(seqs):
            ids[i, width - len(s):] = torch.tensor(s, dtype=torch.long)
            mask[i, width - len(s):] = 1
        pos = (mask.cumsum(1) - 1).clamp(min=0)
        out = self.decoder(input_ids=ids.to(self.device), attention_mask=mask.to(self.device),
                           position_ids=pos.to(self.device), use_cache=False)
        return out.last_hidden_state

    def logits_for(self, h: torch.Tensor, token_ids=None) -> torch.Tensor:
        w = self.lm_head.weight if token_ids is None else self.lm_head.weight[token_ids]
        out = h.float() @ w.float().T
        bias = getattr(self.lm_head, "bias", None)
        if bias is not None:
            out = out + (bias.float() if token_ids is None else bias[token_ids].float())
        return out


def compose_ids(pre: list[int], task: list[int], mid: list[int], profile: list[int], suf: list[int],
                max_len: int, reserve: int = 0) -> list[int]:
    """Truncate the task text first, never the profile or the template (README §7)."""
    budget = max(max_len - len(pre) - len(mid) - len(profile) - len(suf) - reserve, 0)
    return pre + task[:budget] + mid + profile + suf


def np_softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)
