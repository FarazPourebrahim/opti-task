# OA2 — Model Selection Benchmark: Results Report

**Run:** 2026-09-29 18:49 → 2026-10-03 09:36 (Tehran time) · **Branch:** `ai/OA2` · **Machine:** HP OMEN 16 laptop, NVIDIA RTX 4050 Laptop 6 GB, 13.7 GB RAM, Windows 11
**Data budget:** scenario B (reduced; see `config.yaml`) · **Primary metrics:** Task A test QWK, Task B test nDCG@10
**Status:** 17 of 27 units completed, 5 failed (2 expected, **3 network failures — can be resumed**, §9), 5 skipped (by design)

This report interprets the per-run JSONs in `reports_story_point/runs/` and `reports_tast_assignment/runs/` (the
authoritative record), the leaderboards, and `SUMMARY.md`. Confidence intervals and paired comparisons were computed
from the saved test predictions (`predictions/*.csv.gz`) with a bootstrap (1,000 resamples, seed 20260916).

---

## Executive summary

| | Task A — story-point estimation | Task B — assignee ranking |
|---|---|---|
| **Best model** | **DeBERTa-v3-base** (184M), test QWK **0.486** [0.468, 0.503] | **Qwen3-0.6B generative** **0.823** [0.813, 0.834] and **e5-large-instruct** **0.821** [0.811, 0.833] — a statistical tie |
| **vs the simple baseline** | Only DeBERTa beats TF-IDF + ridge significantly, and only by **+0.024** QWK. TF-IDF has the **better** mean error (1.08 vs 1.28 buckets) and ±1-bucket accuracy (72.5 % vs 64.5 %). | Every model is far above all baselines (best baseline: popularity 0.288). |
| **Recommendation** | **No convincing production model yet.** If one must be picked now: DeBERTa-v3-base. Treat TF-IDF + ridge as the bar to beat; see §7.1 for next experiments. | **e5-large-instruct** — ties for first, ~6× lower measured latency than Qwen3-0.6B, a bi-encoder (member profiles embedded once), and fewer over-qualified top picks (22.7 % vs 34.6 %). Budget option: **bge-m3** (−0.019) or **MiniLM-L6** (−0.052, 23M params, ~10 ms). |
| **Still open** | Qwen3-0.6B generative was not evaluated (network failure). | **Qwen3-Embedding-0.6B** (reached val nDCG@10 **0.807** after 1 of 2 epochs — already above e5's final val 0.799) and **Qwen3-Reranker-0.6B** were not finished (network failure). Finish them before deciding (§9). |

Other headline findings:

- **Cold start works.** On test tasks where a never-seen team member is relevant, nDCG@10 is the same as overall (e.g. e5 0.815 vs 0.821). The product requirement "rank people the model has never seen" is met.
- **Bi-encoders beat cross-encoders** for assignment (e5 / bge-m3 / MiniLM > DeBERTa / ModernBERT), and they are the cheaper design to serve.
- **Story-point models mostly learn project scales.** Overall QWK is ~0.47–0.49, but the median **within-project** QWK is only ~0.14–0.25. Story points are project-relative and the models capture *which project* better than *which issue is bigger*.
- **Transformer story-point predictions are polarised** towards buckets "1" and "21" (≈5,300 predicted "1" vs 2,407 true). This follows from the CORAL head starting all thresholds at 0 within a 4-epoch budget — a known, deliberate choice (§8.1). **e5-large-instruct collapsed completely** on Task A (QWK 0.000) for this reason.
- **Data-quality issue:** one test issue has a recorded story point of **26,710,114**. It makes `mae_raw_points` ≈ 3,071 for every model, so that metric is meaningless as computed (§5.5).
- **No model weights were kept** — by design, the benchmark deletes each model after its unit (README §8). Producing deployable weights is a separate, short training run (§9.3).

---

## Table of contents

1. [What was run](#1-what-was-run)
2. [How the run went (operations)](#2-how-the-run-went-operations)
3. [Task A — story-point estimation: results](#3-task-a--story-point-estimation-results)
4. [Task B — assignee ranking: results](#4-task-b--assignee-ranking-results)
5. [Deeper analysis](#5-deeper-analysis)
6. [Cost and efficiency](#6-cost-and-efficiency)
7. [Recommendations](#7-recommendations)
8. [Caveats and threats to validity](#8-caveats-and-threats-to-validity)
9. [Unfinished units, weights, and how to complete the benchmark](#9-unfinished-units-weights-and-how-to-complete-the-benchmark)
10. [Engineering changes made during this run](#10-engineering-changes-made-during-this-run)
11. [Reproducibility](#11-reproducibility)
12. [Appendices](#12-appendices)

---

## 1. What was run

The benchmark specified in `README.md` and implemented as described in `IMPLEMENTATION.md`: each candidate model is
downloaded, fine-tuned on the TAWOS staffing dataset, evaluated once on a held-out test split, reported, and erased.

| Item | Value |
|---|---|
| Dataset | TAWOS v1.1 + synthetic 48-person team (`TAWOS_staffing_dataset`) |
| Task A data | 57,936 story-pointed issues (60,101 minus 2,165 zero-point), 39 projects, per-project chronological 70/15/15 split. **Train: 10,139** (25 % of the train split, sampled per project), **val 8,691**, **test 8,707** |
| Task B data | 432,601 issues split chronologically; sampled **5,000 train / 500 val / 2,000 + 500 unclassified test** tasks; 48 members, **9 held out of training** (IDs 7, 15, 21, 28, 29, 33, 39, 41, 47). Training pairs: 19,546 positive + 24,512 negative |
| Data fingerprints | Task A `74acaad6fd8e80d1` · Task B `7ba294912a0820ce` |
| Training protocol | Same for every model: seed 20260916, effective batch 32, max 512 tokens (MiniLM 256), AdamW + linear warm-up (6 %), LR 2e-5 full / 2e-4 LoRA / 1e-3 heads, Task A 4 epochs, Task B 2 epochs, early stopping patience 1, bf16 |
| Fine-tuning | Encoders and models ≤ 300M params: full fine-tune. Embedders > 300M, reranker, generative: LoRA (r 16, α 32) |
| Environment | Python 3.13.0, torch 2.8.0+cu126, transformers 4.57.1, sentence-transformers 5.1.2, peft 0.17.1, huggingface_hub 0.36.0, scikit-learn 1.8.0 |

Candidate registry (12 models) and outcome:

| Model | Repo @ revision | Params | Family | Task A | Task B |
|---|---|---:|---|---|---|
| MiniLM-L6 | sentence-transformers/all-MiniLM-L6-v2 @ `1110a243fdf4` | 23M | embedder | ✅ | ✅ |
| ModernBERT-base | answerdotai/ModernBERT-base @ `8949b909ec90` | 149M | encoder | ✅ | ✅ |
| DeBERTa-v3-base | microsoft/deberta-v3-base @ `8ccc9b6f3619` | 184M | encoder | ✅ | ✅ |
| NeoBERT | chandar-lab/NeoBERT @ `5424c8efeea6` | 250M | encoder | ❌ needs `xformers` | ❌ needs `xformers` |
| EmbeddingGemma-300m | google/embeddinggemma-300m @ `57c266a740f5` | 308M | embedder | ⏭ gated | ⏭ gated |
| e5-large-instruct | intfloat/multilingual-e5-large-instruct @ `274baa43b0e1` | 560M | embedder | ✅ (collapsed) | ✅ |
| bge-m3 | BAAI/bge-m3 @ `5617a9f61b02` | 568M | embedder | ✅ | ✅ |
| Qwen3-Embedding-0.6B | Qwen/Qwen3-Embedding-0.6B @ `97b0c614be4d` | 596M | embedder | ✅ | ⚠ network failure, resumable |
| Qwen3-Reranker-0.6B | Qwen/Qwen3-Reranker-0.6B @ `e61197ed4502` | 596M | reranker | — | ⚠ network failure |
| Qwen3-0.6B | Qwen/Qwen3-0.6B @ `c1899de289a0` | 596M | generative | ⚠ network failure | ✅ |
| Harrier-0.6B, BitNet-Embedding-0.6B | no verified repo id | ~600M | embedder | ⏭ | ⏭ |

---

## 2. How the run went (operations)

### 2.1 Timeline

| When (Tehran) | Event |
|---|---|
| Tue 29 Sep 18:49 | Start. 5 baselines done in < 1 min. |
| Tue 18:50 – 22:35 | MiniLM A/B, ModernBERT A/B, DeBERTa A (OOM at micro-batch 8 → designed retry at 4). |
| Tue 22:35 – Wed 06:21 | DeBERTa B (7.8 h, OOM retry 8 → 4). NeoBERT fails at import; EmbeddingGemma skipped (gated). |
| Wed 06:22 – 18:48 | e5-large-instruct A/B, bge-m3 A/B. |
| Wed 18:48 | Qwen3-Embedding A starts; OOM during epoch-1 validation (19:22) → restart at micro-batch 2. |
| Wed 20:40 – 23:36 | Machine RAM-starved by other apps: epoch 2 took 3.2 h instead of ~1 h. |
| Wed 23:38 | Stopped by the operator (Ctrl+C) two minutes after a resume checkpoint. |
| Thu 1 Oct 18:20 | **Resumed** from the checkpoint at epoch 3 → Qwen3-Embedding A completed at 21:12. |
| Thu 21:12 – Fri 19:12 | Qwen3-Embedding B: interrupted twice, **resumed** once from mid-epoch 1; epoch 1 val nDCG@10 0.807. Last checkpoint: epoch 2, micro-batch 2,344 / 4,887. |
| Sat 3 Oct 02:29 – 02:44 | Restart during an internet outage: Qwen3-Embedding B fails verifying its repo (`SSLError`, checkpoint kept), Qwen3-Reranker's download breaks at 953 of 1,191 MB, Qwen3-0.6B A fails (`ConnectionError`). |
| Sat 02:44 – 09:36 | Qwen3-0.6B B completes (6.9 h). Harrier/BitNet skipped. Run ends. |

Sum of the completed units' wall-clock time: **33.7 h**. Elapsed calendar time was longer (~87 h) because of the
operator pauses and outages.

### 2.2 What the safety mechanisms did

| Mechanism | Outcome in this run |
|---|---|
| OOM retry (half micro-batch, same effective batch) | 3 units: DeBERTa A & B (8 → 4), Qwen3-Embedding A (4 → 2). All then completed. |
| Mid-unit resume (added for this run, §10) | Used **twice** in production (Qwen3-Embedding A at epoch 3, Qwen3-Embedding B at epoch 1 micro-batch 3,440). Kept the checkpoint after the network failure. |
| GPU-memory leak guard (added for this run) | After every unit: 64 MB still allocated (normal cuBLAS overhead). No leak. |
| Failure isolation | NeoBERT and the network failures were recorded and the run continued. |

### 2.3 Lessons about the environment

- **RAM is this laptop's bottleneck.** The run keeps ~8–11 GB committed during the 0.6B models; when other applications pushed "available" RAM under ~1 GB, Windows paged the trainer out and throughput fell ~3–10×. Wall-clock training times (§6) include such episodes and are **not** a clean speed comparison between models.
- **The connection to Hugging Face is unreliable** (timeouts, DNS blips, a 15-minute outage). Downloads use 60 s timeouts and resume; unit failures caused by the network are retryable.

---

## 3. Task A — story-point estimation: results

Ordinal classification into buckets 1, 2, 3, 5, 8, 13, 21 from issue text (CORAL head; primary metric QWK).

### 3.1 Leaderboard (test, 8,707 issues)

| # | Model | Params | QWK [95 % CI] | Δ QWK vs TF-IDF [95 % CI] | MAE (buckets) | ±1 bucket | Exact | Macro-F1 | ECE |
|---:|---|---:|---|---|---:|---:|---:|---:|---:|
| 1 | **DeBERTa-v3-base** | 184M | **0.486** [0.468, 0.503] | **+0.024** [+0.009, +0.039] | 1.283 | 64.5 % | **34.3 %** | 0.213 | 0.302 |
| 2 | bge-m3 | 568M | 0.474 [0.455, 0.492] | +0.012 [−0.003, +0.028] | 1.312 | 63.4 % | 33.6 % | 0.207 | 0.319 |
| 3 | Qwen3-Embedding-0.6B | 596M | 0.470 [0.450, 0.489] | +0.008 [−0.007, +0.024] | 1.268 | 64.6 % | 33.9 % | 0.221 | 0.308 |
| — | *TF-IDF + ridge (baseline)* | 50k feats | *0.461* [0.444, 0.479] | — | ***1.084*** | ***72.5 %*** | 27.4 % | ***0.244*** | — |
| 4 | ModernBERT-base | 149M | 0.457 [0.438, 0.476] | −0.004 [−0.020, +0.012] | 1.323 | 63.1 % | 33.4 % | 0.206 | 0.309 |
| 5 | MiniLM-L6 | 23M | 0.453 [0.434, 0.472] | −0.009 [−0.024, +0.006] | 1.341 | 63.3 % | 32.8 % | 0.205 | 0.309 |
| — | *Median per project (baseline)* | 39 | *0.242* [0.226, 0.257] | −0.220 | 1.217 | 64.2 % | 25.8 % | 0.170 | — |
| 6 | e5-large-instruct | 560M | **0.000** (collapsed) | −0.461 | 1.764 | 51.3 % | 27.6 % | 0.062 | 0.307 |

Paired comparisons with the winner (DeBERTa minus model, 95 % CI): vs bge-m3 **+0.012** [+0.002, +0.022] · vs
Qwen3-Embedding **+0.016** [+0.004, +0.028] · vs ModernBERT **+0.028** [+0.016, +0.040] · vs MiniLM **+0.033**
[+0.022, +0.044]. DeBERTa's lead is statistically real but small.

Not evaluated: Qwen3-0.6B generative (network failure), NeoBERT (import), EmbeddingGemma (gated).

### 3.2 What the numbers say

1. **Only DeBERTa-v3-base is significantly better than TF-IDF + ridge**, and by 0.024 QWK. bge-m3, Qwen3-Embedding, ModernBERT and MiniLM are statistically indistinguishable from the bag-of-words baseline.
2. **On the product-facing metrics TF-IDF wins**: lower mean error (1.08 vs 1.27–1.34 buckets) and more estimates within ±1 bucket (72.5 % vs 63–65 %). The transformers get more exact hits (33–34 % vs 27 %) but make bigger misses.
3. **Predictions are polarised.** Every transformer predicts bucket "1" for 5,260–5,570 issues (true: 2,407) and "21" for 590–870 (true: 247); middle buckets are under-predicted (DeBERTa predicts "2" only 171 times vs 2,056 true). Confusion matrices: Appendix C.
4. **Probabilities are poorly calibrated** (ECE ≈ 0.30 for all transformers): a "53 % confident" suggestion would not mean 53 %.
5. **e5-large-instruct collapsed**: it predicted "1" for every issue in both epochs (val QWK exactly 0.0), so early stopping ended it after epoch 2. This is a head-initialisation effect, not a verdict on the model (§8.1).
6. **Training curves:** bge-m3 and MiniLM were still improving at epoch 4 (budget-limited); DeBERTa, ModernBERT and Qwen3-Embedding peaked at epoch 3.

---

## 4. Task B — assignee ranking: results

Score each (task, member-profile) pair and rank all 48 members. Primary metric nDCG@10 with gain = Plausibility.
Headline metrics use the 2,000 classified test tasks.

### 4.1 Leaderboard (test)

| # | Model | Params | Recipe | nDCG@10 [95 % CI] | Δ vs best [95 % CI] | nDCG@5 | Recall@5 | Recall@10 | Hit@1 | MRR | Held-out members nDCG@10 |
|---:|---|---:|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | **Qwen3-0.6B** | 596M | generative yes/no (LoRA) | **0.823** [0.813, 0.834] | — | 0.765 | 0.709 | **0.903** | 0.288 | 0.498 | **0.819** |
| 1 | **e5-large-instruct** | 560M | bi-encoder (LoRA) | **0.821** [0.811, 0.833] | −0.002 [−0.009, +0.007] | **0.767** | 0.709 | 0.901 | **0.304** | **0.501** | 0.815 |
| 3 | bge-m3 | 568M | bi-encoder (LoRA) | 0.805 [0.794, 0.816] | −0.019 [−0.027, −0.010] | 0.746 | 0.689 | 0.885 | 0.278 | 0.479 | 0.803 |
| 4 | MiniLM-L6 | 23M | bi-encoder (full) | 0.771 [0.759, 0.784] | −0.052 [−0.062, −0.043] | 0.710 | 0.658 | 0.858 | 0.253 | 0.446 | 0.771 |
| 5 | DeBERTa-v3-base | 184M | cross-encoder (full) | 0.766 [0.755, 0.779] | −0.057 [−0.065, −0.048] | 0.703 | 0.644 | 0.846 | 0.243 | 0.444 | 0.766 |
| 6 | ModernBERT-base | 149M | cross-encoder (full) | 0.698 [0.685, 0.712] | −0.126 [−0.135, −0.116] | 0.621 | 0.569 | 0.794 | 0.214 | 0.398 | 0.699 |
| — | *Popularity* | — | baseline | *0.288* | | 0.220 | 0.174 | 0.348 | 0.058 | 0.196 | 0.340 |
| — | *TF-IDF cosine* | — | baseline | *0.232* | | 0.164 | 0.171 | 0.321 | 0.019 | 0.120 | 0.265 |
| — | *Random* | — | baseline | *0.152* | | 0.108 | 0.108 | 0.210 | 0.024 | 0.093 | 0.157 |

Not finished: **Qwen3-Embedding-0.6B** (val nDCG@10 **0.807** after epoch 1 of 2), **Qwen3-Reranker-0.6B** — §9.

### 4.2 What the numbers say

1. **Fine-tuned models are far ahead of every baseline** (+0.41 to +0.54 nDCG@10 over the best baseline). Fine-tuning roughly tripled the embedders' zero-shot quality (e5 0.291 → 0.799 val, bge-m3 0.239 → 0.799, MiniLM 0.273 → 0.763).
2. **Qwen3-0.6B and e5-large-instruct tie** (difference 0.002, CI includes 0). Both are significantly ahead of bge-m3, which is significantly ahead of MiniLM and DeBERTa.
3. **The shortlist quality is good, the single best pick is hard:** the right people are in the top 10 ~90 % of the time and in the top 5 ~71 %, but the model's top pick is the scorer's single best-routed member only ~29–30 % of the time (Hit@1).
4. **Cold start is solved at this budget:** for the 1,452 test tasks where a held-out member is relevant, nDCG@10 matches the overall figure for every model.
5. **Bi-encoders beat cross-encoders** here. The cross-encoders (DeBERTa, ModernBERT) are both less accurate and more expensive at inference (48 forward passes per task).
6. **Seniority fit differs between the two leaders:** Qwen3-0.6B's top pick is *over*-qualified for 34.6 % of tasks vs 22.7 % for e5 (under-qualified: 9.8 % vs 12.0 %). For a product that should not waste senior people, e5 behaves better.

---

## 5. Deeper analysis

### 5.1 Task A is mostly "which project", not "which issue"

Story points are project-relative. The median-per-project baseline alone reaches QWK 0.242. Across the 16 test
projects with ≥ 100 issues, the median **within-project** QWK is 0.218 (DeBERTa), 0.224 (TF-IDF), 0.250
(Qwen3-Embedding) and 0.139 (bge-m3) — far below the overall 0.46–0.49. Some large projects are essentially
unpredictable for every model (NEXUS, STL, MDL, TIDOC: QWK ≈ 0–0.1), others work well (DM, n = 2,890: 0.55–0.61).
Per-project table: Appendix B.

### 5.2 Issue type and edited text (Task A, DeBERTa)

| Slice | QWK | | Slice | QWK |
|---|---:|---|---|---:|
| Improvement | 0.511 | | Bug | 0.371 |
| Story | 0.431 | | other | 0.318 |
| Task | 0.427 | | New Feature | 0.134 |
| Epic | 0.000 | | | |
| text **unchanged** after estimation | 0.492 | | text **changed** after estimation (n = 1,388) | 0.453 |

Issues whose title/description were edited after estimation score ~0.04 lower for every model (the model sees the
final text, the estimate was made on the original). Epics and New Features are poorly predicted by all transformers.

### 5.3 Task B by work area and required level (nDCG@10)

| Slice | n tasks | Qwen3-0.6B | e5-large | bge-m3 | MiniLM | Popularity |
|---|---:|---:|---:|---:|---:|---:|
| Frontend | 560 | 0.885 | **0.888** | 0.873 | 0.870 | 0.580 |
| Security | 156 | 0.876 | **0.902** | 0.885 | 0.836 | 0.065 |
| QA/Testing | 154 | **0.843** | 0.821 | 0.803 | 0.787 | 0.197 |
| Documentation | 124 | **0.839** | 0.731 | 0.774 | 0.666 | 0.215 |
| Database | 277 | 0.805 | **0.809** | 0.785 | 0.772 | 0.232 |
| API/Integration | 254 | 0.801 | **0.808** | 0.793 | 0.773 | 0.203 |
| Infrastructure | 121 | 0.772 | **0.775** | 0.743 | 0.641 | 0.108 |
| DevOps | 216 | **0.749** | **0.749** | 0.733 | 0.652 | 0.124 |
| Backend | 138 | 0.718 | **0.744** | 0.692 | 0.667 | 0.208 |
| *Unclassified* | 500 | 0.200 | 0.233 | 0.278 | 0.221 | 0.179 |
| Required: Intern | 11 | 0.237 | **0.341** | 0.265 | 0.199 | 0.010 |
| Required: Junior | 254 | 0.523 | 0.545 | **0.570** | 0.522 | 0.134 |
| Required: Mid-level | 1,745 | 0.758 | **0.773** | 0.770 | 0.744 | 0.327 |
| Required: Senior | 427 | **0.610** | 0.569 | 0.546 | 0.486 | 0.143 |
| Required: Staff | 50 | **0.458** | 0.417 | 0.360 | 0.227 | 0.010 |
| Required: Principal | 13 | **0.439** | 0.307 | 0.424 | 0.107 | 0.000 |

- e5 leads most work areas; Qwen3-0.6B is clearly better on **Documentation** and on **senior/staff/principal** tasks.
- **Rare required levels are weak for everyone** (Intern, Staff, Principal have 11–50 test tasks and few training examples at this budget) — expected, and a reason to re-check at the full budget.
- **Unclassified tasks (weak labels) score 0.20–0.28** for every model, and DeBERTa's cross-encoder is best there (0.384). This slice is not in the headline metric by design.

### 5.4 Overfitting check

Validation and test agree closely for every Task B model (e.g. e5 0.799 val → 0.821 test, Qwen3-0.6B 0.813 → 0.823);
test is slightly *higher*, so there is no sign of overfitting to the validation split. For Task A, test QWK is
0.04–0.05 below validation for every transformer (0.02 for TF-IDF): partly the expected optimism of picking the best
epoch on validation, partly split difficulty — consistent across models, so the ranking is unaffected.

### 5.5 Data-quality finding: `mae_raw_points` is invalid

`mae_raw_points` is ≈ 3,071 for **every** model and baseline. The cause is one test issue (project DATACASS) whose
recorded story point is **26,710,114**; nine more DM issues are between 111 and 144. Excluding the 10 values above
100, DeBERTa's raw-point MAE is **3.2 points** (median absolute error 1.0). **Ignore `mae_raw_points` as reported**;
a robust version (median error, or clipping raw points to 100) should replace it in a future run.

---

## 6. Cost and efficiency

Training times are wall-clock on the laptop and include RAM-starvation episodes (§2.3) — use them as rough cost, not
as a speed ranking. Latency = median over 200 test items at batch size 1 on the RTX 4050, including tokenisation;
for Task B an item is one task scored against all 48 members (bi-encoders reuse pre-computed member embeddings).

| Model | Task | Params | Trainable | Method | Micro-batch | Train time | Peak GPU | Latency bs1 | Throughput (batched) |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|
| MiniLM-L6 | A | 23M | 22.7M | full | 8 | 0.1 h | 0.5 GB | **9.9 ms** | 692 / s |
| ModernBERT-base | A | 149M | 149M | full | 8 | 0.4 h | 3.0 GB | 36.8 ms | 113 / s |
| DeBERTa-v3-base | A | 184M | 184M | full | 4 (OOM retry) | 1.8 h | 4.1 GB | 111 ms | 85 / s |
| e5-large-instruct | A | 560M | 7.1M | LoRA | 4 | 1.6 h | 2.0 GB | 213 ms | 33 / s |
| bge-m3 | A | 568M | 7.1M | LoRA | 4 | 3.1 h | 2.0 GB | 213 ms | 25 / s |
| Qwen3-Embedding-0.6B | A | 596M | 10.1M | LoRA | 2 (OOM retry) | 7.0 h* | 3.2 GB | 159 ms | 26 / s |
| MiniLM-L6 | B | 23M | 22.7M | full | 8 | 0.15 h | 0.6 GB | **9.9 ms** | 581 tasks / s |
| ModernBERT-base | B | 149M | 149M | full | 8 | 1.0 h | 3.0 GB | 166 ms | 4.2 tasks / s |
| DeBERTa-v3-base | B | 184M | 184M | full | 4 (OOM retry) | 7.4 h | 4.1 GB | 362 ms | 2.1 tasks / s |
| e5-large-instruct | B | 560M | 7.1M | LoRA | 4 | 5.4 h | 2.0 GB | 214 ms | 27 tasks / s |
| bge-m3 | B | 568M | 7.1M | LoRA | 4 | 2.2 h | 2.0 GB | 83 ms | 29 tasks / s |
| Qwen3-0.6B | B | 596M | 10.1M | LoRA | 4 | 5.4 h | 3.4 GB | **1,250 ms** | 0.6 tasks / s |

\* includes a RAM-starved epoch (3.2 h instead of ~1 h) and an interruption.

Notes:
- e5-large-instruct and bge-m3 share the same XLM-RoBERTa-large architecture; their Task B latencies (214 vs 83 ms) differ mainly because of machine load during measurement. Expect similar production latency for the two.
- Qwen3-0.6B's latency is structural: it runs one LLM forward pass per (task, member) pair, so cost grows linearly with team size. A bi-encoder embeds each member once and scores a task with one encoder pass plus 48 dot products.
- `SUMMARY.md`'s "efficiency-adjusted pick" (smallest pretrained model within 0.01 of the best): **Task B → e5-large-instruct** (560M vs 596M at −0.002); **Task A → DeBERTa-v3-base** (no other model within 0.01).

---

## 7. Recommendations

### 7.1 Task A — story points

1. **Do not ship a transformer story-point model on this evidence.** The best model (DeBERTa-v3-base) beats TF-IDF + ridge by only 0.024 QWK, and is worse on mean error and ±1-bucket accuracy. If a model must be chosen from this run, choose **DeBERTa-v3-base** (184M, ~111 ms).
2. **Use TF-IDF + ridge as the production bar** (and a sensible fallback): it is cheap, calibrated towards the middle buckets, and gives the best ±1-bucket accuracy (72.5 %).
3. **Next experiments, in order of expected value:**
   - Finish **Qwen3-0.6B generative** Task A (network failure).
   - Re-examine the CORAL head start. The run kept the specified zero-initialised thresholds (team decision). In the pre-flight, MiniLM at the same budget scored QWK **0.503** with thresholds initialised at the training-label log-odds vs **0.452** with zero start (±1 accuracy 71.5 % vs 63.3 %). That alternative is worth a controlled re-run across models; it is not applied in this run.
   - A larger budget (full train split, more epochs): bge-m3 and MiniLM were still improving at epoch 4.
   - Per-project calibration, given that within-project ranking is the weak part.

### 7.2 Task B — assignee ranking

1. **Primary choice: e5-large-instruct** (MIT, 560M, LoRA). It ties with the best model, is a bi-encoder (members embedded once, scales to large teams), ~6× faster than Qwen3-0.6B as measured, has the lowest over-qualification rate among the leaders, and is multilingual.
2. **Budget choices:** **bge-m3** (−0.019 nDCG@10, same size class, MIT) or **MiniLM-L6** (−0.052, 23M parameters, ~10 ms per task, Apache-2.0) if latency/cost dominates.
3. **Before the final decision:** finish **Qwen3-Embedding-0.6B** (its validation score after one epoch already exceeds e5's final validation score) and **Qwen3-Reranker-0.6B** — both are the research report's leading hypotheses for this task (§9.1, ~10–15 h).
4. **Confirm the top 2–3 at the full data budget** (`README.md` defaults) before production: this run is a reduced-budget screening, single seed.

---

## 8. Caveats and threats to validity

### 8.1 CORAL threshold initialisation (Task A)
The CORAL head starts all six thresholds at 0 and learns them at LR 1e-3. Within 4 epochs this leaves predictions
polarised (§3.2) and hit embedders with L2-normalised outputs hardest (e5 collapsed). The specification was kept
deliberately; the effect applies to every model, but **not equally**, so the Task A ranking among transformers is
partly a ranking of how well each copes with the head, not only of text understanding.

### 8.2 Other caveats
- **Reduced budget (scenario B), single seed, no hyperparameter search.** Differences smaller than the CIs above are noise. Larger models may be handicapped more by the small budget.
- **Synthetic team and labels (Task B).** Plausibility comes from a scoring function, not observed outcomes; the models learn to reproduce that scorer from profile text.
- **OOM retries changed micro-batches:** DeBERTa (A, B) ran at 4, Qwen3-Embedding A at 2. The effective batch stayed 32. For Task A this is neutral; none of the *completed* bi-encoders (whose in-batch negatives depend on the micro-batch) needed a retry.
- **Latency and training times were measured on a shared, RAM-constrained laptop** and vary up to ~2× with machine load.
- **Final text, not estimation-time text** (Task A): edited issues score ~0.04 lower.
- **`mae_raw_points` is invalid** (§5.5).
- **Rare slices are small** (e.g. 11 Intern / 13 Principal test tasks): treat their numbers as indicative only.
- **Unclassified tasks** are excluded from headline Task B metrics by design and are much harder for all models.

---

## 9. Unfinished units, weights, and how to complete the benchmark

### 9.1 Unfinished units

| Unit | Status | What is needed |
|---|---|---|
| Qwen3-Embedding-0.6B, Task B | `failed (SSLError)` — network; **resume checkpoint kept** (epoch 2, micro-batch 2,344 / 4,887) | `--retry-failed` → resumes; ~1 h |
| Qwen3-Reranker-0.6B, Task B | `failed (ChunkedEncodingError)` — download broke | `--retry-failed`; ~6–9 h |
| Qwen3-0.6B generative, Task A | `failed (ConnectionError)` | `--retry-failed`; ~4–6 h |
| NeoBERT, A and B | `failed (ImportError)` — model code needs `xformers` | Install a matching `xformers` build; even then a full fine-tune likely exceeds 6 GB VRAM (no gradient-checkpointing support) |
| EmbeddingGemma-300m, A and B | `skipped (gated_access_denied)` | Accept the Gemma license on Hugging Face with the account whose token is used; then `--force embeddinggemma_300m` |
| Harrier-0.6B, BitNet-Embedding-0.6B | `skipped (repo_id_unverified)` | Fill in verified `hf_repo_id`s in the config |

To finish the three network failures (from `apps/ai/model_selection/OA2`, same environment):

```powershell
$env:HF_HUB_DOWNLOAD_TIMEOUT = "60"; $env:HF_HUB_ETAG_TIMEOUT = "60"
python run_model_selection.py --config <your config> --retry-failed
```

NeoBERT will be re-queued too and fail again within seconds (harmless). Completed units are never re-run.

### 9.2 Why there are no weights
`README.md` §8 requires every unit to **erase** its downloaded model and fine-tuned weights after reporting; the
reports, predictions and logs are the kept artifacts. The only leftover is Qwen3-Embedding B's resume checkpoint
(`.work/`, 155 MB, LoRA adapters + optimizer state of an unfinished run) — not a usable model, and git-ignored.

### 9.3 How to get deployable weights for the chosen model
Re-train only that model with the same configuration and `--keep-weights` (or, better, at the full data budget):

```powershell
python run_model_selection.py --config <your config> --only e5_large_instruct --task task_assignment --force e5_large_instruct --keep-weights
```

The trained trainable parameters are then in `.work/<run_id>/best.pt` (for LoRA models: adapters + head on top of
the pinned base revision). Model weights do not belong in this git repository (size limits: GitHub rejects files
> 100 MB); publish them to a model registry or Hugging Face instead.

---

## 10. Engineering changes made during this run

The benchmark code had never been executed before this run (`IMPLEMENTATION.md` §1). A pre-flight smoke test on this
laptop found and fixed the following; none of them changes any run ID or any training/evaluation logic:

| Change | File(s) | Why |
|---|---|---|
| Serial model downloads (`max_workers=1`) | `oa2/registry.py` | `huggingface_hub`'s per-folder symlink probe races between download threads on Windows without symlink rights → random `WinError 1314` download failures. |
| Break the SentenceTransformer ↔ model-card reference cycle at load | `oa2/models.py` | Every sentence-transformers model stayed on the GPU after its unit; later units ran out of memory (bge-m3 failed this way in the pre-flight). Verified: 64 MB left after each unit. |
| Leak guard: log GPU memory left after each unit, warn above 256 MB | `oa2/cleanup.py` | Early warning for any future leak. |
| **Mid-unit resume** (checkpoint every 15 min + each epoch boundary; atomic writes; cached zero-shot metrics; failed-by-network units keep their checkpoint for `--retry-failed`) | `oa2/training.py`, `run_model_selection.py`, `oa2/recipes/*.py`, `oa2/report.py`, `oa2/cleanup.py` | Power cuts and interruptions. Verified bit-identical to uninterrupted training (CPU tests) and used twice in this run. Documented in `IMPLEMENTATION.md` §17.9. |
| Peak GPU memory reset per unit | `run_model_selection.py` | A unit failing before training no longer reports the previous unit's peak. |

Known remaining issues (not fixed): `mae_raw_points` outlier sensitivity (§5.5); the log line `Test qwk nan` is
printed when QWK is exactly 0 (cosmetic, JSON is correct); the stop message still says "restart cleanly" although
the unit now resumes.

---

## 11. Reproducibility

- Code: branch `ai/OA2`, base commit `2fd617f` plus the changes in §10 (committed together with these results).
- Configuration: `config.yaml` (scenario B). The run used a local copy that differs only in `dataset_dir` and `hf_cache_dir`; neither is part of any run ID, so every run ID here matches `config.yaml`.
- Every report JSON records the run ID, data fingerprint, model revision SHA, hyperparameters, environment and notes.
- Statistics in this report: test predictions from `predictions/*.csv.gz`; bootstrap over test issues (Task A) or classified test tasks (Task B), 1,000 resamples, seed 20260916; paired differences use the same resamples for both models. Recomputed nDCG@10 matches the reports to 4 decimals.

---

## 12. Appendices

### Appendix A — run IDs

| Task | Model | Run ID | Status |
|---|---|---|---|
| A | median per project | `story_point__baseline_median_per_project__median_per_project__214efb43` | completed |
| A | TF-IDF + ridge | `story_point__baseline_tfidf_ridge__tfidf_ridge__490ae8ff` | completed |
| A | MiniLM-L6 | `story_point__minilm_l6__coral__560bd5ff` | completed |
| A | ModernBERT-base | `story_point__modernbert_base__coral__a2a96b38` | completed |
| A | DeBERTa-v3-base | `story_point__deberta_v3_base__coral__fb427735` | completed |
| A | NeoBERT | `story_point__neobert__coral__a1c9f612` | failed (ImportError) |
| A | EmbeddingGemma | `story_point__embeddinggemma_300m__coral__cf70bf18` | skipped |
| A | e5-large-instruct | `story_point__e5_large_instruct__coral__5f7ca27c` | completed |
| A | bge-m3 | `story_point__bge_m3__coral__3cb2476d` | completed |
| A | Qwen3-Embedding-0.6B | `story_point__qwen3_embedding_0_6b__coral__7f8eb618` | completed |
| A | Qwen3-0.6B | `story_point__qwen3_0_6b__generative_sft__f0336cc3` | failed (ConnectionError) |
| A | Harrier-0.6B | `story_point__harrier_0_6b__coral__8a4638bd` | skipped |
| B | random | `task_assignment__baseline_random__random__12da73e3` | completed |
| B | popularity | `task_assignment__baseline_popularity__popularity__b008d7ad` | completed |
| B | TF-IDF cosine | `task_assignment__baseline_tfidf_cosine__tfidf_cosine__f7f8cc8b` | completed |
| B | MiniLM-L6 | `task_assignment__minilm_l6__bi_encoder__13f22a09` | completed |
| B | ModernBERT-base | `task_assignment__modernbert_base__cross_encoder__bd5ceaee` | completed |
| B | DeBERTa-v3-base | `task_assignment__deberta_v3_base__cross_encoder__63dca8c0` | completed |
| B | NeoBERT | `task_assignment__neobert__cross_encoder__9412f43c` | failed (ImportError) |
| B | EmbeddingGemma | `task_assignment__embeddinggemma_300m__bi_encoder__2c8ab7fe` | skipped |
| B | e5-large-instruct | `task_assignment__e5_large_instruct__bi_encoder__7b53f1e8` | completed |
| B | bge-m3 | `task_assignment__bge_m3__bi_encoder__c2a0b06a` | completed |
| B | Qwen3-Embedding-0.6B | `task_assignment__qwen3_embedding_0_6b__bi_encoder__8b22f441` | failed (SSLError), resumable |
| B | Qwen3-Reranker-0.6B | `task_assignment__qwen3_reranker_0_6b__reranker_yes_no__5194cd33` | failed (ChunkedEncodingError) |
| B | Qwen3-0.6B | `task_assignment__qwen3_0_6b__generative_yes_no__29e6cf50` | completed |
| B | Harrier-0.6B | `task_assignment__harrier_0_6b__bi_encoder__eade0929` | skipped |
| B | BitNet-Embedding-0.6B | `task_assignment__bitnet_embedding_0_6b__bi_encoder__28ff8107` | skipped |

### Appendix B — Task A QWK per project (test projects with ≥ 100 issues)

| Project | Test issues | DeBERTa-v3 | TF-IDF + ridge | bge-m3 | Qwen3-Embedding |
|---|---:|---:|---:|---:|---:|
| DM | 2,890 | 0.605 | 0.553 | 0.606 | 0.606 |
| EVG | 752 | 0.087 | 0.210 | 0.012 | 0.072 |
| MULE | 553 | 0.462 | 0.280 | 0.350 | 0.402 |
| XD | 492 | 0.437 | 0.361 | 0.394 | 0.368 |
| MESOS | 486 | 0.370 | 0.452 | 0.377 | 0.344 |
| DNN | 383 | 0.219 | 0.237 | 0.154 | 0.280 |
| TISTUD | 372 | 0.231 | 0.092 | 0.210 | 0.229 |
| TIMOB | 270 | 0.427 | 0.258 | 0.515 | 0.509 |
| NEXUS | 269 | 0.012 | 0.176 | 0.000 | −0.001 |
| MDL | 223 | 0.060 | 0.056 | 0.058 | 0.115 |
| TIDOC | 181 | 0.075 | 0.027 | 0.063 | 0.068 |
| STL | 142 | 0.001 | 0.080 | 0.022 | 0.095 |
| APSTUD | 125 | 0.165 | 0.194 | 0.056 | 0.161 |
| SERVER | 110 | 0.216 | 0.337 | 0.088 | 0.239 |
| INDY | 102 | 0.047 | 0.073 | 0.123 | 0.262 |
| IS | 102 | 0.461 | 0.323 | 0.363 | 0.394 |

The test split covers 39 projects; the other 23 have fewer than 100 test issues (per-project numbers for all of them
are in each run's `metrics.slices`).

### Appendix C — Task A confusion matrices (test; rows = true bucket, columns = predicted)

DeBERTa-v3-base:

| true \ pred | 1 | 2 | 3 | 5 | 8 | 13 | 21 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **1** (2,407) | **1,977** | 35 | 90 | 214 | 14 | 2 | 75 |
| **2** (2,056) | 1,549 | **42** | 131 | 283 | 5 | 0 | 46 |
| **3** (1,309) | 735 | 38 | **131** | 317 | 6 | 3 | 79 |
| **5** (1,760) | 763 | 39 | 149 | **607** | 34 | 5 | 163 |
| **8** (714) | 203 | 15 | 49 | 265 | **25** | 6 | 151 |
| **13** (214) | 26 | 2 | 8 | 75 | 11 | **1** | 91 |
| **21** (247) | 8 | 0 | 6 | 27 | 2 | 1 | **203** |

TF-IDF + ridge:

| true \ pred | 1 | 2 | 3 | 5 | 8 | 13 | 21 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **1** (2,407) | **297** | 1,010 | 785 | 256 | 51 | 5 | 3 |
| **2** (2,056) | 159 | **750** | 872 | 247 | 27 | 1 | 0 |
| **3** (1,309) | 23 | 330 | **633** | 271 | 43 | 7 | 2 |
| **5** (1,760) | 28 | 295 | 768 | **550** | 103 | 13 | 3 |
| **8** (714) | 1 | 85 | 244 | 279 | **83** | 13 | 9 |
| **13** (214) | 0 | 13 | 54 | 91 | 39 | **13** | 4 |
| **21** (247) | 0 | 6 | 25 | 35 | 39 | 83 | **59** |

The transformer pushes small issues to "1" and recognises the very largest (82 % recall on "21"); TF-IDF regresses
towards the middle buckets ("2"–"5"), which gives it the smaller average error.
