# Using the assignee model in production

This document explains how OptiTask uses the model that OA3 exports: what goes in, what comes out, how the AI
service and the backend should be wired, and how to roll it out and monitor it. It is written for whoever builds
that integration, human or AI. How the model is trained is in [DESIGN.md](DESIGN.md); how to run training is in
[README.md](README.md).

> **Status:** this is the integration *design*. The model loader (`oa3/inference.py`) exists and is tested. The AI
> service endpoint, the backend wiring and the data-model changes in §4 are **not built yet**.

---

## 1. What the model is (and is not)

- **It is a text → vector function.** You give it one text and get back 1,024 numbers. It is not a chatbot: it does
  not answer questions, generate text, or follow instructions you write. You cannot ask it to "rank these people";
  **your code ranks**, by comparing vectors.
- **It is used twice per decision:** once for the task text and once for each candidate profile. The two are never
  given to the model together.
- **The score is cosine similarity** between the task vector and a member vector, between −1 and 1. Higher means a
  better fit. Scores are only meaningful **for ordering members for the same task**. They are not probabilities,
  they cannot be compared across tasks, and they change completely with a new model version.
- **It was fine-tuned from Qwen3-Embedding-0.6B**, an LLM-based embedding model, on about 195,000 examples from the
  TAWOS dataset. The examples have the form "for this task, this member is suitable and these are not". Training
  pulled the vectors of suitable pairs together and pushed unsuitable pairs apart.

```
task fields ─► task_text() ─► "Instruct: …\nQuery:" + text ─► model ─► task vector ──┐
                                                                                     ├─► cosine ─► sort ─► top k
member fields ─► profile_text() ─────────────────────────────► model ─► member vector┘
```

## 2. The loader: `inference.py`

Every exported model folder contains `inference.py` (a copy of `oa3/inference.py`) and `inference_config.json`.
The AI service should use them **as they are**. They build the exact strings the model was trained on.

```python
from inference import AssigneeRanker, TaskInput, MemberProfile

ranker = AssigneeRanker.load("models/assignee__qwen3_embedding_0_6b__<hash>")    # once at startup

members = [
    MemberProfile(member_id="u-17", level="Senior", area="Backend", years_experience=8,
                  role="Senior Developer", role_class="ic"),
    MemberProfile(member_id="u-23", level="Mid-level", area="DevOps", years_experience=4,
                  role="DevOps Engineer", role_class="ic"),
    # ...
]
member_vecs = ranker.embed_members(members)                  # [M, 1024]; cache it (see §5.3)

task = TaskInput(project_key="PAY", issue_type="Bug", components=["api", "billing"],
                 title="Refund webhook returns 500",
                 description="When Stripe sends a refund event with a partial amount, the handler crashes ...")
top = ranker.rank(task, member_vecs, [m.member_id for m in members], k=5)
# [RankedMember(member_id='u-17', score=0.71), RankedMember(member_id='u-23', score=0.58), ...]
```

| Method | Use |
|---|---|
| `AssigneeRanker.load(path, device=None, dtype=None)` | GPU if available; bf16 on GPU, fp32 on CPU by default |
| `embed_members(members)` / `embed_tasks(tasks)` | L2-normalised float32 vectors |
| `rank(task, member_vecs, member_ids, k, task_vec=None)` | best first; pass `task_vec` to reuse a stored task vector |
| `scores(task_vecs, member_vecs)` | the raw [T, M] cosine matrix (for batch jobs) |
| `task_text(task)`, `profile_text(member)` | the exact strings sent to the model (useful for logging/debugging) |

## 3. The input contract

These strings are **fixed by training**. Production must produce them byte for byte, and `inference.py` does that
for you. Never build them by hand, change the instruction, or add fields. Any of those is a silent quality loss,
and the only safe way to change the format is to retrain (DESIGN.md §3).

**Task** → `[Project: PAY] [Type: Bug] [Components: api, billing]\nRefund webhook returns 500\nWhen Stripe sends …`

with this instruction in front of it (added by the loader):
`Instruct: Given a software task description, retrieve team member profiles suited to do the task\nQuery:`

**Member** → `Level: Senior. Area: Backend. Years of experience: 8. Role: Senior Developer (ic).` (no prefix)

Text is cleaned (whitespace collapsed, wrapping quotes removed), the description is cut at 8,000 characters, and the
model reads at most 512 tokens (about 350–400 words). Put the most informative text in the title and the first
paragraph of the description.

## 4. Mapping OptiTask data to the model's inputs

The model was trained on TAWOS fields. OptiTask's Prisma schema (`apps/backend/prisma/schema.prisma`) stores
similar information, but not the same fields. **This mapping has to be decided before integration.** The table
below is the recommendation.

### 4.1 Task

