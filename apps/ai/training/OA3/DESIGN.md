# OA3 design: plan, decisions and reasons

This document records **what** OA3 does, **why** it does it that way, and **which alternatives were rejected**. It
is written so that a person or an AI agent can change OA3 later without breaking an assumption by accident.
README.md explains how to run OA3; INTEGRATION.md explains how the product uses the model.

## Decision log (summary)

| # | Decision | Section |
|---|---|---|
| D1 | Train **Qwen3-Embedding-0.6B as a bi-encoder**: OA2's Task B winner | §1 |
| D2 | New branch `ai/OA3` and new folder `apps/ai/training/OA3`; OA2 stays frozen | §2 |
| D3 | **Import** OA2's `oa2` package; port only the training function (OA2's version deletes the model) | §2 |
| D4 | The prompt and text templates are a **fixed contract**, enforced by byte-level parity tests | §3 |
| D5 | **50,000** training tasks (10× OA2; 20 % of the 246,641 available), sampled **nested** | §4.2 |
| D6 | Test set **identical to OA2's** (2,000 + 500 tasks), so the gain from more data can be measured directly | §4.3 |
| D7 | Validation 2,000 tasks (OA2: 500); never the full 53,639 | §4.3 |
| D8 | Keep OA2's **9 held-out members** out of training to re-measure cold start | §4.5 |
| D9 | Save every split's task IDs (manifest) with the report and inside the model folder | §4.4 |
| D10 | **Recipe unchanged** from OA2, including 2 epochs: change one variable (data size) at a time | §5 |
| D11 | Paired bootstrap against OA2's saved test predictions | §6.2 |
| D12 | Export = LoRA **merged** into the base weights, bf16, plain SentenceTransformer folder + `inference_config.json` | §7 |
| D13 | **Verify** the export through the production loader; mismatch → exit code 2 | §7.3 |
| D14 | Run ID hashes data + model + prompt + recipe; a changed config never resumes an old run | §8 |
| D15 | Retrain from scratch for each production version; warm starting is for experiments only | §9 |

---

## 1. Goal and scope

**Goal:** a deployable model that ranks the team's members for a task, at least as good as OA2's benchmark run
(test nDCG@10 0.836), with complete traceability: config → data → weights → metrics.

**In scope:** Task B (assignee ranking) only. **Out of scope:** Task A (story points; OA2's winner there is
Qwen3-0.6B generative, a different recipe), the serving code itself (designed in INTEGRATION.md, built in the AI
service), and real-outcome labels (the dataset's labels are synthetic, §10).

**Why this model (D1):** OA2 `REPORT.md` §4 and §7.2. It had the best nDCG@10 (0.836, CI [0.826, 0.846]) and beat the
next three models with a significant margin. It ranked held-out members almost as well (0.828). It is 12–15×
faster than the pointwise LLM scorers (~100 ms per task), because member vectors are precomputed, and it is
Apache-2.0. Budget alternative if hardware is tight: MiniLM-L6 (0.771, 23M params, ~10 ms).

---

## 2. Code organisation (D2, D3)

- **Branch `ai/OA3`, cut from `ai/OA2`.** OA2 is a finished benchmark with a committed report. Training the
  production model is a different deliverable with its own review. Keeping them apart keeps both PRs readable.
- **Folder `apps/ai/training/OA3`, not `model_selection/`.** Model selection asks "which model?", and OA2 answered
  it. Training is a different activity, and later trainings (Task A, retrains) belong next to this one.
- **Reuse by import.** `oa3/config.py:import_oa2` puts `apps/ai/model_selection/OA2` on `sys.path`. OA3 then uses
  OA2's data preparation (`_load_issue_base`, `chrono_split`, `_sample_ids`, `_pick_held_out`,
  `_build_train_examples`, `member_profile_text`, the Parquet cache), metrics (`assignment_eval`), training loop
  (`fit`: resume, early stopping, best-epoch restore), model helpers (`load_st`, `apply_lora`, `STEncoder`), model
  download (`pull`) and latency timer.
  *Why:* a second copy of the text preparation would drift from the one the model was benchmarked with. The
  private (underscore) functions are used on purpose; OA2 is frozen, so they will not change underneath.
  *Cost:* OA3 needs the OA2 folder next to it. That is acceptable inside one repo.
