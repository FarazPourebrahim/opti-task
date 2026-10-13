# OA2 — Model Selection Benchmark: Results Report

**Run:** 2026-09-29 18:49 → 2026-10-03 09:36, plus a retry of three network-failed units on 2026-10-13 12:35 → 2026-10-14 01:50 (Tehran time)
**Branch:** `ai/OA2` · **Machine:** HP OMEN 16 laptop, NVIDIA RTX 4050 Laptop 6 GB, 13.7 GB RAM, Windows 11
**Data budget:** scenario B (reduced; see `config.yaml`) · **Primary metrics:** Task A test QWK, Task B test nDCG@10
**Status:** **20 of 27 units completed**, 2 failed (NeoBERT, missing dependency — expected), 5 skipped (by design: gated or unverified repos). Every candidate that could run has a result.

This report interprets the per-run JSONs in `reports_story_point/runs/` and `reports_tast_assignment/runs/` (the
authoritative record), the leaderboards, and `SUMMARY.md`. Confidence intervals and paired comparisons were computed
from the saved test predictions (`predictions/*.csv.gz`) with a bootstrap (1,000 resamples, seed 20260916).

---

## Executive summary

| | Task A — story-point estimation | Task B — assignee ranking |
|---|---|---|
| **Best model** | **Qwen3-0.6B, generative** (596M, LoRA): test QWK **0.533** [0.515, 0.550] | **Qwen3-Embedding-0.6B, bi-encoder** (596M, LoRA): test nDCG@10 **0.836** [0.826, 0.846] |
| **Margin** | **+0.071** QWK over TF-IDF + ridge [+0.057, +0.085]; **+0.047** over the next model, DeBERTa-v3-base [+0.033, +0.060] | **+0.011** over Qwen3-Reranker [+0.003, +0.018], **+0.012** over Qwen3-0.6B [+0.005, +0.020], **+0.014** over e5-large-instruct [+0.006, +0.022] |
| **Why it matters** | First model to clearly beat the bag-of-words baseline. Best mean error (1.06 buckets), exact accuracy (37.3 %) and macro-F1 (0.343), and half the calibration error of every other model (ECE 0.154 vs ≈ 0.30). TF-IDF keeps a small edge on ±1-bucket accuracy (72.5 % vs 69.9 %). | Significantly better than every other model, and also the fastest of the leaders (**~100 ms** per task, all 48 members): a bi-encoder embeds each member once, so a request is one model pass. |
| **Recommendation** | **Qwen3-0.6B (generative)** for production story-point suggestions, with TF-IDF + ridge as the fallback. Confirm at the full data budget first. | **Qwen3-Embedding-0.6B** for production assignee suggestions. Budget option: **MiniLM-L6** (−0.065, 23M params, ~10 ms). |

Other headline findings:

- **Cold start works.** On test tasks where a never-seen team member is relevant, nDCG@10 matches the overall figure (Qwen3-Embedding 0.828 vs 0.836). The product requirement "rank people the model has never seen" is met.
- **Bi-encoders beat cross-encoders and LLM scorers for assignment**, on quality *and* on cost: Qwen3-Embedding (100 ms) beats Qwen3-Reranker (1,459 ms) and Qwen3-0.6B (1,250 ms), which both run one forward pass per member.
- **The CORAL head was the bottleneck for story points.** Every encoder/embedder used the specified CORAL head with thresholds starting at 0, and all of them polarised their predictions towards buckets "1" and "21" (≈5,300 predicted "1" vs 2,407 true); e5-large-instruct collapsed completely (QWK 0.000). Qwen3-0.6B, whose generative recipe does not use that head, predicts a realistic spread (2,191 "1"s) and wins by a wide margin (§3.2, §8.1).
- **Story-point models mostly learn project scales.** Median **within-project** QWK is ~0.14–0.25 for most models against ~0.46–0.49 overall; Qwen3-0.6B raises it to **0.336**, the best within-project discrimination in the run.
- **Data-quality issue:** one test issue has a recorded story point of **26,710,114**. It makes `mae_raw_points` ≈ 3,070 for every model, so that metric is meaningless as computed (§5.5).
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
9. [Units without results, weights, and next runs](#9-units-without-results-weights-and-next-runs)
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
| Qwen3-Embedding-0.6B | Qwen/Qwen3-Embedding-0.6B @ `97b0c614be4d` | 596M | embedder | ✅ | ✅ **best** |
| Qwen3-Reranker-0.6B | Qwen/Qwen3-Reranker-0.6B @ `e61197ed4502` | 596M | reranker | — | ✅ |
| Qwen3-0.6B | Qwen/Qwen3-0.6B @ `c1899de289a0` | 596M | generative | ✅ **best** | ✅ |
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
| Thu 21:12 – Fri 19:12 | Qwen3-Embedding B: interrupted twice, **resumed** once from mid-epoch 1. Last checkpoint: epoch 2, micro-batch 2,344 / 4,887. |
| Sat 3 Oct 02:29 – 02:44 | Restart during an internet outage: Qwen3-Embedding B (`SSLError`, checkpoint kept), Qwen3-Reranker (download broke at 953 of 1,191 MB) and Qwen3-0.6B A (`ConnectionError`) fail. |
| Sat 02:44 – 09:36 | Qwen3-0.6B B completes (6.9 h). Harrier/BitNet skipped. First pass ends. |
| Tue 13 Oct 12:35 | `--retry-failed --only <the three Qwen models>`. Qwen3-Embedding B **resumes** from its kept checkpoint (epoch 2, micro-batch 2,344). |
| Tue 13:00 – 15:15 | Throughput ~3× too low: Windows Search indexer saturating the disk and Windows power throttling (Balanced mode, background-window efficiency cores). Fixed by stopping the indexer and switching to Best performance; GPU back to 100 %. |
| Tue 15:20 | Qwen3-Embedding B completed (test nDCG@10 0.836). |
| Tue 15:20 – 21:53 | Qwen3-Reranker B completed (0.825). |
| Tue 21:53 – Wed 14 Oct 01:50 | Qwen3-0.6B A completed (QWK 0.533). `Done. State: 5 completed, 0 failed` for the retry. |

Sum of the completed units' wall-clock time (final attempts): ≈ 47 h. Calendar time was much longer because of
operator pauses, outages and the gap before the retry.

### 2.2 What the safety mechanisms did

| Mechanism | Outcome in this run |
|---|---|
| OOM retry (half micro-batch, same effective batch) | 3 units: DeBERTa A & B (8 → 4), Qwen3-Embedding A (4 → 2). All then completed. |
| Mid-unit resume (added for this run, §10) | Used **three times** in production: Qwen3-Embedding A at epoch 3; Qwen3-Embedding B from mid-epoch 1 and, after the network failure, from epoch 2 micro-batch 2,344. A checkpoint kept through a `failed (SSLError)` state was resumed 11 days later. |
| GPU-memory leak guard (added for this run) | After every unit: 64 MB still allocated (normal cuBLAS overhead). No leak. |
| Failure isolation | NeoBERT and the network failures were recorded and the run continued; `--retry-failed` completed the network failures. |

### 2.3 Lessons about the environment

- **RAM is this laptop's bottleneck.** The run keeps ~7–11 GB committed during the 0.6B models; when other applications pushed "available" RAM under ~1–2 GB, Windows paged the trainer out and throughput fell ~3–10×.
- **Two more silent brakes:** the **Windows Search indexer** (reading 66–128 MB/s from disk, re-indexing freshly downloaded models) and **Windows power throttling** (Balanced power mode; background windows moved to efficiency cores at 77 % of base clock). Run long benchmarks in Best performance mode, with the indexer paused or the repo excluded from indexing.
- **Wall-clock training times (§6) include all of these episodes** and are not a clean speed comparison between models.
- **The connection to Hugging Face is unreliable** (timeouts, DNS blips, a 15-minute outage). Downloads use 60 s timeouts and resume; unit failures caused by the network are retryable without losing progress.

---

## 3. Task A — story-point estimation: results

Ordinal classification into buckets 1, 2, 3, 5, 8, 13, 21 from issue text (primary metric QWK). Encoders and
embedders use the CORAL head; Qwen3-0.6B is fine-tuned to generate the bucket (summed log-probability of each of the
7 answers).

### 3.1 Leaderboard (test, 8,707 issues)

| # | Model | Params | Recipe | QWK [95 % CI] | Δ QWK vs TF-IDF [95 % CI] | MAE (buckets) | ±1 bucket | Exact | Macro-F1 | ECE |
|---:|---|---:|---|---|---|---:|---:|---:|---:|---:|
| 1 | **Qwen3-0.6B** | 596M | generative (LoRA) | **0.533** [0.515, 0.550] | **+0.071** [+0.057, +0.085] | **1.063** | 69.9 % | **37.3 %** | **0.343** | **0.154** |
| 2 | DeBERTa-v3-base | 184M | CORAL (full) | 0.486 [0.468, 0.503] | +0.024 [+0.009, +0.039] | 1.283 | 64.5 % | 34.3 % | 0.213 | 0.302 |
| 3 | bge-m3 | 568M | CORAL (LoRA) | 0.474 [0.455, 0.492] | +0.012 [−0.003, +0.028] | 1.312 | 63.4 % | 33.6 % | 0.207 | 0.319 |
| 4 | Qwen3-Embedding-0.6B | 596M | CORAL (LoRA) | 0.470 [0.450, 0.489] | +0.008 [−0.007, +0.024] | 1.268 | 64.6 % | 33.9 % | 0.221 | 0.308 |
| — | *TF-IDF + ridge (baseline)* | 50k feats | ridge | *0.461* [0.444, 0.479] | — | 1.084 | ***72.5 %*** | 27.4 % | 0.244 | — |
| 5 | ModernBERT-base | 149M | CORAL (full) | 0.457 [0.438, 0.476] | −0.004 [−0.020, +0.012] | 1.323 | 63.1 % | 33.4 % | 0.206 | 0.309 |
| 6 | MiniLM-L6 | 23M | CORAL (full) | 0.453 [0.434, 0.472] | −0.009 [−0.024, +0.006] | 1.341 | 63.3 % | 32.8 % | 0.205 | 0.309 |
| — | *Median per project (baseline)* | 39 | — | *0.242* [0.226, 0.257] | −0.220 | 1.217 | 64.2 % | 25.8 % | 0.170 | — |
| 7 | e5-large-instruct | 560M | CORAL (LoRA) | **0.000** (collapsed) | −0.461 | 1.764 | 51.3 % | 27.6 % | 0.062 | 0.307 |

Paired comparisons with the winner (Qwen3-0.6B minus model, 95 % CI): vs DeBERTa **+0.047** [+0.033, +0.060] · vs
bge-m3 **+0.059** [+0.043, +0.073] · vs Qwen3-Embedding **+0.063** [+0.049, +0.077] · vs ModernBERT **+0.075**
[+0.060, +0.091] · vs MiniLM **+0.080** [+0.065, +0.094]. All intervals exclude zero by a wide margin.

Not evaluated: NeoBERT (import), EmbeddingGemma (gated).

### 3.2 What the numbers say

1. **Qwen3-0.6B is the only model with a clear, practically meaningful lead** — +0.071 QWK over TF-IDF, and better than every other model on QWK, mean error, exact accuracy, macro-F1 and calibration. TF-IDF + ridge still has slightly more estimates within ±1 bucket (72.5 % vs 69.9 %).
2. **Among the CORAL models, only DeBERTa-v3-base beats TF-IDF significantly** (+0.024); bge-m3, Qwen3-Embedding, ModernBERT and MiniLM are statistically tied with the bag-of-words baseline.
3. **The CORAL models polarise; Qwen3-0.6B does not.** Every CORAL model predicts bucket "1" for 5,260–5,570 issues (true: 2,407) and "21" for 590–870 (true: 247), and barely uses the middle buckets (DeBERTa predicts "2" 171 times vs 2,056 true). Qwen3-0.6B predicts 2,191 / 1,559 / 1,030 / 3,053 / 569 / 35 / 270 for buckets 1…21 against true 2,407 / 2,056 / 1,309 / 1,760 / 714 / 214 / 247 — a realistic spread, with "5" over-used and "13" under-used. Confusion matrices: Appendix C.
4. **Only Qwen3-0.6B's probabilities are usable as confidence** (ECE 0.154 vs ≈ 0.30 for the CORAL models). A "53 % confident" suggestion from the CORAL models would not mean 53 %.
5. **e5-large-instruct collapsed**: it predicted "1" for every issue in both epochs (val QWK exactly 0.0), so early stopping ended it after epoch 2. This is a head-initialisation effect, not a verdict on the model (§8.1).
6. **Training curves:** Qwen3-0.6B peaked at epoch 3 (val 0.5815) with epoch 4 equal; bge-m3 and MiniLM were still improving at epoch 4 (budget-limited); DeBERTa, ModernBERT and Qwen3-Embedding peaked at epoch 3.

---

## 4. Task B — assignee ranking: results

Score each (task, member-profile) pair and rank all 48 members. Primary metric nDCG@10 with gain = Plausibility.
Headline metrics use the 2,000 classified test tasks.

### 4.1 Leaderboard (test)

| # | Model | Params | Recipe | nDCG@10 [95 % CI] | Δ vs best [95 % CI] | nDCG@5 | Recall@5 | Recall@10 | Hit@1 | MRR | Held-out members |
|---:|---|---:|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | **Qwen3-Embedding-0.6B** | 596M | bi-encoder (LoRA) | **0.836** [0.826, 0.846] | — | **0.785** | **0.729** | **0.908** | **0.315** | **0.520** | **0.828** |
| 2 | Qwen3-Reranker-0.6B | 596M | cross-encoder yes/no (LoRA) | 0.825 [0.815, 0.836] | −0.011 [−0.018, −0.003] | 0.766 | 0.709 | 0.902 | 0.283 | 0.491 | 0.813 |
| 3 | Qwen3-0.6B | 596M | generative yes/no (LoRA) | 0.823 [0.813, 0.834] | −0.012 [−0.020, −0.005] | 0.765 | 0.709 | 0.903 | 0.288 | 0.498 | 0.819 |
| 4 | e5-large-instruct | 560M | bi-encoder (LoRA) | 0.821 [0.811, 0.833] | −0.014 [−0.022, −0.006] | 0.767 | 0.709 | 0.901 | 0.304 | 0.501 | 0.815 |
| 5 | bge-m3 | 568M | bi-encoder (LoRA) | 0.805 [0.794, 0.816] | −0.031 [−0.040, −0.023] | 0.746 | 0.689 | 0.885 | 0.278 | 0.479 | 0.803 |
| 6 | MiniLM-L6 | 23M | bi-encoder (full) | 0.771 [0.759, 0.784] | −0.065 [−0.075, −0.055] | 0.710 | 0.658 | 0.858 | 0.253 | 0.446 | 0.771 |
| 7 | DeBERTa-v3-base | 184M | cross-encoder (full) | 0.766 [0.755, 0.779] | −0.069 [−0.079, −0.059] | 0.703 | 0.644 | 0.846 | 0.243 | 0.444 | 0.766 |
| 8 | ModernBERT-base | 149M | cross-encoder (full) | 0.698 [0.685, 0.712] | −0.138 [−0.149, −0.127] | 0.621 | 0.569 | 0.794 | 0.214 | 0.398 | 0.699 |
| — | *Popularity* | — | baseline | *0.288* | | 0.220 | 0.174 | 0.348 | 0.058 | 0.196 | 0.340 |
| — | *TF-IDF cosine* | — | baseline | *0.232* | | 0.164 | 0.171 | 0.321 | 0.019 | 0.120 | 0.265 |
| — | *Random* | — | baseline | *0.152* | | 0.108 | 0.108 | 0.210 | 0.024 | 0.093 | 0.157 |

### 4.2 What the numbers say

1. **Qwen3-Embedding-0.6B wins outright.** It is significantly better than every other model (every CI of its lead excludes zero) and best on every ranking metric.
2. **Fine-tuned models are far ahead of every baseline** (+0.41 to +0.55 nDCG@10 over the best baseline). Fine-tuning roughly tripled the embedders' zero-shot quality (Qwen3-Embedding 0.275 → 0.826 val, e5 0.291 → 0.799, bge-m3 0.239 → 0.799). Qwen3-Reranker starts strongest zero-shot (0.421) but ends below Qwen3-Embedding.
3. **The shortlist quality is good, the single best pick is hard:** the right people are in the top 10 ~91 % of the time and in the top 5 ~73 %, but the model's top pick is the scorer's single best-routed member only ~31 % of the time (Hit@1).
4. **Cold start is solved at this budget:** for the 1,452 test tasks where a held-out member is relevant, nDCG@10 matches the overall figure for every model.
5. **Bi-encoders beat cross-encoders and LLM scorers** — the best bi-encoder beats both pointwise Qwen3 scorers while being 12–15× faster (§6).
6. **Seniority fit:** the top pick is *over*-qualified for 29.6 % of tasks with Qwen3-Embedding, 22.7 % with e5, and 34.6 % with the Reranker and Qwen3-0.6B (under-qualified: 9–12 % for all). The backend's capacity/level rules (system design) are the place to correct for this.

---

## 5. Deeper analysis

### 5.1 Task A is mostly "which project", not "which issue"

Story points are project-relative. The median-per-project baseline alone reaches QWK 0.242. Across the 16 test
projects with ≥ 100 issues, the median **within-project** QWK is 0.218 (DeBERTa), 0.224 (TF-IDF), 0.250
(Qwen3-Embedding), 0.139 (bge-m3) — and **0.336 for Qwen3-0.6B**, the only model that clearly improves the
within-project ranking. Some large projects remain hard for every model (MDL, INDY, APSTUD, STL, TIDOC: QWK ≈ 0.1–0.2
even for Qwen3-0.6B); DM (n = 2,890) works well (0.55–0.62). Per-project table: Appendix B.

### 5.2 Issue type and edited text (Task A)

| Slice | Qwen3-0.6B | DeBERTa-v3 | TF-IDF |
|---|---:|---:|---:|
| Improvement | 0.521 | 0.511 | 0.438 |
| Bug | 0.461 | 0.371 | 0.389 |
| Task | 0.456 | 0.427 | 0.349 |
| Story | 0.428 | 0.431 | 0.335 |
| other | 0.408 | 0.318 | 0.359 |
| Epic | 0.270 | 0.000 | 0.262 |
| New Feature | 0.220 | 0.134 | 0.053 |
| text **unchanged** after estimation | 0.540 | 0.492 | 0.464 |
| text **changed** after estimation (n = 1,388) | 0.488 | 0.453 | 0.446 |

Issues whose title/description were edited after estimation score ~0.04–0.05 lower for every model (the model sees
the final text; the estimate was made on the original). Epics and New Features remain the weakest types.

### 5.3 Task B by work area and required level (nDCG@10)

| Slice | n tasks | Qwen3-Embedding | Qwen3-Reranker | Qwen3-0.6B | e5-large | Popularity |
|---|---:|---:|---:|---:|---:|---:|
| Frontend | 560 | 0.880 | **0.889** | 0.885 | 0.888 | 0.580 |
| Security | 156 | 0.884 | 0.883 | 0.876 | **0.902** | 0.065 |
| QA/Testing | 154 | 0.850 | **0.856** | 0.843 | 0.821 | 0.197 |
| Documentation | 124 | **0.844** | 0.831 | 0.839 | 0.731 | 0.215 |
| Database | 277 | **0.830** | 0.797 | 0.805 | 0.809 | 0.232 |
| API/Integration | 254 | **0.829** | 0.816 | 0.801 | 0.808 | 0.203 |
| Infrastructure | 121 | **0.797** | 0.766 | 0.772 | 0.775 | 0.108 |
| DevOps | 216 | **0.769** | 0.737 | 0.749 | 0.749 | 0.124 |
| Backend | 138 | 0.740 | 0.721 | 0.718 | **0.744** | 0.208 |
| *Unclassified* | 500 | 0.154 | **0.274** | 0.200 | 0.233 | 0.179 |
| Required: Intern | 11 | **0.400** | 0.371 | 0.237 | 0.341 | 0.010 |
| Required: Junior | 254 | 0.518 | 0.538 | 0.523 | **0.545** | 0.134 |
| Required: Mid-level | 1,745 | 0.753 | **0.776** | 0.758 | 0.773 | 0.327 |
| Required: Senior | 427 | **0.618** | 0.617 | 0.610 | 0.569 | 0.143 |
| Required: Staff | 50 | **0.532** | 0.448 | 0.458 | 0.417 | 0.010 |
| Required: Principal | 13 | **0.648** | 0.515 | 0.439 | 0.307 | 0.000 |

- Qwen3-Embedding leads most work areas and the senior/staff/principal levels; the Reranker and e5 are slightly better on mid-level and junior tasks.
- **Rare required levels are weak for everyone** (Intern, Staff, Principal have 11–50 test tasks and few training examples at this budget) — expected, and a reason to re-check at the full budget.
- **Unclassified tasks (weak labels) score 0.15–0.38** for every model; Qwen3-Embedding is the weakest leader here (0.154) and DeBERTa's cross-encoder the best (0.384). This slice is not in the headline metric by design.

### 5.4 Overfitting check

Validation and test agree closely for every Task B model (e.g. Qwen3-Embedding 0.826 val → 0.836 test, Reranker
0.820 → 0.825); test is slightly *higher*, so there is no sign of overfitting to the validation split. For Task A,
test QWK is 0.04–0.05 below validation for every model (0.02 for TF-IDF): partly the expected optimism of picking the
best epoch on validation, partly split difficulty — consistent across models, so the ranking is unaffected.

### 5.5 Data-quality finding: `mae_raw_points` is invalid

`mae_raw_points` is ≈ 3,070 for **every** model and baseline. The cause is one test issue (project DATACASS) whose
recorded story point is **26,710,114**; nine more DM issues are between 111 and 144. Excluding the 10 values above
100, DeBERTa's raw-point MAE is **3.2 points** (median absolute error 1.0). **Ignore `mae_raw_points` as reported**;
a robust version (median error, or clipping raw points to 100) should replace it in a future run.

---

## 6. Cost and efficiency

Training times are wall-clock on the laptop and include RAM-starvation, indexing and throttling episodes (§2.3) —
use them as rough cost, not as a speed ranking. Latency = median over 200 test items at batch size 1 on the RTX 4050,
including tokenisation; for Task B an item is one task scored against all 48 members (bi-encoders reuse
pre-computed member embeddings).

| Model | Task | Params | Trainable | Method | Micro-batch | Train time | Peak GPU | Latency bs1 | Throughput (batched) |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|
| MiniLM-L6 | A | 23M | 22.7M | full | 8 | 0.1 h | 0.5 GB | **9.9 ms** | 692 / s |
| ModernBERT-base | A | 149M | 149M | full | 8 | 0.4 h | 3.0 GB | 36.8 ms | 113 / s |
| DeBERTa-v3-base | A | 184M | 184M | full | 4 (OOM retry) | 1.8 h | 4.1 GB | 111 ms | 85 / s |
| e5-large-instruct | A | 560M | 7.1M | LoRA | 4 | 1.6 h | 2.0 GB | 213 ms | 33 / s |
| bge-m3 | A | 568M | 7.1M | LoRA | 4 | 3.1 h | 2.0 GB | 213 ms | 25 / s |
| Qwen3-Embedding-0.6B | A | 596M | 10.1M | LoRA | 2 (OOM retry) | 7.0 h* | 3.2 GB | 159 ms | 26 / s |
| **Qwen3-0.6B** | A | 596M | 10.1M | LoRA | 4 | 3.2 h | 2.4 GB | 114 ms | 6.2 / s |
| MiniLM-L6 | B | 23M | 22.7M | full | 8 | 0.15 h | 0.6 GB | **9.9 ms** | 581 tasks / s |
| ModernBERT-base | B | 149M | 149M | full | 8 | 1.0 h | 3.0 GB | 166 ms | 4.2 tasks / s |
| DeBERTa-v3-base | B | 184M | 184M | full | 4 (OOM retry) | 7.4 h | 4.1 GB | 362 ms | 2.1 tasks / s |
| e5-large-instruct | B | 560M | 7.1M | LoRA | 4 | 5.4 h | 2.0 GB | 214 ms | 27 tasks / s |
| bge-m3 | B | 568M | 7.1M | LoRA | 4 | 2.2 h | 2.0 GB | 83 ms | 29 tasks / s |
| **Qwen3-Embedding-0.6B** | B | 596M | 10.1M | LoRA | 4 | 5.3 h* | 3.8 GB | **100 ms** | 16.6 tasks / s |
| Qwen3-Reranker-0.6B | B | 596M | 10.1M | LoRA | 4 | 4.5 h | 3.4 GB | 1,459 ms | 0.5 tasks / s |
| Qwen3-0.6B | B | 596M | 10.1M | LoRA | 4 | 5.4 h | 3.4 GB | 1,250 ms | 0.6 tasks / s |

\* trained across interruptions (resumed from checkpoints) and partly under RAM starvation.

Notes:
- **Qwen3-0.6B (Task A) scores all 7 candidate answers** for every estimate, so each suggestion costs 7 sequence evaluations; 114 ms per issue on the laptop GPU is still interactive.
- e5-large-instruct and bge-m3 share the XLM-RoBERTa-large architecture; their Task B latencies (214 vs 83 ms) differ mainly because of machine load during measurement.
- The Reranker's and Qwen3-0.6B's Task B latency is structural: one LLM forward pass per (task, member) pair, so cost grows linearly with team size. A bi-encoder embeds each member once and scores a task with one encoder pass plus 48 dot products.
- `SUMMARY.md`'s "efficiency-adjusted pick" (smallest pretrained model within 0.01 of the best): **Task A → Qwen3-0.6B** and **Task B → Qwen3-Embedding-0.6B** (no other model within 0.01 in either task).

---

## 7. Recommendations

### 7.1 Task A — story points

1. **Use Qwen3-0.6B (generative, LoRA) for story-point suggestions.** It is the only model clearly better than the TF-IDF + ridge baseline (+0.071 QWK), it has the best mean error, exact accuracy and macro-F1, and its probabilities are the best calibrated (ECE 0.154), so a displayed confidence is meaningful. Cost: a 596M model, ~114 ms per estimate on the benchmark GPU.
2. **Keep TF-IDF + ridge as the fallback** (AI service unavailable, or a project too new for good estimates) — it remains strong on ±1-bucket accuracy (72.5 %).
3. **Before production:** confirm at the full data budget (`README.md` defaults) and produce weights with `--keep-weights` (§9.3).
4. **Optional follow-up:** the CORAL head start (§8.1). Qwen3-0.6B's win is consistent with the head being the bottleneck for the other models; in the pre-flight, MiniLM at the same budget scored QWK **0.503** with thresholds initialised at the training-label log-odds vs **0.452** with zero start. A controlled re-run of the CORAL models with that change would show whether a smaller encoder can come close to Qwen3-0.6B at lower cost. This run kept the specified zero start (team decision).

### 7.2 Task B — assignee ranking

1. **Use Qwen3-Embedding-0.6B (bi-encoder, LoRA, Apache-2.0).** Best on every ranking metric with a significant margin, held-out members ranked as well as known ones, and ~100 ms per task because member embeddings are computed once.
2. **Budget choice:** **MiniLM-L6** (−0.065 nDCG@10, 23M parameters, ~10 ms per task, Apache-2.0) if latency or hardware dominates. e5-large-instruct (−0.014, MIT) is a strong non-Qwen alternative.
3. **Do not use the pointwise LLM scorers** (Qwen3-Reranker, Qwen3-0.6B yes/no) for full-team ranking: they are slightly *less* accurate here and 12–15× slower. A reranker could still re-score a short list (e.g. top 10) if a later run shows it helps.
4. **Confirm at the full data budget** before production: this run is a reduced-budget screening, single seed.

---

## 8. Caveats and threats to validity

### 8.1 CORAL threshold initialisation (Task A)
The CORAL head starts all six thresholds at 0 and learns them at LR 1e-3. Within 4 epochs this leaves predictions
polarised (§3.2) and hit embedders with L2-normalised outputs hardest (e5 collapsed). The specification was kept
deliberately. The generative model avoids the head entirely and does not polarise, so part of its lead over the CORAL
models is likely the head rather than text understanding alone; the ranking among the CORAL models is likewise partly
a ranking of how well each copes with the head.

### 8.2 Other caveats
- **Reduced budget (scenario B), single seed, no hyperparameter search.** Differences smaller than the CIs above are noise. Larger models may be handicapped more by the small budget.
- **Synthetic team and labels (Task B).** Plausibility comes from a scoring function, not observed outcomes; the models learn to reproduce that scorer from profile text.
- **OOM retries changed micro-batches:** DeBERTa (A, B) ran at 4, Qwen3-Embedding A at 2. The effective batch stayed 32. For Task A this is neutral; none of the completed bi-encoders needed a retry.
- **Resumed units:** Qwen3-Embedding A and B were trained across interruptions. Resume restores weights, optimizer, scheduler, data order and RNG (bit-identical on CPU in tests); on the GPU, memory-efficient attention is not bit-deterministic, so a resumed run can differ from an uninterrupted one by GPU floating-point noise.
- **Latency and training times were measured on a shared, RAM-constrained laptop** and vary up to ~2× with machine load.
- **Final text, not estimation-time text** (Task A): edited issues score ~0.04–0.05 lower.
- **`mae_raw_points` is invalid** (§5.5).
- **Rare slices are small** (e.g. 11 Intern / 13 Principal test tasks): treat their numbers as indicative only.
- **Unclassified tasks** are excluded from headline Task B metrics by design and are much harder for all models.

---

## 9. Units without results, weights, and next runs

### 9.1 Units without results

| Unit | Status | What is needed |
|---|---|---|
| NeoBERT, A and B | `failed (ImportError)` — model code needs `xformers` | Install a matching `xformers` build; even then a full fine-tune likely exceeds 6 GB VRAM (no gradient-checkpointing support) |
| EmbeddingGemma-300m, A and B | `skipped (gated_access_denied)` | Accept the Gemma license on Hugging Face with the account whose token is used; then `--force embeddinggemma_300m` |
| Harrier-0.6B, BitNet-Embedding-0.6B | `skipped (repo_id_unverified)` | Fill in verified `hf_repo_id`s in the config |

The three units that failed on network errors in the first pass (Qwen3-Embedding B, Qwen3-Reranker B, Qwen3-0.6B A)
were completed by the 2026-10-13 retry; their earlier failed reports are kept in `runs/archive/`.

### 9.2 Why there are no weights
`README.md` §8 requires every unit to **erase** its downloaded model and fine-tuned weights after reporting; the
reports, predictions and logs are the kept artifacts.

### 9.3 How to get deployable weights for the chosen models
Re-train only those models with the same configuration and `--keep-weights` (or, better, at the full data budget):

```powershell
python run_model_selection.py --config <your config> --only qwen3_embedding_0_6b --task task_assignment --force qwen3_embedding_0_6b --keep-weights
python run_model_selection.py --config <your config> --only qwen3_0_6b --task story_point --force qwen3_0_6b --keep-weights
```

The trained parameters are then in `.work/<run_id>/best.pt` (LoRA adapters + head on top of the pinned base
revision). Model weights do not belong in this git repository (size limits: GitHub rejects files > 100 MB); publish
them to a model registry or Hugging Face instead.

---

## 10. Engineering changes made during this run

The benchmark code had never been executed before this run (`IMPLEMENTATION.md` §1). A pre-flight smoke test on this
laptop found and fixed the following; none of them changes any run ID or any training/evaluation logic:

| Change | File(s) | Why |
|---|---|---|
| Serial model downloads (`max_workers=1`) | `oa2/registry.py` | `huggingface_hub`'s per-folder symlink probe races between download threads on Windows without symlink rights → random `WinError 1314` download failures. |
| Break the SentenceTransformer ↔ model-card reference cycle at load | `oa2/models.py` | Every sentence-transformers model stayed on the GPU after its unit; later units ran out of memory (bge-m3 failed this way in the pre-flight). Verified: 64 MB left after each unit, for all 20 completed units. |
| Leak guard: log GPU memory left after each unit, warn above 256 MB | `oa2/cleanup.py` | Early warning for any future leak. |
| **Mid-unit resume** (checkpoint every 15 min + each epoch boundary; atomic writes; cached zero-shot metrics; failed-by-network units keep their checkpoint for `--retry-failed`) | `oa2/training.py`, `run_model_selection.py`, `oa2/recipes/*.py`, `oa2/report.py`, `oa2/cleanup.py` | Power cuts and interruptions. Verified bit-identical to uninterrupted training (CPU tests) and used three times in this run. Documented in `IMPLEMENTATION.md` §17.9. |
| Peak GPU memory reset per unit | `run_model_selection.py` | A unit failing before training no longer reports the previous unit's peak. |

Known remaining issues (not fixed): `mae_raw_points` outlier sensitivity (§5.5); the log line `Test qwk nan` is
printed when QWK is exactly 0 (cosmetic, JSON is correct); the stop message still says "restart cleanly" although
the unit now resumes.

---

## 11. Reproducibility

- Code: branch `ai/OA2`, base commit `2fd617f` plus the changes in §10.
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
| A | Qwen3-0.6B | `story_point__qwen3_0_6b__generative_sft__f0336cc3` | completed (retry) |
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
| B | Qwen3-Embedding-0.6B | `task_assignment__qwen3_embedding_0_6b__bi_encoder__8b22f441` | completed (retry, resumed) |
| B | Qwen3-Reranker-0.6B | `task_assignment__qwen3_reranker_0_6b__reranker_yes_no__5194cd33` | completed (retry) |
| B | Qwen3-0.6B | `task_assignment__qwen3_0_6b__generative_yes_no__29e6cf50` | completed |
| B | Harrier-0.6B | `task_assignment__harrier_0_6b__bi_encoder__eade0929` | skipped |
| B | BitNet-Embedding-0.6B | `task_assignment__bitnet_embedding_0_6b__bi_encoder__28ff8107` | skipped |

### Appendix B — Task A QWK per project (test projects with ≥ 100 issues)

| Project | Test issues | Qwen3-0.6B | DeBERTa-v3 | TF-IDF + ridge | bge-m3 | Qwen3-Embedding |
|---|---:|---:|---:|---:|---:|---:|
| DM | 2,890 | 0.621 | 0.605 | 0.553 | 0.606 | 0.606 |
| EVG | 752 | 0.385 | 0.087 | 0.210 | 0.012 | 0.072 |
| MULE | 553 | 0.342 | 0.462 | 0.280 | 0.350 | 0.402 |
| XD | 492 | 0.330 | 0.437 | 0.361 | 0.394 | 0.368 |
| MESOS | 486 | 0.484 | 0.370 | 0.452 | 0.377 | 0.344 |
| DNN | 383 | 0.396 | 0.219 | 0.237 | 0.154 | 0.280 |
| TISTUD | 372 | 0.295 | 0.231 | 0.092 | 0.210 | 0.229 |
| TIMOB | 270 | 0.445 | 0.427 | 0.258 | 0.515 | 0.509 |
| NEXUS | 269 | 0.248 | 0.012 | 0.176 | 0.000 | −0.001 |
| MDL | 223 | 0.125 | 0.060 | 0.056 | 0.058 | 0.115 |
| TIDOC | 181 | 0.183 | 0.075 | 0.027 | 0.063 | 0.068 |
| STL | 142 | 0.193 | 0.001 | 0.080 | 0.022 | 0.095 |
| APSTUD | 125 | 0.156 | 0.165 | 0.194 | 0.056 | 0.161 |
| SERVER | 110 | 0.367 | 0.216 | 0.337 | 0.088 | 0.239 |
| INDY | 102 | 0.144 | 0.047 | 0.073 | 0.123 | 0.262 |
| IS | 102 | 0.468 | 0.461 | 0.323 | 0.363 | 0.394 |
| **median** | | **0.336** | 0.218 | 0.224 | 0.139 | 0.250 |

The test split covers 39 projects; the other 23 have fewer than 100 test issues (per-project numbers for all of them
are in each run's `metrics.slices`).

### Appendix C — Task A confusion matrices (test; rows = true bucket, columns = predicted)

Qwen3-0.6B (generative):

| true \ pred | 1 | 2 | 3 | 5 | 8 | 13 | 21 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **1** (2,407) | **1,157** | 480 | 229 | 477 | 48 | 0 | 16 |
| **2** (2,056) | 603 | **548** | 227 | 629 | 45 | 0 | 4 |
| **3** (1,309) | 208 | 185 | **287** | 550 | 60 | 1 | 18 |
| **5** (1,760) | 166 | 280 | 194 | **931** | 160 | 5 | 24 |
| **8** (714) | 47 | 56 | 85 | 337 | **147** | 13 | 29 |
| **13** (214) | 6 | 8 | 8 | 96 | 69 | **12** | 15 |
| **21** (247) | 4 | 2 | 0 | 33 | 40 | 4 | **164** |

DeBERTa-v3-base (CORAL):

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

The CORAL model pushes small issues to "1" and recognises the very largest (82 % recall on "21"); TF-IDF regresses
towards the middle buckets; Qwen3-0.6B uses the whole scale, gets the most issues exactly right (37 %), and still
recognises the largest issues (66 % recall on "21"), with "5" as its most over-used answer.
