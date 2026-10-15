# OA3 — training the production assignee-ranking model

OA3 trains the model that suggests **who should work on a task**, exports it as a ready-to-serve folder, and
proves that the exported folder gives the same results as the trained model.

It builds on OA2 (`apps/ai/model_selection/OA2`), the benchmark that compared 27 model/task combinations.
OA2 picked **Qwen3-Embedding-0.6B as a bi-encoder** for Task B (assignee ranking): it scored test nDCG@10 **0.836**,
ranked never-seen members almost as well (0.828), and needs about 100 ms per task
(OA2 `REPORT.md` §4 and §7.2). OA2 deletes every model after scoring it, so it produced no usable weights.
OA3 retrains that model with the same recipe on **10× more data** (50,000 training tasks instead of 5,000) and
keeps the result.

| Document | Read it for |
|---|---|
| **README.md** (this file) | What OA3 is, how to run it, what it produces |
| **[DESIGN.md](DESIGN.md)** | The plan and every design decision, with the reason and the alternatives that were rejected |
| **[INTEGRATION.md](INTEGRATION.md)** | How the product uses the exported model: inputs, outputs, service design, rollout, monitoring |
| [OA2 REPORT.md](../../model_selection/OA2/REPORT.md) | Why this model was chosen |

---

## 1. The model in one paragraph

A bi-encoder turns text into a vector (1,024 numbers). It reads a **task** (project, type, components, title,
description) and, separately, each **team-member profile** (level, area, years of experience, role), and produces one
vector for each. The **cosine similarity** between the task vector and a member vector is that member's score;
sorting the scores gives the ranking. Member vectors are computed once and stored, so suggesting assignees for a new
task costs one model call plus a dot product per member. The model does not generate text and cannot be
prompted. It only maps text to vectors. INTEGRATION.md §1 explains this in more detail.

## 2. Folder layout

```
apps/ai/training/OA3/
├── README.md              this file
├── DESIGN.md              plan + design decisions
├── INTEGRATION.md         production usage
├── config.yaml            data budget, model revision, prompt, recipe, export settings
├── requirements.txt       pinned versions (same as OA2)
├── train_assignee.py      the CLI: prepare → train → test → compare → export → verify → report
├── oa3/
│   ├── config.py          config loading, OA2 import, run ID
│   ├── data.py            data prep (reuses OA2), nested training sample, task-ID manifests
│   ├── trainer.py         OA2's bi-encoder recipe, returning the trained model
│   ├── compare.py         paired bootstrap against OA2 on the same test tasks
│   ├── export.py          LoRA merge, save, inference_config.json, verification
│   └── inference.py       SELF-CONTAINED production loader (AssigneeRanker); shipped inside the model folder
├── tests/test_parity.py   production text == training text, byte for byte; nested sampling
│
├── reports/<run_id>/      committed: report.json, SUMMARY.md, test_predictions.csv.gz, data/ (task-ID manifests)
├── artifacts/<run_id>/    NOT committed: model/ = the exported model (~1.2 GB)
├── .work/<run_id>/        NOT committed: resume checkpoint, best epoch (LoRA weights), zero-shot cache
├── .cache/data/           NOT committed: prepared data (Parquet), keyed by data fingerprint
└── logs/<run_id>.log      NOT committed: full log of the run
```

OA3 **imports** OA2's `oa2` package (data preparation, metrics, training loop) instead of copying it, so both use
exactly the same code. OA2 is not modified. See DESIGN.md §2.

## 3. Setup

Python ≥ 3.10 and an NVIDIA GPU with ≥ 6 GB (OA2 peaked at 3.8 GB for this model). The dataset must be at
`apps/ai/datasets/TAWOS/TAWOS_staffing_dataset` (it is git-ignored; see OA2 README).

```bash
cd apps/ai/training/OA3
python -m venv .venv && .venv\Scripts\activate          # Windows; on Linux/macOS: source .venv/bin/activate
pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements.txt
python -m pytest tests                                  # parity tests: no GPU, no download, < 1 s
```

**Machines that cannot reach Hugging Face:** the run downloads the pinned model revision on its first start. If
`huggingface.co` is blocked, download that revision on a machine that can reach it:

```bash
python -c "from huggingface_hub import snapshot_download; print(snapshot_download('Qwen/Qwen3-Embedding-0.6B', revision='97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3'))"
```

Then either copy the whole Hugging Face cache folder (`~/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B`)
to the same place on the training machine, which keeps the revision check, or copy the printed snapshot folder and
set `model.local_path` in `config.yaml`. `local_path` skips the revision check and adds `local__` to the run ID.

## 4. Running

```bash
python train_assignee.py --prepare-only                    # build data + manifests, print sizes (≈ 5 min, no GPU)
python train_assignee.py --limit-train 50 --limit-eval 50  # smoke run end to end (separate run ID, marked smoke)
python train_assignee.py                                   # the real run
```

**The real run is resumable.** It saves a checkpoint every 15 minutes and at every epoch boundary. After a crash,
Ctrl+C, reboot or power cut, run the same command again: it continues from the last checkpoint with the same data
order and random state. Once training has finished, re-running skips training, restores the best epoch, and redoes
test, export and verification. That is also how you re-export a model.

Any change to the data budget, model revision, prompt or recipe in `config.yaml` creates a **new run ID**, so a
changed configuration never silently resumes or overwrites an older run.

### Stages of one run

| # | Stage | Output |
|---|---|---|
| 1 | Prepare data: chronological split, sampling, training tuples (cached by fingerprint) | `.cache/data/`, `reports/<run_id>/data/*.csv` |
| 2 | Download the pinned model revision | Hugging Face cache |
| 3 | Zero-shot validation, then train with early stopping on validation nDCG@10 | `.work/<run_id>/` |
| 4 | Test the best epoch: headline metrics, slices, predictions | `test_predictions.csv.gz` |
| 5 | Paired bootstrap against OA2 on the same 2,000 test tasks | `report.json → comparison_with_oa2` |
| 6 | Merge LoRA, save in bf16, write `inference_config.json`, model card, copy `inference.py` and manifests | `artifacts/<run_id>/model/` |
| 7 | Reload the export with the production loader, re-score test, time single requests | `report.json → verification` |
| 8 | Write the report | `report.json`, `SUMMARY.md` |

Exit code 0 = completed and verified; 2 = the export did not reproduce the trained model's test score (do not ship).

### Time and hardware

50,000 training tasks give about **195,000 training tuples**. On OA2's RTX 4050 Laptop (6 GB), a clean OA2 epoch ran at
about 0.10 s per tuple, and up to 2× slower under machine load. That puts **2 epochs at 11–22 h**, plus about 30 min
for evaluation and export. A cloud A100/L4 is roughly 5–10× faster. On a GPU without bf16 (pre-Ampere, e.g.
GTX 16xx/RTX 20xx) the run uses fp16. On a 4 GB card, set `training.per_device_batch: 2` (DESIGN.md §5.4).

## 5. What the run produces

`artifacts/<run_id>/model/` is the deployable model (see INTEGRATION.md for the serving side):

```
model/
├── config.json, model.safetensors, tokenizer files, modules.json, ...   standard SentenceTransformer folder
├── inference_config.json   prompt, templates, max length, dtype, metrics, data fingerprint, git commit
├── inference.py            the loader (copy of oa3/inference.py) — the only code the AI service needs
├── README.md               model card
└── training_data/          train/val/test task IDs + the member table used
```

`reports/<run_id>/` is committed and records the run: every metric, the comparison with OA2, the verification, the
environment, and the task IDs of every split.

## 6. Status

| Item | State |
|---|---|
| Code, docs, parity tests | done (49 tests pass) |
| Data preparation at 50k | done: 50,000 train tasks → 194,931 tuples; 2,000 val; test = OA2's 2,500 tasks (checked) |
| End-to-end pipeline test | done on CPU with a small local stand-in model (DistilBERT, 20 train / 30 eval tasks): train → test → export → verify passed. The Qwen download was blocked on that machine (§3) |
| Full 50k run | **not yet run**: needs the GPU machine (11–22 h) |
| Serving integration | designed in INTEGRATION.md, not yet implemented in the AI service/backend |