- **Ported, not imported:** `_run_bi_encoder` (`oa2/recipes/assignment.py:193`) becomes `oa3/trainer.py`. OA2's
  function trains, tests and then throws the model away. OA3 needs the model back to export it. The port keeps the
  loss, masking, negatives, LoRA setup and seed order line for line.
- **`oa3/inference.py` is self-contained** (numpy at import time, sentence-transformers when loading). It is
  copied into every exported model folder, so the AI service needs one file and no training code.

---

## 3. The prompt and text contract (D4)

The model learned on specific strings. Production must send **the same strings**, or quality drops by an amount
nobody has measured. There are four parts:

| Part | Exact form | Source of truth |
|---|---|---|
| Query prefix | `Instruct: Given a software task description, retrieve team member profiles suited to do the task\nQuery:` (no space after `Query:`) | `config.yaml → prompt` |
| Task text | `[Project: KEY] [Type: T] [Components: a, b]\n<title>\n<description>`, components sorted and deduplicated, `none` if empty | `oa2/data.py:_load_issue_base` |
| Cleaning | strip; remove up to 3 wrapping `"`; collapse whitespace; description cut at 8,000 chars; whole text right-stripped | `oa2/data.py:_clean` |
| Profile text | `Level: L. Area: A. Years of experience: N. Role: R (C).`, no prefix | `oa2/data.py:member_profile_text` |

The 512-token limit is applied by the tokenizer (text beyond it is cut from the end).

**Why the instruction is fixed:** Qwen3-Embedding was pre-trained to read an instruction that tells it what the
vectors are for. OA2 then fine-tuned it with this one instruction on every example. The weights are now tuned to
this exact string, much like a dog trained on one whistle. A paraphrase would probably still roughly work, because
the model understands language, but by an unknown margin. Changing it means retraining.

**Why no space after `Query:`:** OA2's config is `"Instruct: {instruction}\nQuery:"` and the text is appended
directly. That is slightly different from Qwen's documented format (`Query: ` + text). It is kept because the
model was trained this way.

**Enforcement:** `tests/test_parity.py` builds texts both ways (through OA2's preparation of a small synthetic
TAWOS subset, and through `oa3/inference.py`) and requires byte equality. It also checks the cleaning on edge
cases, the 48 real profiles, and that the prefix equals the one recorded in OA2's winning run.

---

## 4. Data

### 4.1 Source and split

TAWOS staffing dataset: 432,601 Jira issues and a synthetic 48-person team. Each (task, plausible member) pair has
a `Plausibility` score in [0, 1]. The split is OA2's: **per project, chronological** (70/15/15 by creation date),
so the model is always tested on tasks that are newer than its training tasks, as in production.

| Split | Classified tasks | Unclassified |
|---|---:|---:|
| train | 246,641 | 56,162 |
| val | 53,639 | 11,252 |
| test | 54,537 | 10,370 |

*Unclassified* tasks (`Task_Profile.Primary_Area == "Unclassified"`) have weak labels. They are never trained on
and are reported only as a separate test slice (OA2 did the same).

### 4.2 Training budget: 50,000 tasks, nested (D5)

- **Why not 5,000 (OA2)?** OA2's budget was cut to fit 27 models into a few days on a laptop. Validation was still
  rising at its last epoch (0.807 → 0.826), which suggests the model was not saturated.
- **Why not all 246,641?** About 54–108 h on the laptop for 2 epochs, against 11–22 h for 50k. All tasks are
  matched against the same 48 synthetic profiles, and the labels come from a scoring function, so returns are likely
  to diminish well before 246k. 50k is OA2's own README default (`README.md` §5.4). Comparing 5k (0.836) with 50k
  tells us whether going further is worth days of compute.
