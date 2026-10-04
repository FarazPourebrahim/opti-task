# OA2 — Implementation notes

This document describes **how** the benchmark specified in [`README.md`](README.md) was implemented: the code layout, the control flow, every place where the README left a choice open, and the rough edges you should know about before trusting (or modifying) the numbers.

The README is the specification and is intentionally left unchanged. When this document and the code disagree, the code is the truth — please fix this document.

> **Current data budget: "scenario B" (reduced runtime).** `config.yaml` deliberately runs smaller than the README defaults:
>
> | Setting | README default | Configured (scenario B) |
> |---|---|---|
> | `story_point.train_fraction` (new key) | 1.0 (~40.5k issues) | **0.25** (~10k issues, sampled per project) |
> | `task_assignment.train_tasks` | 50,000 | **5,000** |
> | `task_assignment.val_tasks` | 2,000 | **500** |
> | `task_assignment.test_tasks` | 5,000 | **2,000** |
> | `task_assignment.test_unclassified_tasks` | 1,000 | **500** |
>
> Task A validation and test stay full size. Every model gets the same budget, so the comparison stays fair, but absolute scores are lower than at full size and larger models may be handicapped more. Rare required levels (Staff ≈ 100, Intern ≈ 40, Principal ≈ 30 training tasks) are thin in Task B. The budget is stated in every report's `context.caveats` and at the top of `SUMMARY.md`. To run at full size, restore the README values in `config.yaml`; that yields new fingerprints and run IDs and never overwrites scenario-B results.

---

## Table of contents

