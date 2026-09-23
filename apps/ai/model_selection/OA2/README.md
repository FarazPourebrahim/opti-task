# OA2 — Model Selection Benchmark

A specification for **one script** that benchmarks candidate pretrained models for Opti-Task's two AI features. The script trains each model on the TAWOS staffing dataset, evaluates it, writes a professional performance report, deletes the model, and moves on to the next. It must be resumable: stopping it and starting it again continues from where it left off.

This document is written so that **a human engineer or an AI coding agent can implement the script without further clarification**. Where something is a hard requirement, it says **MUST**. Where the implementer has freedom, it says **MAY** or explicitly leaves the choice open. If this document and your intuition disagree, follow this document; if this document is silent, choose the simplest option and record the choice in the report's `notes` field.

---

## Table of contents

1. [Project context: what we are building and why](#1-project-context-what-we-are-building-and-why)
2. [What the script does (at a glance)](#2-what-the-script-does-at-a-glance)
3. [The dataset](#3-the-dataset)
4. [Task A — Story-point estimation](#4-task-a--story-point-estimation)
5. [Task B — Assignee ranking](#5-task-b--assignee-ranking)
6. [Candidate models](#6-candidate-models)
7. [Training protocol (the same rules for every model)](#7-training-protocol-the-same-rules-for-every-model)
8. [The per-model lifecycle: pull → train → report → erase](#8-the-per-model-lifecycle-pull--train--report--erase)
9. [Checkpoint / resume system](#9-checkpoint--resume-system)
10. [Report outputs](#10-report-outputs)
11. [Configuration and CLI](#11-configuration-and-cli)
12. [Suggested file layout](#12-suggested-file-layout)
13. [Things you must NOT do](#13-things-you-must-not-do)
14. [Definition of done](#14-definition-of-done)
15. [Glossary](#15-glossary)

---

## 1. Project context: what we are building and why

**Opti-Task** is a task-management product (this monorepo: `apps/frontend`, `apps/backend`, `apps/ai`). We plan two AI-assisted features:

| Feature | What the user sees | ML problem |
|---|---|---|
| **A. Story-point prediction** | When a task is created, the app suggests a story-point estimate (e.g. "5 points, 53% confident"). | **Ordinal classification.** Text in, one value out from an ordered scale such as 1 < 2 < 3 < 5 < 8 < 13 < 21. |
| **B. Assignee recommendation** | The app suggests a ranked shortlist of team members who are suited to the task. | **Learning to rank.** Given a (task, team member) pair, output a suitability score, then sort the members by that score. |

A research report (`deep-research-report.md`, which this README summarises; you do not need to read it) shortlisted about a dozen small (≤ 0.6B-parameter) open-weight models that could power these features. Its recommendations are **hypotheses**. For example, it suggests *ModernBERT + an ordinal head* for story points and *Qwen3-Embedding + Qwen3-Reranker* for assignment. **This script's job is to test those hypotheses on real data.** It produces evidence, as a table of comparable, reproducible numbers, that lets the team choose which model(s) to put into production.

We therefore care about:

1. **Fairness of comparison.** Every model gets the same data, splits, budget and metrics. A model must not win because it got more tuning.
2. **Reproducibility.** Anyone can re-run a single model later and get the same numbers (same seeds, recorded library versions, recorded model revision).
3. **Practical cost.** Accuracy alone does not decide. The report must also capture model size, training time, peak GPU memory and inference latency, because a 22M-parameter model that is 1% worse may be the better product choice.
4. **Honest reporting.** Failures, skips, out-of-memory errors and caveats are recorded, never hidden.

**Out of scope:** production serving, an API, a UI, hyperparameter search, and any real employee data. The team in this dataset is **synthetic** (see §3).

---

## 2. What the script does (at a glance)

```
prepare data once (cached) ──►  for each (model, task) "run unit" in the registry:
                                   ├─ skip if already completed (checkpoint)
                                   ├─ 1. pull   – download model weights from Hugging Face
                                   ├─ 2. train  – fine-tune on the train split, select on the validation split
                                   ├─ 3. test   – evaluate once on the held-out test split
                                   ├─ 4. report – write the JSON report + append to the leaderboard CSV
                                   ├─ 5. erase  – delete weights, HF cache and training checkpoints
                                   └─ 6. mark the unit completed (checkpoint)
                                 finally: regenerate the leaderboards + summary
```

A **run unit** is one `(task, model, head/recipe)` combination, for example `story_point / ModernBERT-base / coral`. The script processes run units **sequentially**, one model on disk and in memory at a time.

---

## 3. The dataset

Location (relative to repo root): `apps/ai/datasets/TAWOS/TAWOS_staffing_dataset/`

**Read that folder's `README.md` first.** Key facts are repeated here:

- It is the public **TAWOS** Jira corpus (Tawosi et al., MSR 2022): 432,601 issues from 39 open-source projects. It has been extended with a **synthetic 48-person engineering team** (`User.csv`) and a **scored (task, member) matrix** (`Task_Assignment.csv`).
- CSVs are UTF-8 and RFC-4180 quoted, with **real newlines inside quoted fields**. Use a real CSV parser.
- **NULL ≠ empty string.** Use `pandas.read_csv(..., keep_default_na=False)` if you need to distinguish them; otherwise both become `NaN`.
- `Issue.csv` is ~920 MB, and `Comment.csv` and `Change_Log.csv` are 1–1.7 GB each. Load only the columns you need (`usecols=`). **This benchmark does not use `Comment.csv` or `Change_Log.csv`.** They are too large, and most comments are written after estimation, which would leak information.

### Files this benchmark uses

| File | Rows | Used for |
|---|---:|---|
| `Issue.csv` | 432,601 | Task text (both tasks) and story-point labels (Task A). |
| `Project.csv` | 39 | Project key/name added to the task text. |
| `Component.csv` + `Issue_Component.csv` | 2,001 / 341,720 | Component names added to the task text. |
| `User.csv` | 48 | Team-member profiles (Task B). |
| `Task_Assignment.csv` | 1,852,088 | Relevance labels (Task B). |
| `Task_Profile.csv` | 432,601 | **Evaluation slicing only. Never a model input** (see §5.3). |

### Relevant columns

- `Issue.csv`: `ID, Title, Description_Text, Type, Story_Point, Creation_Date, Estimation_Date, Project_ID, Title_Changed_After_Estimation, Description_Changed_After_Estimation`
- `User.csv`: `ID, Name, Expertise_Level, Expertise_Area, Years_Experience, Role_In_Project, Role_Class`
   - Levels: Intern < Junior < Mid-level < Senior < Staff < Principal. The team has 12 Junior, 21 Mid-level, 10 Senior, 4 Staff and 1 Principal.
   - Areas (9): Frontend, Database, API/Integration, DevOps, Backend, QA/Testing, Infrastructure, Security, Documentation.
- `Task_Assignment.csv`: `Issue_ID, User_ID, Capability, Plausibility, Rank` (both scores are in [0, 1])
- `Task_Profile.csv`: `Issue_ID, Primary_Area, Secondary_Area, Required_Level, Required_Level_Score, N_Assignees`

### Data preparation (done once, cached)

The script **MUST** run a *prepare* stage before any model. It builds the processed splits for both tasks and caches them, for example as Parquet under `OA2/.cache/data/`. It also stores a **data fingerprint**: a hash of the source file sizes and modification times plus the preparation config. Every report records this fingerprint. If the fingerprint changes, the cache is rebuilt. Preparation is deterministic (global seed, default `20260916`, the same seed the dataset was built with).

### Canonical task text

Both tasks turn an issue into the same text string. Use this exact template:

```
[Project: {Project.Project_Key}] [Type: {Issue.Type}] [Components: {comma-separated component names or "none"}]
{Issue.Title}
{Issue.Description_Text}
```

- Use `Description_Text` (prose), not `Description` (raw markup) or `Description_Code`.
- Normalise whitespace. Truncate to the model's `max_seq_len` (§7). The title and header come first, so they always survive truncation.
- **Do not add** priority, status, resolution, assignee, sprint, time spent, effort minutes, resolution time, or any date. These are final or after-the-fact values and would leak the answer.

---

## 4. Task A — Story-point estimation

### 4.1 Rows

Use only issues where `Story_Point` is not NULL. That is **60,101 issues across 39 projects**. Drop rows with `Story_Point == 0` (2,165 rows): in Jira, 0 usually means "not estimated" or "trivial" rather than an estimate on the scale.

### 4.2 Labels: the ordinal scale

Raw values are not clean. There are 1,459 issues with 0.5, 4,077 with 4, 1,106 with 10, 332 with 40, and others. Map every raw value to the **ordered bucket scale**:

```
BUCKETS = [1, 2, 3, 5, 8, 13, 21]      # 7 ordered classes, index 0..6
```

**Mapping rule:** choose the bucket closest to the raw value **on a log scale**. On a tie, choose the larger bucket. Values below 1 map to `1`, and values above 21 map to `21`. Some resulting mappings, which the implementation must reproduce:

| raw | 0.1–1 | 2 | 3 | 4 | 5–6 | 7–10 | 11–16 | ≥ 17 |
|---|---|---|---|---|---|---|---|---|
| bucket | 1 | 2 | 3 | 5 | 5 | 8 | 13 | 21 |

Keep both the **bucket index** (the training target) and the **raw value** (used for raw-point error metrics) in the prepared data.

> Story points are project-relative: a "5" in one project is not a "5" in another. That is why the project key is in the input text, and why per-project metrics are reported.

### 4.3 Split

Split chronologically **within each project**. Sort by `Creation_Date` (tie-break on `ID`). Assign the first 70% to **train**, the next 15% to **validation**, and the last 15% to **test**. Concatenate the splits across projects. This mimics real use, where you train on the past and predict the future, and avoids near-duplicate tickets leaking between splits.

### 4.4 Heads / formulations

| Head | Description | Default |
|---|---|---|
| `coral` | CORAL/CORN-style ordinal head: K−1 = 6 ordered threshold logits (see the `OrdinalHead` sketch in the research report or the `coral-pytorch` package). Prediction = number of thresholds with p > 0.5. | **Yes: primary for every model** |
| `regression` | One scalar trained with Huber loss on the bucket index, rounded and clipped to [0, 6]. | Optional ablation |
| `multiclass` | Plain 7-way softmax with cross-entropy. | Optional ablation |

By default, only `coral` runs for every model. The config MAY enable `regression`/`multiclass` for selected models. Each enabled head is a separate run unit.

### 4.5 Metrics (computed on test; also on validation)

| Metric | Definition | Role |
|---|---|---|
| `qwk` | Quadratic weighted Cohen's kappa on bucket index | **Primary** (model selection and leaderboard sort) |
| `mae_bucket` | Mean absolute error on bucket index | Secondary |
| `within_one_acc` | Share of predictions within ±1 bucket | Product metric |
| `exact_acc` | Exact bucket accuracy | Secondary |
| `macro_f1` | Macro-F1 over the 7 buckets | Rare-class health |
| `mae_raw_points` | MAE between the predicted bucket value and the raw story point | Comparability with the SP-estimation literature |
| `spearman` | Spearman ρ between predicted and true bucket index | Ordering quality |
| `ece` | Expected calibration error (10 bins) on the predicted class probability | Only for probabilistic heads |
| `confusion_matrix` | 7×7 matrix | Diagnostics |

### 4.6 Required baselines (run once, like any other unit, but no download)

- `baseline_median_per_project`: always predict the median training bucket of that project.
- `baseline_tfidf_ridge`: TF-IDF (1–2-grams, 50k features) + ridge regression on the bucket index, rounded.

A pretrained model that cannot beat `baseline_tfidf_ridge` is a finding the report must make visible.

### 4.7 Slices (report every metric per slice)

- per `Project_Key`
- per `Issue.Type` (the top 6 types plus "other")
- `text_changed_after_estimation`: rows where `Title_Changed_After_Estimation` or `Description_Changed_After_Estimation` is true, compared with rows where neither is. The text we train on is the *final* text, so these rows are slightly leaky, and we want to see the gap.

---

## 5. Task B — Assignee ranking

### 5.1 The question the model answers

Given a task text and one team member's profile, output a **suitability score**. Ranking all 48 members by that score gives the recommended shortlist. We deliberately do **not** train a 48-way "which user ID" classifier. The product must handle people joining and leaving, so a member is represented by their profile, never by their ID.

### 5.2 Label

`Task_Assignment.Plausibility` is the graded relevance: *"should this task be routed to this member?"* (see the dataset README). Any (task, member) pair **absent** from `Task_Assignment.csv` has relevance **0**. `Rank == 1` marks the single best-routed member.

> `Capability` is **not** the target. It answers "could they do it". The gap between `Capability` and `Plausibility` is used in evaluation to measure over-qualification (§5.6).

### 5.3 Inputs

- **Task text:** the canonical template from §3.
- **Member profile text:** build it from `User.csv` using exactly this template:
  ```
  Level: {Expertise_Level}. Area: {Expertise_Area}. Years of experience: {Years_Experience}. Role: {Role_In_Project} ({Role_Class}).
  ```
  Never include `Name` or `ID`.
- **Forbidden inputs:** everything in `Task_Profile.csv` (`Primary_Area`, `Required_Level`, …). These columns are internals of the scorer that *generated* the labels. Feeding them in turns the benchmark into "reverse-engineer the scorer" and makes every model look perfect. They are for **slicing evaluation only**.

### 5.4 Rows and split

- Exclude tasks with `Primary_Area == "Unclassified"` (about 18%) from **training**, because their labels are weak. Keep them in test as a separate slice.
- Use the same per-project chronological split as §4.3, applied to all issues (not only those with story points).
- The full space is ~350k tasks × 48 members, which is too large. **Sample deterministically**:
  - train: `train_tasks` tasks (default **50,000**)
  - validation: `val_tasks` (default **2,000**)
  - test: `test_tasks` (default **5,000** classified + **1,000** Unclassified)
- **Held-out members (cold start):** deterministically pick **one member per `Expertise_Area`** (9 members; seeded; never the only member at their level). Remove every pair involving them from **training**. They stay in the candidate pool at validation and test. This measures whether a model can rank a person it has never seen, which is the product's key requirement.

### 5.5 Training examples

For each training task:
- **positives:** every pair with `Plausibility > 0` (on average about 4.3 per task)
- **hard negatives:** up to `n_hard_negatives` (default 4) members with relevance 0 who share an `Expertise_Area` with a positive but sit at a different level, plus members with high `Capability` and low `Plausibility` (the over-qualified). Hard negatives teach level-appropriateness, which random negatives never will.
- **random negatives:** up to `n_random_negatives` (default 2).

How these are consumed depends on the model family (§6.2). Bi-encoders use (anchor, positive, negatives) tuples. Cross-encoders use pointwise pairs with `Plausibility` as a soft target, or a listwise loss.

### 5.6 Metrics (test: each task scores **all 48 members**)

| Metric | Definition | Role |
|---|---|---|
| `ndcg@10` | nDCG with gain = `Plausibility` | **Primary** |
| `ndcg@5` | as above, @5 | Secondary |
| `recall@5`, `recall@10` | Share of relevant (`Plausibility > 0`) members in the top K | Shortlist quality |
| `hit@1` | Predicted top-1 is the `Rank == 1` member | Strict product metric |
| `mrr` | Reciprocal rank of the `Rank == 1` member | Secondary |
| `spearman_plausibility` | Mean per-task Spearman ρ between predicted score and `Plausibility` over the 48 members | Calibration of the ordering |
| `overqualified_top1_rate` | Share of tasks where the predicted top-1 member's level is **above** `Task_Profile.Required_Level` | Wasted seniority |
| `underqualified_top1_rate` | Same, **below** | Stretched juniors |
| `latency_ms_per_task` | Wall-clock time to score all 48 members for one task (batch as the model allows) | Cost |

For bi-encoders, member embeddings MAY be precomputed once per evaluation; state which approach you used in the report.

### 5.7 Baselines

- `baseline_random`: random scores (seeded).
- `baseline_popularity`: rank members by how often they are `Rank == 1` in training.
- `baseline_tfidf_cosine`: TF-IDF cosine between task text and profile text.

### 5.8 Slices

per `Task_Profile.Primary_Area`, per `Task_Profile.Required_Level`, `unclassified` vs `classified`, and `held_out_members` (metrics restricted to tasks where at least one held-out member is relevant).

---

## 6. Candidate models

### 6.1 Registry

The registry lives in the config file (§11), not hard-coded. Default contents:

| Key | Hugging Face repo id | Params | License | Family | Task A | Task B |
|---|---|---:|---|---|:-:|:-:|
| `modernbert_base` | `answerdotai/ModernBERT-base` | 149M | Apache-2.0 | encoder | ✅ | ✅ cross-encoder |
| `neobert` | `chandar-lab/NeoBERT` | 250M | MIT | encoder | ✅ | ✅ cross-encoder |
| `deberta_v3_base` | `microsoft/deberta-v3-base` | 184M | MIT | encoder | ✅ | ✅ cross-encoder |
| `minilm_l6` | `sentence-transformers/all-MiniLM-L6-v2` | 23M | Apache-2.0 | embedder | ✅ | ✅ bi-encoder |
| `embeddinggemma_300m` | `google/embeddinggemma-300m` | 308M | Gemma (gated) | embedder | ✅ | ✅ bi-encoder |
| `bge_m3` | `BAAI/bge-m3` | 568M | MIT | embedder | ✅ | ✅ bi-encoder |
| `e5_large_instruct` | `intfloat/multilingual-e5-large-instruct` | 560M | MIT | embedder | ✅ | ✅ bi-encoder |
| `qwen3_embedding_0_6b` | `Qwen/Qwen3-Embedding-0.6B` | 0.6B | Apache-2.0 | embedder | ✅ | ✅ bi-encoder |
| `harrier_0_6b` | *verify on HF (Microsoft Harrier-OSS-v1-0.6B)* | 0.6B | MIT | embedder | ✅ | ✅ bi-encoder |
| `bitnet_embedding_0_6b` | *verify on HF (Microsoft BitNet-Embedding-0.6B)* | 0.6B | MIT | embedder (1.58-bit) | — | ✅ bi-encoder |
| `qwen3_reranker_0_6b` | `Qwen/Qwen3-Reranker-0.6B` | 0.6B | Apache-2.0 | reranker | — | ✅ cross-encoder |
| `qwen3_0_6b` | `Qwen/Qwen3-0.6B` | 0.6B | Apache-2.0 | generative | ✅ | ✅ yes/no scorer |

Rules:
- **Before running a unit, verify that the repo id exists** (`huggingface_hub.model_info`). Record the resolved commit **revision SHA** in the report. If the repo id is missing, marked "verify", or cannot be resolved, mark the unit `skipped` with a reason and continue. Never guess a different repo.
- **Gated models** (EmbeddingGemma) need the user to accept the license on Hugging Face and an `HF_TOKEN` environment variable. If access is denied, mark the unit `skipped: gated_access_denied`.
- The BitNet model's efficiency advantage needs `bitnet.cpp`. In this benchmark, run it through its standard Transformers/Sentence-Transformers path if one is supported, and record that CPU-runtime speed was **not** measured. If it cannot be loaded that way, mark it `skipped`.
- Model order: run the **baselines first**, then models from smallest to largest parameter count. This gives the fastest useful results and surfaces pipeline bugs cheaply.

### 6.2 Recipe per family

| Family | Task A recipe | Task B recipe |
|---|---|---|
| **encoder** | Backbone + mean pooling (or the model's CLS) + CORAL head, **full fine-tune** | **Cross-encoder**: `[task] [SEP] [profile]` → 1 logit; loss = BCE with soft target `Plausibility`, full fine-tune |
| **embedder** | Backbone with the model's native pooling + CORAL head. Full fine-tune if ≤ 300M params, else **LoRA** (r=16, α=32, dropout 0.05, all linear layers) | **Bi-encoder**: contrastive fine-tune (`MultipleNegativesRankingLoss` with the hard negatives from §5.5); LoRA if > 300M. Use each model's documented query instruction/prefix (e.g. Qwen3/E5 `Instruct: … Query: …`). Score = cosine similarity. |
| **reranker** | n/a | Cross-encoder using the model's native yes/no relevance template; LoRA; BCE with soft target |
| **generative** | LoRA SFT to emit a single bucket token (e.g. `"5"`); prediction = argmax over the 7 bucket tokens' log-probs, whose softmax gives class probabilities | Pointwise prompt "Is this member a good fit? yes/no"; score = P(yes); LoRA SFT with the soft target |

**Zero-shot measurement (Task B, embedders and rerankers):** before fine-tuning, evaluate the pretrained model on the **validation** set and record the result as `zero_shot_val_metrics`. This shows how much fine-tuning actually added.

---

## 7. Training protocol (the same rules for every model)

| Setting | Default | Notes |
|---|---|---|
| Seed | `20260916` | Set it for Python, NumPy, torch and CUDA. Use deterministic data order. |
| `max_seq_len` | 512 tokens (MiniLM: 256; cross-encoder pairs: 512 total) | Truncate the task description first, never the profile. |
| Epochs | Task A: 4 · Task B: 2 | |
| Early stopping | patience 1 epoch on the validation primary metric | Keep the **best validation checkpoint**; test only that one. |
| Learning rate | full FT 2e-5 · LoRA 2e-4 · heads 1e-3 | AdamW, linear decay, 6% warmup |
| Effective batch size | 32 | Use gradient accumulation to reach it |
| Precision | bf16 if supported, else fp16 | Gradient checkpointing allowed |
| Class imbalance (A) | none by default | Do not reweight: all models are treated the same |
| Hyperparameter search | **none** | Same budget for everyone |

- **The test split is touched exactly once per run unit**, after model selection on validation.
- **Out of memory:** allow **one** automatic retry that halves the per-device batch and doubles gradient accumulation, so the effective batch stays the same. Record `oom_retry: true` in the report. If it fails again, mark the unit `failed: oom` and continue with the next unit.
- Record wall-clock train time, peak GPU memory (`torch.cuda.max_memory_allocated`), and inference latency (median of the test-set per-sample or per-task timings, after 10 warm-up calls, batch size 1 **and** the batch size used).

---

## 8. The per-model lifecycle: pull → train → report → erase

For each run unit, in order:

1. **Pull.** Resolve the repo id and revision, then download to the Hugging Face cache (or a dedicated `cache_dir` from the config).
2. **Train.** Follow §6–§7. Intermediate training checkpoints go under `OA2/.work/<run_id>/`.
3. **Evaluate.** Run validation (best epoch) and then test once. Compute every metric and slice.
4. **Report.** Write the per-run JSON and predictions file, then update the leaderboard CSV (§10). **Write the report before deleting anything.**
5. **Erase.** Delete:
   - `OA2/.work/<run_id>/` (training checkpoints and the fine-tuned weights)
   - the downloaded model from the Hugging Face cache (`huggingface_hub.scan_cache_dir()` → delete that repo's revisions), *unless* another pending unit uses the same repo **immediately next**. In that case you MAY keep it until that unit finishes.
   - free GPU memory (`del model`, `gc.collect()`, `torch.cuda.empty_cache()`)

   Report the freed disk space in the log. A `--keep-weights` flag MAY disable the erase step for debugging. It is off by default.
6. **Mark complete** in the checkpoint store (§9).

The kept artifacts per unit are small: the report JSON, the predictions file, and the log. Model weights are never kept.

---

## 9. Checkpoint / resume system

**The storage mechanism is intentionally left to the implementer.** A JSON state file, an SQLite database, one marker file per unit: any of these is fine. What is fixed is the **behaviour**, and it must satisfy every rule below.

### Required behaviour

1. **Unit identity.** Every run unit has a stable `run_id`, for example `story_point__modernbert_base__coral__<cfg8>`, where `<cfg8>` is the first 8 hex characters of a hash over the resolved config for *that unit* (model id, recipe, hyperparameters, data fingerprint). If the relevant config changes, the unit gets a new ID and runs again. Old results are kept, not overwritten.
2. **States.** Each unit is in exactly one of `pending → running → completed | failed | skipped`.
3. **Resume.** On start-up, the script loads the state, prints a summary (e.g. `12 completed, 1 interrupted, 1 failed, 10 pending`), and continues with the first unit that is not `completed`/`skipped`.
4. **Interrupted units.** A unit found in `running` on start-up was interrupted. It MUST be restarted cleanly: wipe its `.work/` dir and partial outputs, then run it again. Resuming *mid-training* from the last epoch checkpoint is an **optional** enhancement. If you implement it, record `resumed_from_epoch` in the report.
5. **Failures do not stop the run.** Catch the exception, record `failed` with the error type, message and traceback in the state and in a `status: failed` report JSON, clean up, and continue. `--retry-failed` re-queues failed units.
6. **Completed means completed.** A `completed` unit is never re-run unless the user passes `--force <run_id|model_key>`.
7. **Atomic writes.** State and report files are written to a temp file and then renamed. A crash must never leave a half-written state file.
8. **Graceful stop.** On Ctrl+C (SIGINT) or SIGTERM, finish writing any in-progress report and state, leave the unit as `running` (so rule 4 applies next time), and exit with a clear message. A second Ctrl+C exits immediately.
9. **Single instance.** Prevent two concurrent runs on the same state, for example with a lock file that holds the PID. Report a clear error if the lock is held by a live process, and take over the lock if it is stale.
10. **Inspectable.** `--status` prints the table of units and their states without running anything.

State files live in `OA2/.state/` (git-ignored).

---

## 10. Report outputs

All outputs are written under this folder. Keep the two existing report directories with their current names:

```
OA2/
  reports_story_point/
    runs/<run_id>.json            # full report, one per unit (including failed/skipped)
    predictions/<run_id>.csv.gz   # test predictions: Issue_ID, true_bucket, pred_bucket, raw_sp, p_0..p_6
    leaderboard.csv               # one row per completed unit, sorted by test qwk desc
  reports_tast_assignment/        # (folder name kept as-is)
    runs/<run_id>.json
    predictions/<run_id>.csv.gz   # Issue_ID, User_ID, score, plausibility, rank_true
    leaderboard.csv               # sorted by test ndcg@10 desc
  SUMMARY.md                      # regenerated after every unit (see below)
```

### 10.1 Per-run JSON: required schema

Each report must be **self-contained**: someone who opens a single JSON file with no other context should understand what was tested and why.

```jsonc
{
  "schema_version": "1.0",
  "run_id": "story_point__modernbert_base__coral__a1b2c3d4",
  "status": "completed",                     // completed | failed | skipped
  "status_reason": null,                     // e.g. "oom", "gated_access_denied"

  "context": {
    "project": "Opti-Task",
    "benchmark": "OA2 model selection",
    "task": "story_point",                   // story_point | task_assignment
    "task_description": "Ordinal classification of Jira issue text into story-point buckets [1,2,3,5,8,13,21], for suggesting estimates on task creation.",
    "primary_metric": "qwk",
    "dataset": "TAWOS v1.1 staffing extension (synthetic 48-member team)",
    "caveats": ["Team is synthetic; Task B labels are a scorer's opinion, not observed outcomes.", "..."]
  },

  "model": {
    "key": "modernbert_base",
    "hf_repo_id": "answerdotai/ModernBERT-base",
    "revision_sha": "…",
    "family": "encoder",
    "license": "Apache-2.0",
    "total_params": 149000000,
    "trainable_params": 149000000,
    "recipe": "coral",                        // coral | regression | multiclass | cross_encoder | bi_encoder | ...
    "finetune_method": "full"                 // full | lora | none (baseline / zero-shot)
  },

  "data": {
    "fingerprint": "…",
    "n_train": 0, "n_val": 0, "n_test": 0,
    "label_distribution": { "train": {…}, "test": {…} },
    "held_out_member_ids": [ … ]              // Task B only
  },

  "training": {
    "hyperparameters": { "lr": 2e-5, "epochs_max": 4, "effective_batch": 32, "max_seq_len": 512, "seed": 20260916, "...": "..." },
    "best_epoch": 3,
    "epochs_run": 4,
    "history": [ { "epoch": 1, "train_loss": 0.0, "val_primary": 0.0 }, … ],
    "oom_retry": false,
    "resumed_from_epoch": null,
    "train_time_s": 0.0,
    "peak_gpu_mem_mb": 0
  },

  "metrics": {
    "zero_shot_val": { … },                   // Task B embedders/rerankers, else null
    "val": { … },
    "test": { … },                            // all metrics from §4.5 / §5.6
    "slices": { "project:XD": { … }, "type:Bug": { … }, … }
  },

  "efficiency": {
    "latency_ms_bs1_median": 0.0,
    "latency_ms_batched_median": 0.0,
    "batch_size_for_latency": 32,
    "throughput_items_per_s": 0.0
  },

  "environment": {
    "python": "3.x", "torch": "…", "transformers": "…", "sentence_transformers": "…", "peft": "…",
    "cuda": "…", "gpu": "NVIDIA …", "os": "…", "hostname_hash": "…"
  },

  "timestamps": { "started": "ISO-8601", "finished": "ISO-8601" },
  "disk_freed_mb": 0,
  "notes": [ "Any implementer decision not fixed by the README goes here." ],
  "error": null                               // { type, message, traceback } when failed
}
```

### 10.2 Leaderboard CSV

One row per `completed` unit. The columns are flat, so the file opens cleanly in Excel or pandas:

- **Common:** `run_id, task, model_key, hf_repo_id, revision_sha, family, recipe, finetune_method, total_params, trainable_params, license, best_epoch, train_time_s, peak_gpu_mem_mb, latency_ms_bs1_median, throughput_items_per_s, data_fingerprint, finished_at`
- **Task A:** `test_qwk, test_mae_bucket, test_within_one_acc, test_exact_acc, test_macro_f1, test_mae_raw_points, test_spearman, test_ece, val_qwk, delta_qwk_vs_tfidf`
- **Task B:** `test_ndcg@10, test_ndcg@5, test_recall@5, test_recall@10, test_hit@1, test_mrr, test_spearman_plausibility, test_overqualified_top1_rate, test_underqualified_top1_rate, test_heldout_ndcg@10, zero_shot_val_ndcg@10, val_ndcg@10, delta_ndcg@10_vs_tfidf`

Floats use 4 decimals. Regenerate the leaderboard from the `runs/*.json` files rather than appending blindly, so it always matches the JSONs.

### 10.3 SUMMARY.md

Regenerate this file after every unit. It is a short human-readable overview:

1. One paragraph of context: the project, the two tasks, and the dataset caveats.
2. For each task: the leaderboard as a Markdown table (top columns only), plus the best model by the primary metric and the best "efficiency-adjusted" model. That is the smallest/fastest model within 1 point (0.01) of the best primary metric.
3. Units that failed or were skipped, with their reasons.
4. The data fingerprint, the date, and the git commit of the repo.

Numbers only. **Do not** write speculative explanations for why a model won.

---

## 11. Configuration and CLI

### `config.yaml` (example; all keys required unless marked optional)

```yaml
seed: 20260916
dataset_dir: ../../datasets/TAWOS/TAWOS_staffing_dataset   # relative to this folder
output_dir: .                                               # OA2/
hf_cache_dir: null                                          # optional; null = default HF cache
tasks: [story_point, task_assignment]

story_point:
  buckets: [1, 2, 3, 5, 8, 13, 21]
  drop_zero: true
  split: {train: 0.70, val: 0.15, test: 0.15}
  heads: [coral]                       # add regression / multiclass for ablations
  epochs: 4

task_assignment:
  train_tasks: 50000
  val_tasks: 2000
  test_tasks: 5000
  test_unclassified_tasks: 1000
  n_hard_negatives: 4
  n_random_negatives: 2
  epochs: 2

training:
  effective_batch: 32
  max_seq_len: 512
  lr_full: 2.0e-5
  lr_lora: 2.0e-4
  lr_head: 1.0e-3
  warmup_ratio: 0.06
  lora: {r: 16, alpha: 32, dropout: 0.05}
  early_stopping_patience: 1

models:
  - key: modernbert_base
    hf_repo_id: answerdotai/ModernBERT-base
    family: encoder
    tasks: [story_point, task_assignment]
  # ... one entry per row of the §6.1 table; optional per-model overrides:
  #   max_seq_len, per_device_batch, query_prefix, enabled: false
```

### CLI

```
python run_model_selection.py [--config config.yaml]
      [--task story_point|task_assignment|all]   # default all
      [--only <model_key>[,<model_key>...]]      # run a subset
      [--force <run_id|model_key>]               # re-run completed units
      [--retry-failed]
      [--status]                                 # print unit table and exit
      [--dry-run]                                # resolve registry, verify repo ids, prepare data, list units; no training
      [--keep-weights]                           # debugging only
      [--limit-train N]                          # smoke test: cap training rows (report is marked "smoke": true and excluded from the leaderboard)
```

Logs go to the console and to `OA2/logs/<run_id>.log`.

---

## 12. Suggested file layout

This layout is only a suggestion. The only fixed names are the report directories, `README.md` and `config.yaml`.

```
apps/ai/model_selection/OA2/
  README.md
  config.yaml
  requirements.txt              # pinned versions
  run_model_selection.py        # CLI entry point / orchestrator
  oa2/
    data.py                     # load CSVs, build text, labels, splits, cache, fingerprint
    registry.py                 # model registry, repo verification
    checkpoint.py               # state store, lock, resume logic (§9)
    recipes/
      story_point.py            # heads (coral/regression/multiclass), training loop
      assignment.py             # bi-encoder / cross-encoder / generative scoring
      baselines.py
    metrics.py                  # all metrics + slicing
    report.py                   # JSON, CSV leaderboard, SUMMARY.md
    cleanup.py                  # HF cache + work dir erase
  reports_story_point/
  reports_tast_assignment/
  .cache/  .work/  .state/  logs/   # git-ignored
```

**Language: Python ≥ 3.10 (MUST).** This matches the other AI scripts in `apps/ai`, and the training stack below is Python-first. Do not add Node/TypeScript or other-language components to this benchmark.

Required libraries: `torch`, `transformers`, `sentence-transformers` (≥ 3, for bi-/cross-encoder training), `peft`, `huggingface_hub`, `pandas`, `pyarrow`, `scikit-learn`, `scipy`, `pyyaml`. Optionally `coral-pytorch`. Pin versions in `requirements.txt`.

---

## 13. Things you must NOT do

- ❌ Use post-estimation fields (`Timespent`, `*_Minutes`, `Resolution*`, `Status`, `Priority`, `Assignee_ID`, `Sprint_ID`, comments, change log) as inputs.
- ❌ Use `Task_Profile.csv` columns, member `Name`, or member `ID` as model inputs.
- ❌ Use `Issue.Assignee_ID` as a Task B label. It is real history, unrelated to the synthetic team.
- ❌ Tune hyperparameters per model, or evaluate on test more than once per unit.
- ❌ Randomly shuffle issues across time for the split.
- ❌ Silently substitute a different model when a repo id fails. Skip it and report why.
- ❌ Keep model weights after a unit finishes (unless `--keep-weights`).
- ❌ Overwrite or delete reports from earlier units or earlier configs.
- ❌ Put tokens or secrets in `config.yaml` or in reports. Use `HF_TOKEN` from the environment.

---

## 14. Definition of done

The implementation is complete when all of the following are true:

- [ ] `--dry-run` prepares the data, prints the split sizes for both tasks, verifies every repo id, and lists every run unit with its `run_id`.
- [ ] A smoke run (`--limit-train 500 --only minilm_l6`) completes both tasks end to end, writes reports and predictions, and erases the model from disk.
- [ ] Killing the process mid-training and restarting it resumes at the interrupted unit, and does not re-run completed units.
- [ ] A forced failure (e.g. an invalid repo id in the config) is recorded as `failed`/`skipped` and the run continues.
- [ ] Every completed unit has a JSON report that validates against §10.1, and a leaderboard row.
- [ ] Both leaderboards include the baselines.
- [ ] `SUMMARY.md` renders the leaderboards and lists failures/skips.
- [ ] Re-running a completed unit with `--force` on the same machine reproduces its test primary metric to within ±0.005.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Run unit** | One (task, model, recipe) combination; the unit of checkpointing and reporting. |
| **Story point** | An agile team's relative effort estimate for a task, usually on a Fibonacci-like scale. |
| **Ordinal classification / CORAL** | Predicting an ordered category, where near misses (5 vs 8) are better than far misses (1 vs 13). CORAL learns K−1 ordered thresholds. |
| **QWK** | Quadratic weighted kappa: agreement between predicted and true ordinal labels, penalising distant errors quadratically. 1 = perfect, 0 = chance. |
| **Bi-encoder** | Encodes the task and the profile separately into vectors and compares them with cosine similarity. Fast, and member vectors can be precomputed. |
| **Cross-encoder / reranker** | Reads the task and the profile together and outputs one score. Usually more accurate and slower. |
| **nDCG@K** | Ranking quality in the top K, weighting relevant items higher the closer they are to the top. Graded by `Plausibility` here. |
| **Hard negative** | A plausible-looking but wrong candidate (e.g. the right area but the wrong level) used to make training harder and more useful. |
| **LoRA** | Low-rank adapters: fine-tunes a small number of added parameters instead of the whole model. Used for the ~0.6B models. |
| **Capability vs Plausibility** | Dataset scores: *could* this member do the task, and *should* it be routed to them. See the dataset README. |
| **Cold start / held-out members** | Team members never seen during training. They test whether the model generalises to new hires. |