- **Nested sampling.** `oa3/data.py:nested_sample` shuffles the sorted classified training pool **once**, with
  seed `[20260916, md5("oa3_train_order")]`, and takes the first *n*. A 100k or 246k budget is therefore a strict
  superset of the 50k one, and "the new tasks" are the tail of the same order. OA2's `_sample_ids` uses
  `rng.choice(size=n)` instead, where different *n* values give unrelated samples. That is fine for a benchmark,
  but not for a model that will be scaled up.
- Each training task contributes one tuple per relevant member (mean 3.9 after removing held-out members), so 50k
  tasks give about **195,000 tuples**.

### 4.3 Validation and test (D6, D7)

- **Test = OA2's test set.** It uses OA2's `_sample_ids` with OA2's seed names (`ta_test`, `ta_test_unclassified`)
  and OA2's sizes (2,000 classified + 500 unclassified), so it draws exactly the same tasks. The run checks this
  against OA2's saved predictions (`compare.py`) before comparing. Any difference from OA2 is then caused by the
  training, not by a different test sample.
- **Validation = 2,000 tasks** (OA2: 500), drawn with OA2's `ta_val` seed name. Validation picks the best epoch;
  2,000 tasks make that choice less noisy. Scoring them costs about a minute. The full 53,639 would cost hours per
  epoch for no gain in the decision.
- If you change `test_tasks`, the test set no longer matches OA2. The comparison then reports
  `same_test_tasks: false` and skips the paired test.

### 4.4 Manifests (D9)

`reports/<run_id>/data/` holds `train_task_ids.csv`, `val_task_ids.csv`, `test_task_ids.csv` and `members.csv`
(including the `held_out` flag). They are also copied into `model/training_data/`. With them, anyone can say exactly
which tasks a model has seen. The sampling is deterministic as well, so the same config and dataset rebuild the same
lists. The data fingerprint (sizes and mtimes of the source files plus the data config) changes if either changes.

### 4.5 Held-out members (D8)

OA2 removes 9 members (IDs 7, 15, 21, 28, 29, 33, 39, 41, 47), one per expertise area, from all training pairs. The
test slice `held_out_members` then measures how well the model ranks people it never saw: the **cold-start**
case, which in production is "a new hire joins the team". OA3 keeps them out (`data.hold_out_members: true`) to
confirm the cold-start result at 50k.

*Trade-off:* those 9 profiles never appear as positives in training. For the 48-person synthetic team that costs
a little. For a real team the cost is irrelevant, because real members are not in TAWOS anyway: every real profile
is "unseen". Setting `hold_out_members: false` for a final model is possible, but cold start can then no longer be
measured.

### 4.6 Negatives

As in OA2, per tuple: **4 hard negatives** (same area as a positive but a different level, with relevance 0), **2
random negatives**, plus **1 over-qualified negative** for the task's top positive only. The over-qualified
negative is the listed member with the largest `Capability − Plausibility`, if that gap is ≥ 0.10. It teaches "this
person *could* do it, but it is a waste of seniority".

*Known property:* `_build_train_examples` draws negatives with one random stream over the sorted task list. A
task's negatives therefore depend on which tasks come before it in the sample, so the same task can get different
negatives at 50k and at 100k. That does not affect correctness, and the task-level nesting still holds.

---

## 5. Recipe (D10)

**Unchanged from OA2.** Only the data size changes, so the 5k → 50k comparison measures exactly one thing.
Possible recipe improvements are listed in §10 and should be tested one at a time afterwards.

### 5.1 Model and LoRA

- `Qwen/Qwen3-Embedding-0.6B` @ `97b0c614…` (595.8M params), loaded as a SentenceTransformer. That gives the model's
  own last-token pooling and L2 normalisation, with a 1,024-d output and a 512-token limit.