1. [Status and what has been verified](#1-status-and-what-has-been-verified)
2. [Quick start](#2-quick-start)
3. [File layout](#3-file-layout)
4. [End-to-end control flow](#4-end-to-end-control-flow)
5. [Configuration](#5-configuration)
6. [Data preparation (`oa2/data.py`)](#6-data-preparation-oa2datapy)
7. [Run units, run IDs and ordering (`oa2/registry.py`)](#7-run-units-run-ids-and-ordering-oa2registrypy)
8. [Pull: repo verification and download](#8-pull-repo-verification-and-download)
9. [Model building blocks (`oa2/models.py`)](#9-model-building-blocks-oa2modelspy)
10. [The shared training loop (`oa2/training.py`)](#10-the-shared-training-loop-oa2trainingpy)
11. [Task A recipes (`oa2/recipes/story_point.py`)](#11-task-a-recipes-oa2recipesstory_pointpy)
12. [Task B recipes (`oa2/recipes/assignment.py`)](#12-task-b-recipes-oa2recipesassignmentpy)
13. [Baselines (`oa2/recipes/baselines.py`)](#13-baselines-oa2recipesbaselinespy)
14. [Metrics and slices (`oa2/metrics.py`)](#14-metrics-and-slices-oa2metricspy)
15. [Efficiency measurements](#15-efficiency-measurements)
16. [Reports (`oa2/report.py`)](#16-reports-oa2reportpy)
17. [Checkpoint / resume (`oa2/checkpoint.py` + orchestrator)](#17-checkpoint--resume-oa2checkpointpy--orchestrator)
18. [Erase step (`oa2/cleanup.py`)](#18-erase-step-oa2cleanuppy)
19. [Determinism and reproducibility](#19-determinism-and-reproducibility)
20. [Interpretations of the README](#20-interpretations-of-the-readme)
21. [Known limitations and gotchas](#21-known-limitations-and-gotchas)
22. [Hardware notes (GTX 1650, 4 GB)](#22-hardware-notes-gtx-1650-4-gb)
23. [How to extend](#23-how-to-extend)
24. [Troubleshooting](#24-troubleshooting)

---

## 1. Status and what has been verified

| Area | State |
|---|---|
| All modules | Byte-compile cleanly (`python -m py_compile`). |
| Bucket mapping (§4.2) | Tested: reproduces the README table exactly; a self-check runs on every data preparation and aborts if it ever drifts. |
| Chronological split, text cleaning, held-out member pick | Tested on synthetic data and the real `User.csv`. |
| Task A / Task B metrics | Tested on hand-made inputs. |
| Task B training-example construction, Parquet cache round-trip, `relevance()` | Tested on a synthetic sample. |
| Run IDs, unit ordering, leaderboards, `SUMMARY.md` | Tested with fake report JSONs. |
| **Model loading, training, OOM retry, pull/erase, resume, signal handling** | **Not executed yet.** `torch`, `transformers`, `sentence-transformers`, `peft`, `huggingface_hub` and `pyyaml` were not installed when the code was written. The first `--dry-run` and smoke run are the real test. |

Treat the first runs as integration testing: expect to fix small API mismatches.

---

## 2. Quick start

```bash
cd apps/ai/model_selection/OA2
pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cu126   # CUDA build first
pip install -r requirements.txt
export HF_TOKEN=...            # only needed for gated models (EmbeddingGemma); PowerShell: $env:HF_TOKEN="..."

python run_model_selection.py --dry-run                        # prepare data, verify repos, list units
python run_model_selection.py --limit-train 500 --only minilm_l6   # smoke test (README §14)
python run_model_selection.py                                  # the real thing (resumable)
python run_model_selection.py --status                         # unit table, no side effects
```

Other flags: `--task story_point|task_assignment|all`, `--only k1,k2` (baseline keys are accepted too), `--force <run_id|model_key>` (repeatable or comma-separated), `--retry-failed`, `--keep-weights`, `--config path`.

Exit codes: `0` success, `2` another instance holds the lock, `130` stopped by Ctrl+C / SIGTERM.

---

## 3. File layout

```
OA2/
  README.md                  # the specification (unchanged)
  IMPLEMENTATION.md          # this file
  config.yaml                # all settings + the model registry
  requirements.txt           # pinned versions
  .gitignore                 # .cache/ .work/ .state/ logs/ __pycache__/
  run_model_selection.py     # CLI + orchestrator (unit lifecycle, OOM retry, resume queue)
  oa2/
    common.py                # hashing, atomic writes, seeding, logging, env info, git commit, GracefulStop, UnitSkipped
    data.py                  # CSV loading, canonical text, labels, splits, sampling, negatives, Parquet cache, fingerprints
    registry.py              # units + run IDs, ordering, HF verification (model_info) and pull (snapshot_download)
    checkpoint.py            # StateStore (state.json) and InstanceLock (PID lock file)
    models.py                # precision, LoRA, pooled encoders, ordinal heads, CausalScorer
    training.py              # fit() loop, early stopping, OOM detection, latency timing
    metrics.py               # Task A + Task B metrics and slices
    report.py                # per-run JSON, predictions, leaderboards, SUMMARY.md, archiving
    cleanup.py               # erase work dir + HF cache entry
    recipes/
      __init__.py            # RunContext, limit_rows (smoke mode), chunks
      story_point.py         # Task A: encoder/embedder + head, generative SFT
      assignment.py          # Task B: cross-encoder, bi-encoder, yes/no scorers
      baselines.py           # the five required baselines
  reports_story_point/       # created on first run: runs/, predictions/, leaderboard.csv
  reports_tast_assignment/   # (folder name kept as-is, per README)
  SUMMARY.md                 # regenerated after every unit
  .cache/ .work/ .state/ logs/   # git-ignored runtime folders
```

Imports are deliberately light at the top level: `--status` only needs `pyyaml`, `numpy` and `pandas` (the data fingerprint is computed from file sizes/mtimes, not from reading the CSVs). `torch` and the HF stack are imported lazily inside the functions that need them.

---

## 4. End-to-end control flow

`run_model_selection.py:main()`:

1. Reconfigure stdout/stderr to UTF-8 (Windows consoles default to cp1252).
2. Parse arguments; `--force` values are split on commas into a set.
3. `load_config()`: read YAML, resolve `dataset_dir`, `output_dir`, `hf_cache_dir` relative to the config file's folder, check required keys, reject duplicate model keys, check the dataset folder exists.
4. `data.fingerprints(cfg)`: one fingerprint per task (§6.1). Cheap — no CSV is read.
5. `registry.build_units(...)`: every run unit with its run ID, in execution order (§7). Then `--task` / `--only` filtering.
6. `StateStore(OA2/.state)`: load `state.json` (or start empty).
7. Branches:
   - `--status` → print table, exit. No lock, no writes.
   - `--dry-run` → prepare data (writes the data cache), print split sizes, verify every distinct repo, print the unit table. No lock, no state writes.
   - otherwise → install signal handlers, take the instance lock, `run_all()`.

`run_all()`:

1. Log the state summary (`N completed, N interrupted, N failed, N skipped, N pending`).
2. Build the queue (§17.3).
3. Prepare data only for the tasks present in the queue (`data.prepare`, cached).
4. Capture environment info once.
5. For each queued unit call `run_unit()`, telling it whether the **next** queued unit uses the same HF repo (so the download can be kept).
6. Regenerate leaderboards + summary; log the final state summary.

`run_unit()` — the per-model lifecycle (README §8):

```
[critical] archive previous report/predictions, wipe .work/<run_id>, state := running (attempts += 1)
try:
    baseline  → baselines.run()
    model     → verify_repo() → revision SHA
                pull()        → local snapshot path
                _execute_model() → recipe.run(); on CUDA OOM: free memory, retry once at half micro-batch
except UnitSkipped → status skipped (+reason)
except KeyboardInterrupt → re-raise (unit stays "running")
except Exception → status failed (reason "oom" or exception class name, full traceback kept)
build report dict
[critical] write predictions (completed only), write report JSON, regenerate leaderboards + SUMMARY.md
erase (unless --keep-weights): free GPU memory, delete .work/<run_id>, delete HF cache entry (unless the next unit reuses it)
[critical] rewrite report with disk_freed_mb, state := completed|failed|skipped
```

"[critical]" means the block runs inside `GracefulStop.critical()`: a Ctrl+C that arrives during it is deferred until the block finishes (§17.6).

Each unit's log lines go to the console **and** `OA2/logs/<run_id>.log` (a `FileHandler` is attached for the duration of the unit). Data-preparation logging goes to the console only.

---

## 5. Configuration

`config.yaml` follows README §11 with these additions:

| Key | Purpose |
|---|---|
| `story_point.train_fraction` (0.25; README-equivalent 1.0) | Share of the Task A train split that is used, sampled per project (§6.6). Must be in (0, 1]. Part of the Task A fingerprint. |
| `data.max_text_chars` (8000) | Descriptions are cut to this many characters at prep time. Models read ≤ 512 tokens (~2–3k chars), so this only bounds cache size and tokenization time. Part of the data fingerprint. |
| `task_assignment.overqualified_min_gap` (0.10) | Minimum `Capability − Plausibility` for the "over-qualified" extra negative (§12.2). Part of the Task B fingerprint. |
| `task_assignment.query_instruction` | Instruction text substituted into `{instruction}` in query prefixes and the reranker template. |
| `training.per_device_batch` (8) | Micro-batch; accumulation = `effective_batch // per_device_batch`. |
| `training.eval_batch` (32) | Inference batch (texts for Task A, *pairs* for cross-encoders / yes-no scorers, tasks for bi-encoders). |
| `training.weight_decay` (0.01), `max_grad_norm` (1.0) | AdamW decay; gradient clipping. Not in the README; standard values, applied identically to every model. |
| `training.lora_param_threshold_m` (300) | Embedders with more parameters than this (actual count, in millions) are LoRA-tuned. |
| `training.gradient_checkpointing` (true) | README §7 "allowed"; enabled by default because of 4 GB of VRAM. |
| `training.latency_samples` (200), `latency_warmup` (10), `latency_batch_tasks` (8) | §15. |

Per-model optional keys: `max_seq_len`, `per_device_batch`, `eval_batch`, `precision` (`fp32|fp16|bf16`), `heads` (Task A heads for this model), `query_prefix` (may contain `{instruction}`), `doc_prefix`, `trust_remote_code`, `revision` (pin a specific revision instead of `main`), `enabled: false`, `params_m` (used **only for ordering**), `license` (copied into reports).

Registry decisions in the shipped config:

- `harrier_0_6b` and `bitnet_embedding_0_6b` have `hf_repo_id: null` → always `skipped: repo_id_unverified` until someone fills in a verified ID (README: never guess).
- `embeddinggemma_300m` has `precision: fp32` (Gemma-3-based embedders do not support fp16 activations) and the documented `task: search result | query: ` / `title: none | text: ` prompts.
- `e5_large_instruct` uses `Instruct: {instruction}\nQuery: ` (with a space); `qwen3_embedding_0_6b` uses `Instruct: {instruction}\nQuery:` (no space, as in the model card). Documents get no prefix for both.
- `bge_m3` and `minilm_l6` use no prefixes.
- Models ≥ 500M params get `per_device_batch: 4`.
- `neobert` has `trust_remote_code: true`.

**Changing any hyperparameter that is part of a unit's hash gives that unit a new run ID** (§7.2); old results remain on disk and in the state file.

---

## 6. Data preparation (`oa2/data.py`)

### 6.1 Fingerprints

`fingerprints(cfg)` returns `{"story_point": fp, "task_assignment": fp}`, each the first 16 hex chars of a SHA-256 over canonical JSON of:

- common: `PREP_VERSION` (`"1"`, bump it when prep logic changes), `seed`, `max_text_chars`, and for each of the 7 used CSVs its `size` and `mtime_ns`;
- Task A: `buckets`, `drop_zero`, `split`, `train_fraction`;
- Task B: `train_tasks`, `val_tasks`, `test_tasks`, `test_unclassified_tasks`, `n_hard_negatives`, `n_random_negatives`, `overqualified_min_gap`, and the (shared) `split`.

**Deviation from the README's single fingerprint:** there is one per task, so changing Task B sampling does not invalidate every Task A result. Each report records the fingerprint of its own task.

Because mtimes are included, simply touching or re-extracting the dataset (e.g. from the zip) changes the fingerprint and therefore **every run ID**. That is by design (README §3), but it is the most likely cause of "why is everything pending again?".

### 6.2 Cache

`.cache/data/<task>_<fingerprint>/` holds `train/val/test.parquet` (Task A) or `tasks/pairs/members/train_examples.parquet` (Task B) plus `meta.json`. The folder is written as `<name>.tmp` and then renamed into place, so a crash never leaves a half-built cache that looks valid (a cache is only "hit" if `meta.json` exists). Old fingerprint folders are never deleted automatically.

`prepare(cfg, tasks, fps)` loads whatever is cached and builds the rest. `Issue.csv` is read **once** even if both tasks need rebuilding.

### 6.3 Loading `Issue.csv`

Columns read: `ID, Title, Description_Text, Type, Story_Point, Creation_Date, Project_ID, Title_Changed_After_Estimation, Description_Changed_After_Estimation` — everything as strings with `keep_default_na=False`, then converted. `Estimation_Date` is not needed (the split uses `Creation_Date`). Nothing post-estimation is loaded, so leakage through the text template is structurally impossible.

`Comment.csv` and `Change_Log.csv` are never opened.

### 6.4 Canonical text

```
[Project: {Project_Key}] [Type: {Type}] [Components: {names or "none"}]
{Title}
{Description_Text}
```

Cleaning (`_clean`), applied to title, description, type and component names:

1. Strip surrounding whitespace.
2. **Strip wrapping quotes.** TAWOS stores many titles as `"How do I …"` and descriptions as `"""The jobs …"""` (literal quote characters inside the field). Up to 3 quote characters are removed from each end, but only as many as appear on *both* ends and only if the string is longer than the quotes. A description that legitimately starts and ends with a quotation will lose those quotes — an accepted, harmless loss.
3. Collapse every whitespace run (including newlines inside the description) to a single space. The three-line structure of the template is kept; only the content of each line is flattened.
4. Descriptions only: cut to `max_text_chars`.

Components: `Issue_Component` joined to `Component.Name`, cleaned, de-duplicated, **sorted alphabetically**, joined with `", "`. The trailing text is `rstrip`-ed, so an empty description leaves no trailing newline.

Truncation to `max_seq_len` happens at tokenization time and always cuts from the end, so the header and title survive.

### 6.5 Chronological split (`chrono_split`)

Per `Project_ID`: sort by `(Creation_Date, ID)` (unparseable dates sort last; stable mergesort), take position `pos` within the project and size `n`:

- `pos < floor(0.70·n)` → train
- `pos < floor(0.85·n)` → val
- else → test

Flooring means small projects give slightly more rows to test than to val. Task A applies it to story-pointed issues only; Task B applies it to **all** issues (README §5.4), so the same issue can be in different splits for the two tasks.

### 6.6 Task A rows and labels

- `Story_Point` empty → NULL (excluded). Parsed with `to_numeric`.
- `drop_zero: true` removes the 0-point rows; rows `< 0` are also removed (they cannot be placed on a log scale; none are expected).
- `to_bucket(raw)`: clamp to [1, 21], then choose the bucket with the smallest `|log(raw) − log(b)|`; on a tie (within 1e-12) the **larger** bucket wins. `_check_bucket_table` asserts the README table (0.1, 0.5, 1 → 1; 4, 5, 6 → 5; 7–10 → 8; 11–16 → 13; ≥ 17 → 21) whenever the default buckets are used.
- `type_slice`: the 6 most frequent `Type` values over **all** Task A rows (ties broken alphabetically), everything else → `"other"`.
- `changed`: true if either `*_Changed_After_Estimation` column is `1/true/t/yes`.
- Stored columns: `Issue_ID, project_key, type, type_slice, changed, raw_sp, bucket, text`, each split sorted by `Issue_ID`.
- **Training fraction** (`_fraction_per_project`): if `train_fraction < 1`, each project keeps `round(fraction × n)` of its training rows (at least 1), chosen with the seeded generator `rng_for(seed, "sp_train_fraction")`, projects visited in alphabetical order; the result keeps `Issue_ID` order. Sampling per project keeps small projects represented. Validation and test are never reduced. The type slices are computed before sampling, so they do not depend on the fraction.
- `meta.json` records counts (with SP, zeros dropped, rows, projects), `train_fraction`, `n_train_available` (train rows before sampling), split sizes (after sampling), the top types, the observed raw→bucket mapping, and per-split label distributions. `--dry-run` prints these; compare them with the README's 60,101 / 2,165.

### 6.7 Task B tasks

1. Split all issues (§6.5), join `Task_Profile.Primary_Area` and `Required_Level`, flag `unclassified = Primary_Area == "Unclassified"`.
2. Sample deterministically (each with its own generator, §19). Sizes below are the config keys; scenario B uses 5,000 / 500 / 2,000 + 500:
   - train: `train_tasks` from train ∧ classified
   - val: `val_tasks` from val ∧ classified (**val is classified-only** — model selection on the clean labels)
   - test: `test_tasks` from test ∧ classified **plus** `test_unclassified_tasks` from test ∧ unclassified
   If a pool is smaller than requested, all of it is used.
3. `pairs` = the `Task_Assignment.csv` rows for the sampled tasks only.
4. `members` = `User.csv` sorted by `User_ID`, with the profile text built from exactly the README template. `Name` and `ID` never appear in any model input.

### 6.8 Held-out (cold-start) members

`_pick_held_out`: for each `Expertise_Area` (in `User.csv` order), candidates are that area's members whose **level occurs more than once in the whole team**; one is picked with a seeded generator from the sorted candidate IDs. This interprets "never the only member at their level" team-wide, which excludes only the single Principal. With the default seed the result is `[7, 15, 21, 28, 29, 33, 39, 41, 47]` (one per area).

Held-out members are removed from **every training pair** (as positives and as negatives) and from the popularity baseline's counts, but stay in the 48-member candidate pool at validation and test.

### 6.9 Training examples (README §5.5)

`_build_train_examples` produces one row per training task:

| Column | Content |
|---|---|
| `positives`, `pos_plaus` | Non-held-out members present in `Task_Assignment` for this task, sorted by Plausibility desc (then `User_ID`). |
| `hard_negs` | Up to `n_hard_negatives` from the "zero pool" (non-held-out members *absent* from the task's pairs, i.e. relevance 0) that share an area with at least one positive **and** differ in level from that positive. Shuffled with the seeded generator before truncation. |
| `random_negs` | Up to `n_random_negatives` from the rest of the zero pool. |
| `overq_user` | See below; `-1` if none. |

**The over-qualified nuance.** The README asks for hard negatives that include "members with high Capability and low Plausibility". In this dataset *every* row of `Task_Assignment.csv` has `Plausibility > 0` (min 0.1635), so no over-qualified member has relevance 0 — they are all positives with a low soft target. Therefore:

- Cross-encoders / yes-no scorers already see over-qualified members as low-target positives; nothing extra is needed.
- For bi-encoders, `overq_user` is the positive (excluding the top one) with the largest `Capability − Plausibility`, if that gap is ≥ `overqualified_min_gap`. It is added as an **extra negative only for the task's top positive** (§12.2), teaching "the right-level member ranks above the over-qualified one" without contradicting the graded labels.

Tasks whose positives are all held-out end up with an empty `positives` list: they still contribute negatives to pointwise training and are skipped by the bi-encoder.

### 6.10 `AssignmentData.relevance(task_ids)`

Returns dense `[T, 48]` matrices: `rel` (Plausibility, 0 if absent), `rank` (0 if absent), and `top1` (member index of the `Rank == 1` member, `-1` if none). All Task B evaluation goes through it.

---

## 7. Run units, run IDs and ordering (`oa2/registry.py`)

### 7.1 Which units exist

| Family | Task A recipe(s) | Task B recipe |
|---|---|---|
| encoder | each of `heads` (default `[coral]`) | `cross_encoder` |
| embedder | each of `heads` | `bi_encoder` |
| reranker | — (never) | `reranker_yes_no` |
| generative | `generative_sft` (heads ignored) | `generative_yes_no` |
| baseline (built-in) | `median_per_project`, `tfidf_ridge` | `random`, `popularity`, `tfidf_cosine` |

A model runs a task only if the task is in both its `tasks` list and the global `tasks`.

### 7.2 Run ID

`<task>__<model_key>__<recipe>__<cfg8>`, where `cfg8` = first 8 hex of SHA-256 over:

- models: task, model key, `hf_repo_id`, `revision`, family, recipe, `trust_remote_code`, the **resolved hyperparameters** (the whole `training` block with per-model overrides applied, the task's `epochs`, `seed`, `precision_override`, and for Task B the instruction, query/doc prefixes and negative counts), the task's data fingerprint, and `limit_train`;
- baselines: task, key, recipe, `seed`, the TF-IDF/ridge settings, the data fingerprint, `limit_train`.

Consequences:
- Changing, say, `latency_samples` re-queues every model unit (it is part of the `training` block) but no baselines.
- Smoke runs (`--limit-train`) have their own IDs, so they never collide with real results.
- `per_device_batch` is part of the hash on purpose: for bi-encoders it changes the number of in-batch negatives and therefore the result.

### 7.3 Order (README §6.1)

1. All baselines: Task A then Task B.
2. Models sorted by `params_m` from the config (missing → last), ties in config order; for each model its Task A unit(s) then its Task B unit.

Keeping a model's units adjacent is what lets the erase step keep the download for the immediately following unit.

---

## 8. Pull: repo verification and download

`verify_repo(entry)`:

- `hf_repo_id` missing, containing "verify", or without a `/` → `UnitSkipped("repo_id_unverified")` (no network call).
- `huggingface_hub.model_info(repo, revision=entry.get("revision"))` → `revision_sha` recorded in the report.
- `GatedRepoError` → `skipped: gated_access_denied`; `RevisionNotFoundError` → `skipped: revision_not_found`; `RepositoryNotFoundError` → `skipped: repo_not_found`.
- Any other error (network, 5xx, …) propagates → the unit is **failed** (retryable with `--retry-failed`), not skipped.

`pull(repo, sha, cache_dir)`: `snapshot_download` of **that exact SHA** into the HF cache (or `hf_cache_dir`), ignoring ONNX/OpenVINO/TF/Flax/Rust/TFLite/CoreML/GGUF artifacts to save disk, with `max_workers=1` (on Windows without symlink rights, `huggingface_hub`'s per-folder symlink probe races between its download threads and fails with `WinError 1314`; serial download avoids it at negligible cost). Gated errors (or HTTP 401/403) → `skipped: gated_access_denied`. For gated repos, `model_info` usually succeeds without a token (metadata is public), so the skip normally happens here.

All models are then loaded **from the returned local snapshot folder**, never by repo name, so the revision that was verified is the revision that was trained. `HF_TOKEN` is read from the environment by `huggingface_hub`; it is never written anywhere.

---

## 9. Model building blocks (`oa2/models.py`)

### 9.1 Precision

`resolve_precision(override)`: `fp32` on CPU; otherwise the per-model `precision` override if set; otherwise `bf16` if the GPU's compute capability is ≥ 8 and bf16 is supported, else `fp16`. A GTX 1650 (sm_75) gets **fp16**.

- Fully fine-tuned models keep **fp32 master weights** and run the forward under `torch.autocast`; fp16 uses a `GradScaler`.
- LoRA models store the **frozen base weights in the half type** (`weight_dtype`) to save memory; the LoRA adapters are created by PEFT in fp32 (its default `autocast_adapter_dtype`), and the heads are fp32, so the optimizer never sees fp16 parameters.
- `fp32` precision disables autocast entirely.

Every model is first loaded in fp32 on the CPU, its parameters are counted (that is `total_params`), and only then is it cast/wrapped/moved to the GPU.

### 9.2 LoRA

`apply_lora`: `LoraConfig(r=16, alpha=32, dropout=0.05, target_modules="all-linear", bias="none")`. `all-linear` excludes the LM head for causal models. Task type `CAUSAL_LM` for reranker/generative; none for Sentence-Transformers backbones (the adapter is injected into `st[0].auto_model`, and the ST pooling/normalize modules are untouched).

Which models get LoRA:
- encoder family: never (full fine-tune, README §6.2);
- embedders: if the **actual** parameter count > `lora_param_threshold_m` × 1e6 (so EmbeddingGemma at ~308M gets LoRA, MiniLM does not);
- reranker, generative: always.

`trainable_params` in the report counts adapter + head parameters for LoRA units.

### 9.3 Gradient checkpointing

`gradient_checkpointing_enable(use_reentrant=False)` on the HF model (the ST backbone for embedders), before LoRA is applied. Non-reentrant checkpointing does not need `enable_input_require_grads`. If a model's code does not support it (possible for remote-code models), training continues without it and a note is added.

### 9.4 `HFEncoder` (encoder family)

`AutoModel` + `AutoTokenizer` from the snapshot, with attention-masked **mean pooling** over the last hidden state (fp32 accumulation not forced; pooling runs in the autocast dtype).

- ModernBERT: `config.reference_compile = False` to stop it from trying `torch.compile` (no Triton on Windows).
- The tokenizer output is filtered against the model's `forward` signature. This drops `token_type_ids` for models that don't accept them (NeoBERT uses the BERT tokenizer but its forward has no such argument).
- Pairs are encoded with `truncation="only_first"`, so only the task text is ever truncated (README §7).

### 9.5 `STEncoder` (embedder family)

A `SentenceTransformer` loaded from the snapshot, used with its **native** pipeline (pooling, normalization, padding side — e.g. Qwen3-Embedding's last-token pooling with left padding). `max_seq_length` is set to `min(config max_seq_len, model's own limit)`. Forward returns `sentence_embedding`.

### 9.6 Ordinal heads (README §4.4)

| Head | Parameters | Loss | Prediction | Probabilities |
|---|---|---|---|---|
| `coral` | one shared `Linear(d, 1, bias=False)` + 6 free biases (init 0) | BCE-with-logits against level targets `y > j`, j = 0..5 | number of `sigmoid(logit_j) > 0.5` | `P(y=0)=1−σ₀`, `P(y=j)=σ_{j−1}−σ_j`, `P(y=6)=σ₅`; clamped at 0 and renormalized |
| `regression` | `Linear(d, 1)` | Huber on the bucket index | round, clip to [0, 6] | none (ECE = null, `p_*` columns empty) |
| `multiclass` | `Linear(d, 7)` | cross-entropy | argmax | softmax |

The CORAL head is the canonical rank-consistent CORAL layer (shared weights). It is implemented in-house; `coral-pytorch` is not required.

### 9.7 `CausalScorer` (reranker + generative)

A thin wrapper that avoids the biggest memory trap of scoring with a 151k-token vocabulary:

- Inputs are built as **token-ID lists**, not strings, so the template and profile can be protected from truncation exactly (`compose_ids`: `pre + task[:budget] + mid + profile + suf`, where the budget is whatever is left of `max_seq_len`).
- Batches are **left-padded by hand**; `position_ids = cumsum(mask) − 1` so padded rows get the same positions as unpadded ones.
- It calls the **decoder only** (`base_model.model`) to get hidden states, then projects just the positions and vocabulary rows it needs (`logits_for(h, token_ids)`): 2 rows (`yes`/`no`) for Task B, or the last ≤ 3 positions for Task A. Full `[B, T, V]` logits are never materialized.
- Under PEFT, the LoRA layers are injected in place, so calling the inner decoder still uses the adapters.

The chat templates are **Qwen-specific** (`<|im_start|>`, `<|im_end|>`, empty `<think>` block). The reranker template is Qwen3-Reranker's documented one; the generative templates are this implementation's own (§11.2, §12.3).

---

## 10. The shared training loop (`oa2/training.py`)

`fit(modules, param_groups, n_items, step_loss, evaluate, epochs, tcfg, per_device_batch, precision, work_dir, seed)`:

- **Accumulation:** `accum = effective_batch // per_device_batch` (32 // 8 = 4). The optimizer steps every `accum` micro-batches and at the end of each epoch. The loss is always divided by `accum`, so a short final group is slightly under-weighted — a negligible, uniform effect.
- **Optimizer:** AdamW with weight decay 0.01 on **all** parameters (biases and norms included — uniform and simple, not the usual exclusion). Two parameter groups: backbone (`lr_full` 2e-5 or `lr_lora` 2e-4) and head (`lr_head` 1e-3). Generative/yes-no models have only the LoRA group.
- **Schedule:** `get_linear_schedule_with_warmup`, warmup = 6% of the total steps, where total steps are computed for the **maximum** number of epochs. With early stopping the LR therefore never fully decays — standard behaviour, identical for every model.
- **Clipping:** `clip_grad_norm_(…, 1.0)` after unscaling.
- **Data order:** each epoch shuffles indices with `np.random.default_rng([seed, epoch])` and chunks them into micro-batches. Deterministic and independent of any other randomness.
- **Validation:** after every epoch, in `eval()` mode under `no_grad`, on the full validation split. Primary = QWK (Task A) or nDCG@10 (Task B). `NaN` counts as −∞.
- **Best checkpoint:** when the primary improves, the **trainable** parameters (all of them for full fine-tunes, adapters + head for LoRA) are saved to `.work/<run_id>/best.pt`. Frozen weights are never duplicated on disk.
- **Early stopping:** stop after `early_stopping_patience` (1) consecutive epochs without improvement.
- **Restore:** after training, `best.pt` is loaded back (`strict=False`, trainable keys only), then everything is put in `eval()` mode. Test is evaluated exactly once, afterwards, by the recipe.
- **History:** per epoch `{epoch, train_loss (mean over micro-batches), val_primary, epoch_time_s}`; also `optimizer_steps_per_epoch` and `grad_accumulation`.
- **Logging:** ~20 progress lines per epoch.

`is_oom(exc)`: `torch.cuda.OutOfMemoryError` or a `RuntimeError` whose message contains "out of memory".

### 10.1 OOM retry (README §7)

In `run_model_selection._execute_model`:

1. First attempt with the configured `per_device_batch`.
2. On OOM (and if the micro-batch is > 1): leave the `except` block **before** freeing memory — the exception's traceback holds references to the model's frames, and they are only released once the handler exits — then `gc.collect()` + `empty_cache()`.
3. Second attempt from a **fresh model load** at half the micro-batch. Accumulation doubles automatically, so the effective batch is unchanged. The eval batch is also halved proportionally (`RunContext.eval_batch`).
4. `oom_retry: true` and `per_device_batch_used` are recorded; a note explains it. A second OOM propagates → `failed: oom`.

Peak GPU memory is reset at the start of each attempt, so `peak_gpu_mem_mb` reflects the attempt that produced the result (it includes validation, test and latency passes).

---

## 11. Task A recipes (`oa2/recipes/story_point.py`)

### 11.1 Encoder / embedder + head (`_run_head`)

1. Build the backbone (`HFEncoder` or `STEncoder`, LoRA if applicable), the head on top in fp32.
2. Training rows = train split (or the smoke subset). Each step tokenizes its micro-batch on the fly, runs backbone → head under autocast, loss from `head_loss` (computed in fp32).
3. `predict(df)`: rows are processed **sorted by text length** (much less padding), results are written back to their original positions. Returns predictions and class probabilities (none for regression).
4. `evaluate()` = full validation metrics; primary = QWK.
5. After `fit`: test once, slices, latency, predictions frame (`Issue_ID, true_bucket, pred_bucket, raw_sp, p_0..p_6`).

The embedder's head reads the **sentence embedding**, which for many embedders is L2-normalized (tiny scale). The head LR of 1e-3 is the same for everyone; this is noted, not compensated.

### 11.2 Generative (`_run_generative`, Qwen3-0.6B)

Prompt (token IDs):

```
<|im_start|>user
Estimate the story points for this Jira issue. Answer with exactly one of: 1, 2, 3, 5, 8, 13, 21.

{task text, truncated}<|im_end|>
<|im_start|>assistant
<think>

</think>

```

Answer = tokens of the bucket number followed by `<|im_end|>`.

**Multi-digit wrinkle:** Qwen tokenizes numbers digit by digit, so `13` and `21` are two tokens (three with `<|im_end|>`). The README's "argmax over the 7 bucket tokens" is therefore implemented as **summed sequence log-probability of each full candidate answer**; the softmax over the 7 sums gives the class probabilities (so ECE is defined). The `<|im_end|>` makes `1` vs `13` unambiguous.

- Training (LoRA SFT): loss = −mean over the batch of the summed log-prob of the correct answer's tokens. Only the last `width` (= longest answer length) positions are projected onto the vocabulary; a mask selects each row's actual answer tokens. The prompt reserves `width` tokens so the answer always fits.
- Prediction: each text is expanded into 7 sequences (one per candidate), scored in one batch; `eval_batch // 7` texts per call. This makes Task A inference ~7× the cost of a single forward pass.

---

## 12. Task B recipes (`oa2/recipes/assignment.py`)

All three families expose the same function, `score_tasks(list_of_task_texts) → [n, 48]` scores, which is used for validation, test and latency. Evaluation always scores **all 48 members** for every task.

### 12.1 Cross-encoder (encoder family)

- Input: tokenizer pair encoding `(task, profile)` → `[CLS] task [SEP] profile [SEP]` (model-specific specials), `truncation="only_first"`.
- Mean pooling → `Linear(d, 1)` → logit. Loss: BCE-with-logits against the soft target (Plausibility for positives, 0 for hard/random negatives). Score = `sigmoid(logit)`.
- Training items = **pairs**: per task, all positives + hard negatives + random negatives (~10 per task → ~50k pairs for the scenario-B 5k tasks, ~500k at the README default of 50k). The epoch shuffle mixes pairs across tasks.
- Scoring flattens `(task, member)` pairs, ordered by task text length, and runs `eval_batch` pairs at a time.
- No zero-shot measurement (the head is random before training).

### 12.2 Bi-encoder (embedder family)

- Queries: `query_prefix + task text`; documents: `doc_prefix + profile`. Score = cosine similarity (embeddings are L2-normalized in the recipe regardless of the model's own normalize module).
- Training items = one tuple per **(task, positive)**: `(anchor task, positive member, negatives = hard + random [+ over-qualified if this is the task's top positive])`.
- Loss = MultipleNegativesRankingLoss implemented by hand (scale 20): each anchor is scored against a candidate list made of every example's positive plus every example's explicit negatives in the micro-batch; target = its own positive.
- **False-negative masking.** With only 48 distinct profiles, in-batch candidates are very often relevant to other anchors (same member, or another positive of the same task). For anchor *i*, any candidate that belongs to another example **and** is a positive of task *i* is masked to −∞. The anchor's own positive and own explicit negatives are never masked (this is what allows the over-qualified member — which *is* a positive of the task — to act as a negative for the top positive).
- Each micro-batch encodes each distinct profile once and reuses the embedding for every column it appears in.
- In-batch negatives come from the **micro-batch** (8 or 4), not the effective batch of 32; gradient accumulation does not enlarge the negative pool.
- **Zero-shot:** the pretrained model (LoRA adapters are a no-op before training) is evaluated on validation before `fit` → `metrics.zero_shot_val`.
- **Member embeddings are precomputed** once before every evaluation pass (each validation epoch, the test pass) and reused for the latency measurement, as README §5.6 permits; this is stated in the report notes.

### 12.3 Yes/no scorers (reranker + generative families)

Templates (`{instruction}` = `task_assignment.query_instruction`):

- **reranker** (Qwen3-Reranker's documented format):
  `<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".<|im_end|>\n<|im_start|>user\n<Instruct>: {instruction}\n<Query>: ` + **task** + `\n<Document>: ` + **profile** + `<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`
- **generative**:
  `<|im_start|>user\nTask:\n` + **task** + `\n\nTeam member: ` + **profile** + `\n\nIs this team member a good fit for the task? Answer yes or no.<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`

Score: the last position's logits for the `yes` and `no` tokens; `d = logit_yes − logit_no`; `P(yes) = sigmoid(d)` (= the 2-way softmax). Loss: BCE-with-logits on `d` against the soft target. Same pointwise pairs as the cross-encoder. Zero-shot validation is measured for the **reranker only** (README §6.2 names embedders and rerankers).

### 12.4 Evaluation outputs

- Headline `val` and `test` metrics are computed on the **classified** tasks (val is classified-only anyway; test has `test_tasks` classified + `test_unclassified_tasks` unclassified: 2,000 + 500 in scenario B, 5,000 + 1,000 at the README defaults).
- `slices`: `all_tasks`, `primary_area:*`, `required_level:*`, `classified` (= the headline), `unclassified`, `held_out_members`.
- Predictions: one row per test (task, member): `Issue_ID, User_ID, score, plausibility (0 if absent), rank_true (empty if absent)` — 2,500 × 48 = 120k rows in scenario B (6,000 × 48 = 288k at the README defaults), gzip-compressed.

---

## 13. Baselines (`oa2/recipes/baselines.py`)

All run on the CPU, have no download, and produce the same report structure (`family: baseline`, `finetune_method: none`, `training.history: []`). They honour `--limit-train` like the models.

| Baseline | Details | `total_params` reported as |
|---|---|---|
| `baseline_median_per_project` | Median of the project's **training** bucket indices; a half-way median (e.g. 2.5) rounds **up** (consistent with the tie rule); a project without training rows gets the global training median. | number of projects |
| `baseline_tfidf_ridge` | `TfidfVectorizer(ngram_range=(1,2), max_features=50000)` (sklearn defaults otherwise) + `Ridge(alpha=1.0)` on the bucket index, rounded, clipped to [0, 6]. | coefficients + 1 |
| `baseline_random` | Uniform scores from a generator seeded per split name (`val`, `test`, `latency`). | 0 |
| `baseline_popularity` | Members ranked by how often they are `Rank == 1` in the sampled training tasks; held-out members are excluded from the counts (so they score 0); ties → lower `User_ID` first (stable sort). | 48 |
| `baseline_tfidf_cosine` | TF-IDF (same settings) fitted on training task texts **plus** the 48 profiles; score = dot product of the L2-normalized vectors (cosine). | vocabulary size |

The TF-IDF baselines are the reference for `delta_*_vs_tfidf` in the leaderboards (§16.2).

---

## 14. Metrics and slices (`oa2/metrics.py`)

### 14.1 Task A

| Metric | Implementation notes |
|---|---|
| `qwk` | `cohen_kappa_score(weights="quadratic", labels=0..6)`. |
| `mae_bucket`, `within_one_acc`, `exact_acc` | On bucket indices. |
| `macro_f1` | Macro over the labels **present in `y_true ∪ y_pred` of that evaluation set** (not a fixed 7), so small slices are not punished for buckets that do not occur. |
| `mae_raw_points` | `|BUCKETS[pred] − raw story point|`. |
| `spearman` | `scipy.stats.spearmanr`; `null` if constant. |
| `ece` | 10 equal-width bins on the probability of the **predicted** class (for CORAL, the prediction is the threshold count, which can differ from the argmax of the derived distribution); `null` for regression and baselines. |
| `confusion_matrix` | 7×7, rows = true. Also included in every slice. |
| `n` | Row count. |

Slices: `project:<KEY>`, `type:<Type|other>`, `text_changed_after_estimation:true|false`. Every metric (including the confusion matrix) is computed per slice.

### 14.2 Task B

Inputs: scores `[T, 48]`, relevance `[T, 48]`, top-1 index, member levels and required levels as ordinal ranks (Intern 0 … Principal 5).

| Metric | Implementation notes |
|---|---|
| `ndcg@10`, `ndcg@5` | Linear gain = Plausibility, discount `1/log2(rank+1)`, ideal = sorted true relevance. Ranking uses a **stable** sort on `−score`, so ties go to the lower member index (matters for the popularity baseline). Tasks with zero ideal DCG are skipped. |
| `recall@5`, `recall@10` | Relevant = `Plausibility > 0`; tasks with no relevant members are skipped. |
| `hit@1` | Predicted top-1 is the `Rank == 1` member. |
| `mrr` | Reciprocal rank of the `Rank == 1` member. |
| `spearman_plausibility` | Per task, Spearman between the 48 scores and the 48 relevances (average ranks for ties, which are plentiful because absent members all have 0), then the mean over tasks. |
| `overqualified_top1_rate` / `underqualified_top1_rate` | Top-1 member's level vs `Task_Profile.Required_Level` (strictly above / strictly below). `Task_Profile` is used **only** here and for slicing. |
| `latency_ms_per_task` | Added to `test` from the efficiency measurement (bs1 median, §15). |
| `n_tasks` | Task count. |

Slices: `all_tasks`, `primary_area:*`, `required_level:*`, `classified`, `unclassified`, `held_out_members` (tasks — classified or not — where at least one held-out member has `Plausibility > 0`; metrics are over the full 48-member ranking for those tasks). An empty slice returns just `{"n_tasks": 0}`.

All non-finite values become `null` in the JSON.

---

## 15. Efficiency measurements

`training.measure_latency(run_one, items, batch_size, warmup)`, called after the test pass on the first `latency_samples` (200) test items:

1. 10 warm-up calls at batch size 1.
2. **bs1:** every item on its own; `cuda.synchronize()` before and after; median ms.
3. **batched:** items in chunks of `batch_size`; time per chunk ÷ chunk size; median ms per item.
4. `throughput_items_per_s = 1000 / batched median`.

What an "item" and a "batch" are:

| Unit type | Item | bs1 means | Batched size |
|---|---|---|---|
| Task A encoder/embedder | one issue | one issue | `eval_batch` |
| Task A generative | one issue (7 candidate sequences) | one issue | `eval_batch // 7` |
| Task B (all families) | one task, scored against **all 48 members** | one task (= `latency_ms_per_task`) | `latency_batch_tasks` (8) tasks |
| Baselines | as above, on the CPU | | `eval_batch` / `latency_batch_tasks` |

Timings include tokenization (what a product call would pay). Bi-encoders use precomputed member embeddings. The latency pass is a timing measurement on already-scored test items; its outputs are discarded and it does not count as a second test evaluation. `train_time_s` is the wall-clock of `fit`, **including** the per-epoch validation passes (and, for bi-encoders, excluding the zero-shot pass).

---

## 16. Reports (`oa2/report.py`)

### 16.1 Per-run JSON (`reports_*/runs/<run_id>.json`)

Written for every unit — completed, failed and skipped — following README §10.1. Additions and specifics:

- `smoke`: `true` for `--limit-train` runs (they also get a leading caveat).
- `context.caveats`: a common list plus task-specific ones, plus the data budget when it is reduced (Task A: the fraction and row counts; Task B: the sampled split sizes and the thin rare-level warning).
- `model.revision_sha`: the SHA that was actually downloaded; `null` for baselines and units skipped before verification.
- `data`: `fingerprint`, `n_train` (rows for Task A; **pairs** for pointwise Task B recipes, **tuples** for bi-encoders, tasks for baselines), `n_val`, `n_test`, `label_distribution` from the prep metadata, plus `split_sizes` (Task A) or `sampled_split_sizes` and `held_out_member_ids` (Task B).
- `training.hyperparameters`: the resolved unit hyperparameters plus `per_device_batch_used`, `precision`, `grad_accumulation`, `optimizer` (models only).
- `training.resumed_from_epoch`: `null`, or the epoch a unit resumed at after an interruption (§17.9); the notes then give the micro-batch too.
- `efficiency`: the §15 fields plus `n_timed`.
- `environment`: Python, torch, transformers, sentence-transformers, peft, huggingface_hub, scikit-learn, pandas, numpy versions, CUDA version, GPU name, OS, and a 12-hex SHA-256 of the hostname.
- `notes`: every implementation decision relevant to that unit (pooling, prefixes, templates, masking, OOM retry, smoke mode, BitNet caveat, …).
- `error`: `{type, message, traceback}` for failures; `{type: "UnitSkipped", message, traceback: null}` for skips.
- `disk_freed_mb`: filled in by a second atomic write after the erase step (the report is written *before* anything is deleted, as required).

### 16.2 Leaderboards (`reports_*/leaderboard.csv`)

Rebuilt **from the `runs/*.json` files** after every unit (never appended), so they always match the JSONs.

- Rows: `status == "completed"` and not `smoke`. Archived reports (`runs/archive/`) are ignored.
- Columns: exactly README §10.2.
- `delta_*_vs_tfidf` = the row's primary test metric minus the TF-IDF baseline's, **taken from the baseline run with the same data fingerprint** (the most recently finished one if several exist). Empty if that baseline has not completed.
- Sorted by the primary test metric, descending, missing values last.
- Floats with 4 decimals; integer columns (`total_params`, `trainable_params`, `best_epoch`, `peak_gpu_mem_mb`) as integers.
- If the CSV is locked (e.g. open in Excel on Windows), the write is skipped with a warning and retried after the next unit.

### 16.3 Predictions (`reports_*/predictions/<run_id>.csv.gz`)

Written for **completed** units only, atomically, gzip, floats with 6 significant digits.

### 16.4 `SUMMARY.md`

Regenerated after every unit and at the end of a run:

1. A context paragraph (project, both tasks, caveats), followed by the **training-data budget** of the current config (`report.data_budget_lines`; `regenerate(output_dir, cfg)` receives the config for this). Each run's JSON remains the authoritative record of the budget it was trained with.
2. Per task: a Markdown table of the main leaderboard columns (params shown in millions), then
   - **best by the primary metric** (over all rows, baselines included — a baseline winning is a finding), and
   - **efficiency-adjusted pick**: among *pretrained* models within 0.01 of the best pretrained model's primary metric, the one with the fewest parameters, ties broken by bs1 latency.
3. Failed / skipped units with reason and the first 160 characters of the message.
4. Provenance: data fingerprint(s), generation time, and the repo's HEAD commit — read directly from `.git` files (no `git` subprocess; worktrees and packed refs are handled).

No explanations of *why* a model won are generated (README §10.3).

---

## 17. Checkpoint / resume (`oa2/checkpoint.py` + orchestrator)

### 17.1 Storage

A single JSON file, `OA2/.state/state.json`:

```jsonc
{
  "schema_version": 1,
  "units": {
    "<run_id>": {
      "status": "completed",            // pending | running | completed | failed | skipped
      "task": "story_point", "model_key": "minilm_l6", "recipe": "coral", "smoke": false,
      "attempts": 1,
      "started_at": "…", "finished_at": "…", "updated_at": "…",
      "reason": null,                   // e.g. "oom", "gated_access_denied", "ValueError"
      "error": null                     // {type, message (≤ 2000 chars)} for failures/skips
    }
  }
}
```

A unit absent from the file is `pending`. Every transition rewrites the whole file via temp-file + `fsync` + `os.replace` — a crash can never leave it half-written. Entries for run IDs that no longer exist in the config (because the config changed) are left untouched and ignored.

### 17.2 States and transitions

```
pending ──► running ──► completed
                   ├──► failed    (exception; --retry-failed re-queues)
                   └──► skipped   (unverified / missing / gated repo)
running (found at start-up) = interrupted ──► resumed from its checkpoint (§17.9), else restarted from scratch
```

### 17.3 Building the queue

For each selected unit, in order:

| Current state | Queued? |
|---|---|
| matched by `--force` (run ID or model key) | yes, whatever the state |
| `completed`, `skipped` | no |
| `failed` | only with `--retry-failed` (the count of those left out is logged) |
| `running` (interrupted), `pending` | yes |

`--force <model_key>` re-runs **all** of that model's selected units (both tasks, every head); combine with `--task` to narrow it. A `--force` value that matches nothing is warned about.

### 17.4 Starting a unit (and restarting an interrupted one)

Inside a critical section:
1. If a report JSON for this run ID already exists (a forced re-run, or a retried failure/skip), it is **moved** to `runs/archive/<run_id>__<UTC timestamp>.json`; an existing predictions file is archived the same way. Nothing is ever overwritten or deleted.
2. Exception: if the unit was interrupted (`running`) and there is predictions output but no report, those predictions are partial and are deleted.
3. `.work/<run_id>/` is wiped.
4. State → `running`, `attempts += 1`.

### 17.5 Failures never stop the run

Any exception other than `KeyboardInterrupt` is caught in `run_unit`: status `failed`, reason `oom` or the exception class name, full traceback in the report and the unit's log, a shortened error in the state file. The erase step still runs, then the next unit starts.

### 17.6 Graceful stop (`GracefulStop` in `common.py`)

- Handlers are installed for SIGINT, SIGTERM and (Windows) SIGBREAK.
- **First signal:** sets `requested`. If no critical section is active, `KeyboardInterrupt` is raised immediately — training stops mid-step. If a critical section is active (state/report/leaderboard writes), the interrupt is deferred and raised as soon as the section ends.
- The `KeyboardInterrupt` unwinds through `run_unit` (which re-raises it without touching the state), releases the lock, logs "The interrupted unit stays 'running' …", and exits with code 130.
- **Second signal:** `os._exit(130)` immediately.

Because the unit is left `running`, the next start treats it as interrupted and restarts it cleanly (README §9 rule 4).

### 17.7 Single instance (`InstanceLock`)

- `.state/run.lock` is created with `O_CREAT | O_EXCL` and contains `{pid, host, started}`.
- If it already exists:
  - different hostname → refuse (cannot check a remote PID; delete the file manually if that run is gone);
  - PID alive → refuse with a clear message (exit code 2);
  - PID dead → "Taking over stale lock", delete, retry once.
- PID liveness: on Windows via `OpenProcess` + `GetExitCodeProcess == STILL_ACTIVE` through `ctypes` (note: `os.kill(pid, 0)` on Windows would *terminate* the process, so it is deliberately not used); on POSIX via `os.kill(pid, 0)`.
- Released on normal exit and on `KeyboardInterrupt` (context manager). After a hard kill the lock is stale and is taken over on the next start.
- `--status` and `--dry-run` do not take the lock.

### 17.8 Crash windows (what can go wrong)

| Crash point | Effect on next start |
|---|---|
| During training | Unit is `running` → resumed from its last resume checkpoint (≤ 15 min of training lost, §17.9). |
| During the test pass / latency / report | Unit is `running` → training is skipped (checkpoint says finished), best weights restored, test re-run. |
| After report written, before state → `completed` | Unit is `running` → restarted; the finished report is archived, not lost. |
| During the erase step | Unit is `running` → restarted; anything not yet deleted is deleted by the restart's cleanup (work dir) or reused (HF cache). |
| During data preparation | The `.tmp` cache folder is ignored and rebuilt. |


### 17.9 Mid-unit resume (resume checkpoints)

Added after the first pre-flight, for machines with power cuts. Implemented in `training.fit` plus the orchestrator.

- **What is saved:** `.work/<run_id>/resume.pt` = trainable parameters, optimizer, LR scheduler, grad scaler, torch CPU/CUDA RNG states, and the loop state (epoch, next micro-batch, running loss, history, best score/epoch/metrics, early-stopping counter, training seconds so far). A small `resume_meta.json` sidecar records the per-device batch. Both are written atomically (temp file + rename), so a crash mid-save keeps the previous checkpoint.
- **When:** every `OA2_RESUME_EVERY_MIN` minutes (environment variable, default 15), only right after an optimizer step (so no gradient is half-accumulated); after each epoch's training pass (before validation); and after each validation. The interval is deliberately **not** a config key: it would change every run ID.
- **Resume:** a unit found `running` (interrupted), or `failed` for a non-OOM reason and re-queued with `--retry-failed`, keeps its work dir when `resume_meta.json` exists. `fit` reloads everything and continues at the saved micro-batch of the saved epoch with the same deterministic data order (`micro_batches(seed, epoch)`) and restored RNG, so the result matches an uninterrupted run up to GPU floating-point non-determinism. A checkpoint that does not match (different item count / micro-batch / accumulation / epochs) is discarded with a warning. If the interrupted attempt had already done its OOM retry, the resume happens at the reduced micro-batch and no second retry is allowed.
- **Guards:** a checkpoint whose `best.pt` is missing is discarded (never test the wrong weights); the erase step deletes the resume files *before* the rest of the work dir; `--force` always starts fresh; a non-OOM failure (e.g. network down while verifying the repo after a power cut) keeps the checkpoint for `--retry-failed`.
- **Zero-shot:** the pre-fine-tuning validation metrics (bi-encoders, reranker) are cached as `zero_shot.json` in the work dir and reused on resume.
- **Reporting:** `training.resumed_from_epoch` is filled; a note gives the resume point; `train_time_s` = time before the interruption (up to the last checkpoint) + time after it.
- **Cost:** a full fine-tune checkpoint holds weights + AdamW moments (~12 bytes/parameter: ~2.2 GB for DeBERTa-v3-base, a few seconds to write); LoRA checkpoints are tens of MB. Tensors are saved straight from the GPU, one storage at a time, so saving does not need a second full host copy.

---

## 18. Erase step (`oa2/cleanup.py`)

`erase_unit(work_dir, repo_id, cache_dir, keep_repo)`:

1. `gc.collect()` + `torch.cuda.empty_cache()` (model objects are out of scope by now; this also releases memory-mapped safetensors files, which Windows would otherwise refuse to delete).
2. Delete `.work/<run_id>/` (contains `best.pt`).
3. Unless `keep_repo`: `huggingface_hub.scan_cache_dir(cache_dir)` → delete every revision of that repo, then remove the repo folder's leftovers (`refs/`, `.no_exist/`).
4. Free memory again; log the MB freed; the number is stored in the report's `disk_freed_mb`.

`keep_repo` is true when the **next queued unit** uses the same repo ID (e.g. `minilm_l6` Task A → Task B), so the model is downloaded once per model rather than once per unit. It is only erased after the last of its adjacent units.

Other cases:
- Baselines: only the (empty) work dir is removed.
- Skipped / failed units: the same erase runs (a partial download is removed).
- `--keep-weights`: nothing is erased; a warning is logged.
- An interrupted unit's download stays in the HF cache until that unit finishes on a later start (it is reused by the restart).

Only the data cache (`.cache/data/`) is never cleaned automatically.

---

## 19. Determinism and reproducibility

- **Seeds:** `seed_everything(seed)` at the start of every recipe: Python `random`, NumPy, `torch.manual_seed`, `cuda.manual_seed_all`, `cudnn.deterministic = True`, `cudnn.benchmark = False`, `torch.use_deterministic_algorithms(True, warn_only=True)`.
- `CUBLAS_WORKSPACE_CONFIG=:4096:8` is set at the very top of the script, before torch can initialize CUDA.
- **Independent random streams:** `rng_for(seed, name)` builds `np.random.default_rng([seed, md5(name)[:8]])` for each purpose (`ta_train`, `ta_val`, `ta_test`, `ta_test_unclassified`, `held_out_members`, `ta_negatives`, `limit_train`, `baseline_random_<split>`). Adding a new random draw somewhere never shifts another.
- **Epoch shuffles:** `default_rng([seed, epoch])`.
- **Pinned model revision:** the verified SHA is downloaded and loaded from its snapshot folder.
- Library versions and GPU are recorded in every report.

Caveats:
- `warn_only=True` means a non-deterministic CUDA kernel produces a warning instead of an error, so bit-exact reproducibility is not guaranteed; the README target is ±0.005 on the primary metric, which should hold but **has not been measured yet** (README §14 last checkbox).
- Evaluation is batched by text length; results do not depend on that order, but the padding does change floating-point sums slightly.
- Reproducibility is only expected on the same GPU / driver / library versions.

---

## 20. Interpretations of the README

Everything below is where the README was silent or ambiguous. Each item is also recorded in the relevant reports' `notes` or in config comments.

| Topic | Decision |
|---|---|
| Data fingerprint | One per task instead of one global (§6.1). |
| Wrapping quotes in TAWOS text | Stripped (up to 3 each side) (§6.4). |
| Whitespace normalization | Collapsed within each of the 3 template lines. |
| Split rounding | Floor of 70% and 85% per project. |
| Top-6 types | Computed over all Task A rows, ties alphabetical. |
| Negative story points | Dropped (none expected). |
| Held-out rule | "Only member at their level" read team-wide → only the Principal is protected (§6.8). |
| Data budget | Scenario B instead of the README defaults (top of this document). |
| Task A training fraction | New `story_point.train_fraction`, sampled per project. |
| Task B validation | Classified tasks only. |
| Task B headline test metrics | Classified tasks only; unclassified and all-tasks are slices. |
| Over-qualified hard negatives | Impossible as relevance-0 in this data; used as a bi-encoder extra negative for the top positive (§6.9). |
| Bi-encoder training items | One tuple per (task, positive). |
| In-batch false negatives | Masked (§12.2). |
| Generative Task A scoring | Summed log-prob over full candidate answers, because Qwen splits digits (§11.2). |
| Generative Task B zero-shot | Not measured (README lists embedders and rerankers only). |
| Encoder pooling | Mean pooling for both tasks. |
| LoRA decision for embedders | Actual parameter count vs 300M (not the config's `params_m`). |
| Macro-F1 labels | Labels present in the evaluated set. |
| ECE confidence | Probability of the predicted class. |
| Median baseline tie | Half-way median rounds up. |
| Latency definitions | §15 table. |
| `train_time_s` | Includes per-epoch validation. |
| `n_train` for Task B | Pairs / tuples actually trained on (not tasks) for model units. |
| Efficiency-adjusted pick | Pretrained models only; fewest params, then bs1 latency. |
| Failed units on restart | Not re-run without `--retry-failed` (README rules 3 and 5 conflict slightly; rule 5 wins). |
| Skipped units on restart | Never re-run without `--force`. |
| Re-run of an existing report | Old report archived under `runs/archive/`, never overwritten. |
| BitNet | Standard Transformers path only; a note says bitnet.cpp speed was not measured. Currently skipped anyway (no verified repo ID). |
| Weight decay / clipping | 0.01 on all params / max norm 1.0, identical for all models. |

---

## 21. Known limitations and gotchas

1. **Mid-unit resume is at training granularity** (§17.9). Up to `OA2_RESUME_EVERY_MIN` (15) minutes of training, a validation pass in progress, or the test/latency pass in progress are redone after an interruption. Model load and download happen again on resume.
2. **Untested ML paths** (§1). Likely first-run issues: library API drift (transformers 4.57 / sentence-transformers 5.1 / peft 0.17 as pinned), remote-code models (NeoBERT may need `xformers`), gated access.
3. **Qwen-specific templates.** The reranker/generative recipes assume the Qwen chat format and single `yes`/`no` tokens. Adding a non-Qwen generative or reranker model needs new templates in `YES_NO_TEMPLATES` / `GEN_PROMPT_*`.
4. **Training budget at the README defaults is large.** Cross-encoders and yes/no scorers would train on ~500k pairs × 2 epochs and validation would score 2,000 × 48 pairs per epoch; that is why the config uses scenario B (~50k pairs, 500 × 48 validation pairs). Generative Task A inference is 7× a normal forward pass at any budget.
5. **In-batch negatives depend on the micro-batch**, so an OOM retry changes the bi-encoder's effective negative pool (recorded via `oom_retry` and `per_device_batch_used`).
6. **The LR schedule is sized for the maximum epochs**; early-stopped runs never reach LR 0.
7. **Touching the dataset files** (new mtime) changes every fingerprint and run ID → everything re-runs (old results are kept).
8. **Changing any `training` key** (even latency settings) changes every model unit's run ID.
9. **`--dry-run` concurrently with a real run** could race on building the same data cache (it does not take the lock). Don't do that.
10. **Old data caches and archived reports accumulate**; clean `.cache/data/` and `runs/archive/` by hand when needed.
11. **`params_m` is only for ordering.** If it is wrong, the order is wrong; reports use the real count.
12. **CORAL/embedding scale:** the head on a normalized embedding sees small inputs; no special handling (same for all embedders).
13. **Leaderboard write can be skipped** if the CSV is open in Excel (warning; fixed on the next unit).
14. **`peak_gpu_mem_mb`** covers the final attempt only and includes evaluation and latency passes.
15. **`shutil.rmtree(onerror=…)`** is deprecated in Python 3.12+ (warning only).
16. **The `held_out_members` slice** includes unclassified tasks (it is defined over all test tasks).
17. **Scenario B budget** (see the note at the top): 5k Task B training tasks and 25% of Task A training data were chosen from runtime arithmetic, not from a learning curve. Confirm the top models at a larger budget before choosing one for production.

---

## 22. Hardware notes (GTX 1650, 4 GB)

- Compute capability 7.5 → **fp16** autocast (no bf16).
- Full fine-tuning keeps fp32 weights + AdamW states: ~16 bytes/parameter before activations. ModernBERT (149M) ≈ 2.4 GB, DeBERTa-v3 (184M) ≈ 3 GB, NeoBERT (250M) ≈ 4 GB → NeoBERT and probably DeBERTa will hit `failed: oom` even after the retry. That is a legitimate, reported outcome.
- LoRA models (≥ 300M) keep base weights in fp16 (~1.2 GB for 0.6B) and are more likely to fit with gradient checkpointing at micro-batch 4 → 2.
- EmbeddingGemma runs in fp32 (required), with LoRA.
- Rough totals from the planning estimates (±2×, to be recalibrated with the smoke test):

  | Machine | README defaults | Scenario B (configured) |
  |---|---|---|
  | GTX 1650, 4 GB | ~1,000 h (~6 weeks) | ~140 h (~6 days) |
  | RTX 4050 laptop, 6 GB | ~240 h (~10 days) | ~35–40 h |
  | A10 server, 24 GB | ~85–90 h (~4 days) | ~12–14 h |

- Further levers (each changes run IDs, all models treated equally): lower `task_assignment.train_tasks`, `story_point.train_fraction`, `story_point.epochs`, or `max_seq_len`; disable models with `enabled: false`; run one task at a time with `--task`.

---

## 23. How to extend

- **Add a model:** add an entry under `models:` with `key`, `hf_repo_id`, `family`, `params_m`, `license`, `tasks`, plus any overrides. Families: `encoder`, `embedder`, `reranker`, `generative`.
- **Add a Task A head:** implement it in `models.make_head` / `head_loss` / `head_predict`, then list it in `story_point.heads` (globally or per model). Each head is its own unit.
- **Add a metric:** compute it in `metrics.py`; if it should appear in the leaderboard, add it to `report.TASK_COLS` and `_flat_row`.
- **Change data preparation:** bump `data.PREP_VERSION` so the cache and all run IDs are invalidated.
- **Add a baseline:** add it to `registry.BASELINES` and to the dispatch table in `recipes/baselines.run`.

---

## 24. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "Another OA2 run is active (pid …)" | A run is in progress, or a PID was reused after a crash. Check the process; delete `.state/run.lock` if it is really gone. |
| Everything is `pending` again | Dataset file mtimes/sizes or the config changed → new fingerprints/run IDs. `--status` shows the new IDs; old reports are still on disk. |
| `skipped: gated_access_denied` | Accept the model license on Hugging Face and set `HF_TOKEN`, then `--force <model_key>`. |
| `skipped: repo_id_unverified` | Fill in a verified `hf_repo_id` in `config.yaml` (this creates a new run ID). |
| `failed: oom` | Lower that model's `per_device_batch` / `max_seq_len` in the config, or accept the result. |
| Failed with a network error | `--retry-failed`. |
| Unit keeps restarting from scratch | Its resume checkpoint was missing or did not match (logged as a warning), or it was re-run with `--force` / after `failed: oom`. |
| Leaderboard not updated | The CSV was open in another program; it is rebuilt after the next unit or at the end of the run. |
| Want to inspect a trained model | Run with `--keep-weights`; `best.pt` stays in `.work/<run_id>/` and the download stays in the HF cache. |