| Model field | TAWOS meaning | OptiTask source | Recommendation |
|---|---|---|---|
| `title` | issue title | `Task.title` | direct |
| `description` | issue description | `Task.description` | direct (`""` if null) |
| `project_key` | short project key, e.g. `MESOS` | `Project.name` (no key field) | Use a short, stable key derived from the project name (e.g. upper-case initials). It helps little for unseen projects; do not leave it empty |
| `issue_type` | Jira type; most common: `Bug`, `Suggestion`, `Improvement`, `Story`, `Task`, `Sub-task`, `New Feature`, `Epic` | **missing** | **Add a `type` to `Task`** with Jira-like values. Until then send `"Task"`. Type carries real signal (bugs vs stories need different people) |
| `components` | Jira components, e.g. `agent, containerizer` | `Label.name` via `TaskLabel` | Use the task's label names as components. If there are none, the loader writes `none` |

### 4.2 Member

| Model field | Training vocabulary (TAWOS `User.csv`) | OptiTask source | Recommendation |
|---|---|---|---|
| `level` | `Junior`, `Mid-level`, `Senior`, `Staff`, `Principal` | `User.seniority` (`JUNIOR`, `MID`, `SENIOR`, `LEAD`, `PRINCIPAL`) | Map: JUNIOR→`Junior`, MID→`Mid-level`, SENIOR→`Senior`, LEAD→`Staff`, PRINCIPAL→`Principal` |
| `area` | one of 9: `Frontend`, `Backend`, `Database`, `API/Integration`, `DevOps`, `Infrastructure`, `QA/Testing`, `Security`, `Documentation` | `UserExpertise.tag` (free text + `confidenceScore`) | **Restrict or map expertise tags to these 9 values**, and use the member's highest-confidence area. A value outside the 9 was never seen in training |
| `years_experience` | integer, 1–14 | **missing** | **Add to the user profile.** Until then, estimate from seniority with the training medians (Junior 2, Mid-level 4, Senior 8, Staff 11, Principal 14) and log that it is estimated |
| `role` | job title, e.g. `Senior Developer`, `DevOps Engineer`, `QA Engineer`, `Technical Writer`, `Tech Lead` (23 titles) | **missing** (`TeamMember.role` is only LEAD/MEMBER) | **Add a job title.** Until then derive `"<Level> <Area> Engineer"`-style titles |
| `role_class` | `ic`, `lead`, `qa`, `writer`, `architect` | `TeamMember.role` (LEAD → `lead`) + area | LEAD→`lead`; QA/Testing area→`qa`; Documentation area→`writer`; otherwise `ic` |

`UserSkill` (free-text skills) is **not** used: the training data had no skills field. Adding skills to the profile
text would require retraining with skills in the training profiles.

Put this mapping in **one function in the backend** (or the AI service) and unit-test it. It is the most likely
place for quality to leak.

## 5. Service design

### 5.1 Components

```
Frontend ──GraphQL──► Backend (Node, Apollo, Prisma) ──HTTP/JSON──► AI service (Python) ──► model (GPU or CPU)
                           │                                              ▲
                           └── ai_recommendations table ◄─────────────────┘ (ranking stored by the backend)
```

- **AI service** (Python, e.g. FastAPI): loads the model once at startup and exposes one ranking endpoint. It owns
  no product data.
- **Backend:** gathers the task and the candidate members, maps them (§4), calls the AI service, applies business
  rules (§6), and stores the suggestion as an `AiRecommendation`.

### 5.2 Endpoint

`POST /v1/assignee/rank`

```json
{
  "task": {"project_key": "PAY", "issue_type": "Bug", "components": ["api", "billing"],
           "title": "Refund webhook returns 500", "description": "When Stripe sends ..."},
  "candidates": [
    {"member_id": "u-17", "level": "Senior", "area": "Backend", "years_experience": 8,
     "role": "Senior Developer", "role_class": "ic"}
  ],
  "k": 10
}
```
Response:
```json
{"model_name": "assignee__qwen3_embedding_0_6b__<hash>",
 "ranking": [{"member_id": "u-17", "score": 0.7134}, {"member_id": "u-23", "score": 0.5821}]}
```
Also expose `GET /v1/health` with `model_name`, device and dtype, so the backend can log which model answered.

### 5.3 Member vectors: compute or cache?

A team's profiles are short (about 25 tokens), and a batch of 50 embeds in a few tens of milliseconds on a GPU.
Recommendation: **keep the service stateless** and send the candidates with every request. Inside the service,
cache member vectors in memory, keyed by `(model_name, profile_text)`. A profile change then produces a new key
automatically, and nothing needs invalidating. Persist vectors in the database (e.g. pgvector) only if candidate
lists grow into the hundreds or thousands per request.

**Never mix vectors from two model versions.** Vectors from different models live in unrelated spaces.

### 5.4 Performance

| Setting | Expected cost per task (one task vs ~50 members) |
|---|---|
| GPU (RTX 4050 class), bf16 | ~100 ms at batch 1; ~60 ms per task when batching 8 tasks (OA2 measurement) |
| CPU, fp32 | to be measured: the OA3 run's `verification.latency` reports it on the machine that runs it |
| Memory | ~1.2 GB weights in bf16 (GPU), ~2.4 GB in fp32 (CPU), plus activations |

The ranking itself (a dot product per member) is negligible next to the one model pass for the task. If CPU-only
serving is too slow, options are ONNX export or int8 quantisation. Both are untested here, and each must be verified
the same way OA3 verifies its export (re-score the test set, compare nDCG@10).