- **LoRA** (low-rank adapters): every linear layer gets a trainable update `ΔW = (α/r)·B·A`, with r = 16, α = 32,
  dropout 0.05, no bias training. That is **10.1M trainable parameters (1.7 %)**. The base weights are frozen and
  stored in bf16, and gradient checkpointing is on.
  *Why LoRA:* it fits in about 4 GB of GPU memory, it cannot damage the pretrained knowledge much, and it merges
  away at export (§7), so inference costs nothing extra.

### 5.2 Training tuples

`(task, one relevant member, that task's negatives)`, one tuple per relevant member (`oa3/trainer.py:training_tuples`).
All relevant members count equally: `Plausibility` is used for evaluation (nDCG gain), not as a training weight.

### 5.3 Loss: MultipleNegativesRankingLoss

For a micro-batch of *b* tuples, each task vector is compared, with cosine × 20 (temperature 0.05), against every
candidate in the batch: all positives and all negatives of all *b* tuples. Cross-entropy then pushes each task
towards its own positive.
**Masking:** a candidate that is relevant to the anchor task but belongs to another tuple is set to −∞. With only 48
profiles, the same person often appears as another tuple's positive, and without the mask the model would be
penalised for a correct match.

### 5.4 Optimisation and memory

| Setting | Value |
|---|---|
| Optimiser | AdamW, LR 2e-4, weight decay 0.01, gradient clip 1.0 |
| Schedule | linear warm-up over 6 % of steps, then linear decay to 0 |
| Batch | micro-batch 4 × accumulation 8 = effective 32 |
| Precision | bf16 autocast (fp16 on GPUs without bf16, fp32 on CPU) |
| Seed | 20260916; `seed_everything` runs before the model and LoRA are built, so the LoRA init matches OA2 |

The micro-batch is also the pool of in-batch negatives. Lowering it to 2 for a 4 GB GPU keeps the effective batch at
32 through accumulation, but gives each step fewer negatives. That is a small recipe change; note it in the run.

### 5.5 Epochs and early stopping

- 2 epochs, with early stopping after 1 epoch without validation improvement. The best epoch by validation nDCG@10
  is restored before testing.
- At 50k, one epoch already has 10× OA2's optimizer steps, so 2 epochs equal 20 of OA2's 5k epochs in steps.
- A 3rd epoch is a §10 experiment, not a default. It also changes the LR schedule, which spans all epochs.

### 5.6 Resume and determinism

`oa2.training.fit` saves model, optimiser, scheduler, scaler and RNG states every 15 min (env
`OA2_RESUME_EVERY_MIN`) and at each epoch boundary in `.work/<run_id>/resume.pt`. A re-run continues from that
point with the same data order. On GPU, memory-efficient attention is not bit-deterministic, so a resumed run can
differ from an uninterrupted one by floating-point noise.

---

## 6. Evaluation

### 6.1 Metrics

Headline metrics are computed on the **2,000 classified test tasks**: nDCG@10 (primary, gain = Plausibility),
nDCG@5, recall@5/10, hit@1, MRR, Spearman with Plausibility, and over/under-qualified top-1 rate. Slices: by primary
area, by required level, unclassified, all tasks, and **held-out members**. Before training, the pretrained model is
also scored on validation ("zero-shot", 0.275 in OA2) to show what fine-tuning adds.

### 6.2 Comparison with OA2 (D11)

`oa3/compare.py` loads OA2's test predictions for Qwen3-Embedding and checks that the task sets are identical. It
then computes per-task nDCG@10 for both models and a **paired bootstrap** (1,000 resamples) of the mean difference.
This is the same method as OA2 `REPORT.md`, so the CI is directly comparable.

### 6.3 Acceptance criteria for a production model

1. Export verification passed (§7.3).
2. Test nDCG@10 ≥ 0.836 − 0.01 (no regression beyond noise against OA2). Ideally the paired CI lies above 0.
3. Held-out-member nDCG@10 within ~0.02 of the overall value (cold start still works).
4. Not a smoke run.

---

## 7. Export and verification (D12, D13)

### 7.1 Merge

`merge_and_unload()` folds `(α/r)·B·A` into each weight matrix. The result is an ordinary Qwen3 model with the same
size and speed as the base model; serving needs neither PEFT nor any adapter handling.

### 7.2 Folder contents

`st.save(..., create_model_card=False)` writes a standard SentenceTransformer folder in **bf16** (as upstream ships
it; ~1.2 GB). OA2's `load_st` detaches the auto model card because it leaked GPU memory, so OA3 writes its own
README. Next to it go:
- `inference_config.json`: format version, prefix, templates, max length, max chars, dtype, embedding size,
  training summary, test metrics, data fingerprint, git commit. The loader refuses an unknown `format_version`.
- `inference.py`: the loader.
- `training_data/`: the manifests.

### 7.3 Verification

The export is reloaded through `AssigneeRanker.load` (the production code path), all members and test tasks are
embedded, and nDCG@10 is recomputed. It must be within **0.002** of the in-memory model. Merging into bf16 weights
and reloading produce tiny differences; anything bigger means a broken export (wrong prefix, wrong dtype, failed
merge). Single-task latency of the exported model is measured here, which is the number production will see.
If verification fails, the run exits with code 2 and the report status is `export_mismatch`.

---

## 8. Run IDs, reproducibility, what is committed (D14)

- `run_id = assignee__[smoke__]qwen3_embedding_0_6b__<hash>`. The hash covers the data fingerprint, model
  (repo + revision), prompt, training config, and smoke limits. Changing any of them creates a fresh run.
- **Committed:** `reports/<run_id>/` (report.json, SUMMARY.md, test predictions, manifests): small, and the full
  record of the run.
- **Not committed:** weights (`artifacts/`, ~1.2 GB), checkpoints (`.work/`), prepared data (`.cache/`), logs. The
  weights belong in model storage (INTEGRATION.md §8), not in git.
- `report.json` records the environment (library versions, GPU, OS) and the git commit.

---

## 9. Alternatives considered

| Alternative | Why not (now) |
|---|---|
| Keep training in OA2 / `model_selection/` | Mixes two deliverables; OA2's report must stay reproducible (§2) |
| Copy OA2's code into OA3 | Two copies of the text preparation would drift; parity would depend on discipline (§2) |
| Train on all 246,641 tasks immediately | 54–108 h before knowing whether more data helps (§4.2) |
| Warm-start future, larger runs from the 50k model | Works (old tasks seen again act as an extra epoch), but the result depends on training history and is harder to reproduce. Use it for experiments; retrain from scratch for production versions (D15) |
| Change the recipe at the same time (3rd epoch, weighted loss) | Would mix two effects in one comparison (§5) |
| Ship the LoRA adapter separately | Serving would need PEFT and an extra load step; merging is free (§7.1) |
| A reranker / LLM scorer on top | OA2: slightly *worse* and 12–15× slower for full-team ranking. It could still re-score a top-10 if a later run shows it helps |
| Serve via ONNX / quantised | Not needed at ~100 ms; revisit if CPU-only serving is required (INTEGRATION.md §7) |

---

## 10. Next steps after the 50k run

1. **Decide on more data:** compare 50k with 5k. If the gain is clear (CI above 0), try 100k or all 246k. Thanks to
   nested sampling, that is a config change.
2. **Recipe experiments, one at a time, same test set:**
   - a 3rd epoch;
   - weighting positives by `Plausibility`;
   - over-qualification-aware negatives, to lower the 29.6 % over-qualified top-1 rate.
3. **Final production model:** optionally `hold_out_members: false`.
4. **Real labels:** once the product logs which suggested member was actually assigned (INTEGRATION.md §9),
   fine-tune on real outcomes. The synthetic labels are the main limitation of everything above.
5. **Task A:** an equivalent training project for story points (Qwen3-0.6B generative, OA2 REPORT §7.1).