## 6. Business rules: the model ranks, the backend decides

The model only knows text. It does not know who is on holiday, who is overloaded, or company policy. Apply these
**after** the ranking, in the backend:

1. **Candidates:** members of the task's project (`ProjectMember`). Exclude `VIEWER`s and members whose
   `TeamMember.availability` is `AWAY` or `OFFLINE`.
2. **Capacity:** demote or filter members whose `TeamMember.workload` is over a threshold.
3. **Seniority fit:** the top pick was *over*-qualified for 29.6 % of test tasks in OA2. If the task has a known
   required level, prefer the best-ranked member at or near that level.
4. **Show the top 3–5 with their order, not the raw scores.** Raw scores are not probabilities and should not
   be shown as "71 % match".

The result is a **suggestion**, never an automatic assignment. A person approves it (§7).

## 7. Product flow

1. A user clicks "Suggest assignee" on a task (or the backend triggers it when a task is created in a sprint).
2. The backend collects the task and candidates, maps them (§4), and calls `/v1/assignee/rank`.
3. The backend applies the rules (§6) and stores an `AiRecommendation`:
   - `type: TASK_ASSIGNMENT`, `taskId`, `projectId`, `provider: "<model_name>"`, `approvalStatus: PENDING`;
   - `text`: a short human-readable line, e.g. "Suggested: Dana (Senior Backend), Sam, Alex";
   - `confidenceScore`: leave `null` (cosine is not a confidence);
   - `metadata`: `{"model_name", "ranking": [{"userId", "score"}...], "candidates": n, "rules_applied": [...],
     "input_texts": {"task": "...", "profiles": {...}}}`. Store the input texts so a suggestion can be debugged
     and reused as training data later.
4. The user approves it (assignee set → `APPROVED`), picks someone else (`OVERRIDDEN`, record who), or
   dismisses it (`REJECTED`). Each outcome is logged as an `ActivityLog` entry.

## 8. Deploying and versioning a model

1. Run OA3 on the GPU machine. Accept the run only if it meets DESIGN.md §6.3 (verification passed, test nDCG@10
   ≥ 0.826, cold start OK, not a smoke run).
2. Copy `artifacts/<run_id>/model/` to model storage (object storage or a release asset; **not git**, ~1.2 GB).
   Its name **is** the version: `run_id`.
3. Deploy the AI service with `MODEL_PATH` pointing at that folder. `GET /v1/health` must report the new
   `model_name`.
4. **Roll out safely:** for a new model, run it in shadow mode first. Compute its ranking next to the current one,
   store both, and show only the current one. Compare acceptance (§9) before switching.
5. Keep the previous model folder so a rollback is just a config change.

## 9. Monitoring and the feedback loop

| Metric | How | Why |
|---|---|---|
| Acceptance@1 / @3 | share of recommendations whose approved assignee was rank 1 / in the top 3 | the real-world quality metric; offline nDCG only approximates it |
| Override rank | for `OVERRIDDEN`, the rank the chosen person had in our list | "nearly right" vs "completely wrong" |
| Unknown-vocabulary rate | share of requests with an area/level outside the training vocabulary | mapping bugs and drift (§4) |
| Latency p50/p95, error rate | service metrics | capacity planning |

**This is the most important long-term step.** The model was trained on *synthetic* labels: a scoring function
decided who is plausible, not real managers. Every approved or overridden recommendation is a real label. Once a few
thousand exist, fine-tune on them (a future OA run, warm-starting from this model). That should matter more than
any further change to the TAWOS training.

## 10. Limitations to keep in mind

- **Synthetic labels and a synthetic 48-person team.** The model learned to reproduce the dataset's scorer from
  profile text. Real teams can differ in ways that scorer did not model.
- **The profile is coarse.** Level, area, years, title, role class. Two Senior Backend engineers with the same
  years get nearly identical vectors, so the model cannot tell them apart. Workload and availability rules (§6) do
  the rest.
- **English text.** TAWOS is English Jira data. Other languages will work worse.
- **Unclassified-style tasks** (vague, no clear area) score much lower in testing (OA2: ~0.15 nDCG@10). Expect weak
  suggestions for vague tasks.
- **Fixed vocabulary.** New expertise areas or levels outside §4.2 require retraining with examples that contain
  them.

## 11. FAQ

**Can I reword the instruction to fit our product?** No. It is part of what the model learned (DESIGN.md §3).
Changing it means retraining.

**A new person joined. Do we retrain?** No. Embed their profile and they are rankable immediately. OA3 measures
exactly this ("held-out members").

**Can I add skills or past tasks to the profile?** Not without retraining. The model has never seen those fields,
and adding them changes the input format.

**Why not use a chat LLM and ask it?** OA2 tested LLM-style scorers that read the task and one person together.
They were slightly worse and 12–15× slower, because they need one model pass per candidate.

**Can a score threshold decide "nobody fits"?** Not reliably: cosine values are not calibrated. If needed, derive a
threshold from logged data (e.g. scores of approved vs rejected suggestions) for a specific model version.
