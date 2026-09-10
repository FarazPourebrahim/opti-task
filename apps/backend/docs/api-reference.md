# OptiTask API Reference

The complete guide to consuming the OptiTask GraphQL API — for **frontend** and
**AI** developers. You should not need to read the server source. The
machine-readable schema is **[api/schema.graphql](api/schema.graphql)**
(regenerate with `npm run schema:print`); this document explains how to use it.

- [Endpoints](#endpoints)
- [Authentication](#authentication)
- [Authorization (RBAC)](#authorization-rbac)
- [Conventions](#conventions) — scalars, pagination, filtering, errors
- [Domains](#domains) — every query & mutation, by area
- [Real-time subscriptions](#real-time-subscriptions)
- [AI integration & approval flow](#ai-integration--approval-flow)
- [Worked example](#worked-example-end-to-end)

---

## Endpoints

| Transport | URL | Use |
|---|---|---|
| GraphQL over HTTP | `POST /graphql` | All queries & mutations |
| GraphQL over WebSocket | `ws://…/graphql` (`graphql-ws`) | Subscriptions |
| Liveness probe | `GET /healthz` | Process is up |
| Readiness probe | `GET /readyz` | Process can reach the DB (503 if not) |

Send queries as JSON: `{ "query": "...", "variables": { ... } }`.
Introspection is enabled outside production.

**Limits:** requests are rate-limited per IP; request bodies are capped at 1 MB;
query nesting depth is capped (max 12) as a DoS guard — exceeding it returns a
validation error.

---

## Authentication

JWT-based: a short-lived **access token** (default 15 min) authorizes requests;
a long-lived **refresh token** (default 7 days) rotates it. Both are also set as
**HTTP-only cookies** on auth mutations, so browser clients can rely on cookies
while non-browser clients use the `Authorization` header.

Send the access token one of two ways:
- Header: `Authorization: Bearer <accessToken>`
- Cookie: `access_token` (set automatically by `register`/`login`/`refreshToken`)

### Operations

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {        # input: { email, name, password }
    accessToken
    refreshToken
    user { id email name }
  }
}

mutation Login($input: LoginInput!) {
  login(input: $input) {           # input: { email, password }
    accessToken refreshToken user { id }
  }
}

mutation Refresh { refreshToken { accessToken refreshToken } }  # rotates; old token is revoked
mutation Logout { logout }                                      # revokes the current session
query Me { me { id email name } }                               # current user
query Sessions { sessions { id userAgent ipAddress createdAt } }
mutation ChangePassword($input: ChangePasswordInput!) { changePassword(input: $input) }
mutation RequestPasswordReset($email: String!) { requestPasswordReset(email: $email) }  # stub (see known-debt)
```

**Refresh rotation & reuse detection:** each refresh issues a new pair and
invalidates the previous refresh token. Presenting an already-rotated token
revokes the session (reuse detection). Access tokens are valid for their full
lifetime (not checked against revocation per request) — see known-debt.

---

## Authorization (RBAC)

Roles are scoped at three levels — **organization → project → team** — and a
user can hold several at once (their permissions are the union). Access is
**deny-by-default**: with no membership in a resource's hierarchy, you get
`FORBIDDEN`.

| Role | Granted by | Can (summary) |
|---|---|---|
| Organization Owner | creating an org | everything in the org |
| Org Admin | org membership role `ADMIN` | manage members, create/delete projects, all project powers |
| Org Member | org membership role `MEMBER` | read the org |
| Project Admin | project membership role `ADMIN` | manage the project, sprints, epics, members, approve AI |
| Project Member / Team Member | project/team membership | read work items, create/comment on tasks, request AI |
| Team Lead | team membership role `LEAD` | manage their team + tasks, view analytics |
| Viewer | project role `VIEWER` | read-only |
| AI Agent | system principal | read context + request AI suggestions only — **never** mutate |

The full permission matrix is in **[rbac.md](rbac.md)**. Every mutation
authorizes before acting; "owner-or-permission" rules let a task's
assignee/reporter or a comment's author act on their own items while admins act
on any.

---

## Conventions

### Scalars
| Scalar | Wire format |
|---|---|
| `UUID` | string, canonical UUID |
| `DateTime` | RFC-3339 string, e.g. `2026-03-01T00:00:00.000Z` (**date-only is rejected**) |
| `JSON` | arbitrary JSON object |

### Pagination (cursor / Relay-style)
Every list query returns a `Connection`:
```graphql
type XConnection { edges { cursor node { … } } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount }
```
Arguments: `first` (page size, default 20, max 100) and `after` (an opaque
cursor from a previous `edge.cursor` / `pageInfo.endCursor`). Cursors are opaque
base64 — treat them as black boxes. Empty results return an explicit empty
`edges` array and `totalCount: 0` (never a bare null).

### Filtering & sorting
List queries that support it take a `filter` input and/or `orderBy:
SortDirection` (`ASC`/`DESC`). Task lists also take `sortField` (`CREATED_AT |
PRIORITY | DUE_DATE`). See each domain below.

### Errors
Errors come back in the standard GraphQL `errors[]` array. Every intentional
error carries a stable machine code in `extensions.code`:

| Code | Meaning | HTTP analogue |
|---|---|---|
| `UNAUTHENTICATED` | no/invalid token on a protected field | 401 |
| `FORBIDDEN` | authenticated but not permitted | 403 |
| `NOT_FOUND` | resource does not exist | 404 |
| `BAD_USER_INPUT` | validation / illegal state transition | 400 |
| `CONFLICT` | duplicate / already-resolved | 409 |
| `SERVICE_UNAVAILABLE` | external AI provider failed after retries | 503 |
| `INTERNAL_SERVER_ERROR` | unexpected (message sanitized in prod) | 500 |

Branch on `extensions.code`, not on message text. In production, unexpected
errors are sanitized to a generic message; typed errors keep their safe message.

---

## Domains

> Notation below lists operation signatures. `→ X!` is the return type. See the
> SDL for full field lists.

### Users & profiles
```
query  user(id: UUID!): User!
query  users(first, after, orderBy, filter: UserFilter): UserConnection!
mutation updateProfile(input: UpdateProfileInput!): User!     # name, avatarUrl, seniority
mutation addSkill(skill: String!): User!
mutation removeSkill(skill: String!): User!
mutation addExpertise(input: AddExpertiseInput!): User!       # tag + confidenceScore
mutation removeExpertise(tag: String!): User!
```
`User` exposes `skills`, `expertise`, `statistics` (completed tasks, velocity,
historical points — finalized by analytics), `teamMemberships`, `analytics`.

### Organizations & invitations
```
query  organization(id: UUID!): Organization!
query  myOrganizations(first, after): OrganizationConnection!
mutation createOrganization(input): Organization!
mutation updateOrganization(id, input): Organization!
mutation deleteOrganization(id): Boolean!
mutation inviteToOrganization(organizationId, input): OrganizationInvitation!   # email + role
mutation acceptInvitation(token: String!): OrganizationMember!
mutation revokeInvitation(id): Boolean!
mutation updateMemberRole(organizationId, userId, role): OrganizationMember!
mutation removeMember(organizationId, userId): Boolean!
```
`Organization.projects(first, after, status)` lists its projects. The owner is
immutable; only owner/admin manage members.

### Projects
State machine: `PLANNING → {ACTIVE, ARCHIVED}`, `ACTIVE → {COMPLETED, ARCHIVED}`,
`COMPLETED → {ACTIVE, ARCHIVED}`, `ARCHIVED` is terminal. Illegal transitions →
`BAD_USER_INPUT`.
```
query  project(id: UUID!): Project!
mutation createProject(organizationId, input): Project!    # creator becomes ADMIN member
mutation updateProject(id, input): Project!
mutation changeProjectStatus(id, status: ProjectState!): Project!
mutation deleteProject(id): Boolean!
mutation configureWorkflow(id, workflow: JSON!): Project!   # scaffolding (unvalidated)
mutation addProjectMember(projectId, userId, role): ProjectMember!
mutation updateProjectMemberRole(projectId, userId, role): ProjectMember!
mutation removeProjectMember(projectId, userId): Boolean!
```
`Project` exposes `members`, `teams`, `sprints`, `epics`, `tasks`, `analytics`,
`aiRecommendations`, `settings`.

### Teams
Team members carry the attributes the AI assignment engine consumes:
`role`, `responsibilities`, `availability`, `workload`.
```
query  team(id: UUID!): Team!
mutation createTeam(projectId, input): Team!
mutation updateTeam(id, input): Team!
mutation deleteTeam(id): Boolean!
mutation addTeamMember(teamId, userId, input: AddTeamMemberInput!): TeamMember!
mutation updateTeamMember(teamId, userId, input): TeamMember!
mutation removeTeamMember(teamId, userId): Boolean!
```

### Tasks
The core work unit. Status state machine (Agile flow):
`BACKLOG ↔ TODO ↔ IN_PROGRESS ↔ IN_REVIEW ↔ TESTING → DONE`, `BLOCKED` reachable
from active states; `DONE` can reopen to `IN_PROGRESS`. Self/illegal transitions
→ `BAD_USER_INPUT`. Assign, story-point, status, and sprint-move mutations are
**transactional + write an immutable activity log**.
```
query  task(id: UUID!): Task!
# list via Project.tasks(filter: TaskFilter, sortField, sortDirection, first, after)
mutation createTask(projectId, input: CreateTaskInput!): Task!     # reporter = caller
mutation updateTask(id, input): Task!                              # title/description/priority/dueDate
mutation changeTaskStatus(id, status: TaskStatus!): Task!
mutation assignTask(id, assigneeId: UUID): Task!                   # null to unassign; notifies assignee
mutation setTaskStoryPoints(id, storyPoints: Int): Task!
mutation moveTaskToSprint(id, sprintId: UUID): Task!
mutation deleteTask(id): Boolean!
mutation logTaskTime(id, seconds: Int!): Task!                     # additive
mutation addTaskDependency(taskId, dependsOnTaskId): Task!         # cycle-detected
mutation removeTaskDependency(taskId, dependsOnTaskId): Task!
mutation watchTask(taskId): Task!     mutation unwatchTask(taskId): Task!
mutation addTaskLabel(taskId, name): Task!   mutation removeTaskLabel(taskId, name): Task!
```
`TaskFilter`: `{ status, priority, assigneeId, sprintId, epicId, labelId }`.
`Task` exposes `assignee`, `reporter`, `labels`, `watchers`, `dependencies`,
`comments`, `attachments`, `activities`. **`sprintId`/`epicId` are IDs**; the
`Sprint`/`Epic` object relations are read from those entities directly.

`Task.activities(first, after)` is the immutable audit trail (creation, status
change, assignment, story-point update, sprint move, AI recommendation, user
approval, comment added).

### Sprints
State machine: `PLANNED → {ACTIVE, CANCELLED}`, `ACTIVE → {COMPLETED, CANCELLED}`;
`COMPLETED`/`CANCELLED` terminal.
```
query  sprint(id: UUID!): Sprint!     # also Project.sprints(first, after)
mutation createSprint(projectId, input): Sprint!     # name/goal/startDate/endDate/capacity
mutation updateSprint(id, input): Sprint!
mutation changeSprintState(id, state: SprintState!): Sprint!
mutation deleteSprint(id): Boolean!
mutation addTaskToSprint(sprintId, taskId): Sprint!
mutation removeTaskFromSprint(sprintId, taskId): Sprint!
```
`Sprint.metrics` → `{ totalStoryPoints, completedStoryPoints, remainingStoryPoints,
totalTasks, completedTasks, completionRate, velocity, capacity, overCapacity,
workloadDistribution }`. `Sprint.burndown` → `[{ date, idealRemaining,
actualRemaining }]` (empty unless start/end dates are set).

### Epics & milestones
```
query  epic(id: UUID!): Epic!     # also Project.epics(first, after)
mutation createEpic(projectId, input): Epic!
mutation updateEpic(id, input): Epic!
mutation deleteEpic(id): Boolean!
mutation refreshEpicProgress(id): Epic!         # persist the live progress onto the column
mutation createMilestone(projectId, input): Milestone!   # name/description/dueDate/epicId
mutation deleteMilestone(id): Boolean!
```
`Epic.progress` is **computed live** (0–100) from child-task completion;
`Epic.tasks(first, after)` and `Epic.milestones` expose related work.

### Comments, mentions & attachments
```
query  comment(id: UUID!): Comment!     # also Task.comments(first, after)
mutation createComment(taskId, input: CreateCommentInput!): Comment!   # body, parentCommentId, mentionedUserIds
mutation editComment(id, input): Comment!        # author or task:update; sets `edited`
mutation resolveComment(id, resolved: Boolean!): Comment!
mutation deleteComment(id): Boolean!
mutation addTaskAttachment(taskId, input: AddAttachmentInput!): Attachment!
mutation addCommentAttachment(commentId, input): Attachment!
mutation removeAttachment(id): Boolean!
```
**Mentions** are passed as explicit `mentionedUserIds` (validated to exist);
each mention creates a `MENTION` notification. **Attachments** store metadata +
an opaque key behind a swappable storage adapter; `Attachment.url` is produced
by the active adapter (a relative `/files/...` path in dev — no real upload yet).

### Notifications (per-recipient feed)
Created automatically by domain events (assignment, mention); clients only read
and mark them.
```
query  myNotifications(first, after, unreadOnly: Boolean): NotificationConnection!
query  unreadNotificationCount: Int!
mutation markNotificationRead(id): Notification!
mutation markAllNotificationsRead: Int!     # returns count marked
```

### Analytics
```
query  projectAnalytics(projectId: UUID!): ProjectAnalytics!   # also Project.analytics
query  userAnalytics(userId: UUID!): UserAnalytics!            # also User.analytics; self or org-admin
mutation recomputeUserStatistics(userId: UUID!): User!         # persist real stats from history
```
`ProjectAnalytics`: totals, `completionRate`, `teamVelocity`,
`taskDistributionByStatus/Priority`, `storyPointTrends` (per sprint),
`individualWorkloads`. New projects return zeroed/empty shapes.

---

## Real-time subscriptions

Connect over WebSocket (`ws://…/graphql`) using the **graphql-ws** protocol.
Authenticate the socket via `connectionParams`:
```jsonc
// graphql-ws connectionParams
{ "authorization": "Bearer <accessToken>" }
```
Each subscription authorizes the socket's user against the resource scope and
**only streams events the user is permitted to see**.

```graphql
subscription($projectId: UUID!) { taskUpdated(projectId: $projectId) { taskId task { id status assignee { id } } } }
subscription($taskId: UUID!)    { commentAdded(taskId: $taskId) { commentId comment { body author { id } } } }
subscription($projectId: UUID!) { sprintUpdated(projectId: $projectId) { sprintId sprint { state } } }
subscription                    { notificationReceived { notificationId notification { type title } } }   # self-scoped
subscription($projectId: UUID!) { aiRecommendationUpdated(projectId: $projectId) { recommendationId approvalStatus } }
```
A subscriber without access to the scoped resource is rejected with `FORBIDDEN`.
The pubsub is in-process (single instance) — see known-debt for the Redis path.

---

## AI integration & approval flow

The backend **never runs models**; it calls an external provider behind a typed
interface (currently a deterministic stub). The contract: **AI suggests, a human
decides.** Every suggestion is persisted to `ai_recommendations` with full
metadata (confidence, provider, type, status) **before** it is returned, and the
domain change is applied only on approval — **transactionally + audited**.

```
# Request a suggestion (needs `ai:request`; AI_AGENT may do this, but cannot approve)
mutation requestStoryPointEstimate(taskId): AiRecommendation!
mutation requestAssignmentRecommendation(taskId): AiRecommendation!
mutation requestSprintHealthAnalysis(sprintId): AiRecommendation!
mutation requestProgressTracking(sprintId): AiRecommendation!
query    assignmentContext(taskId): AssignmentContext!     # the dataset the AI scores

# Decide (needs `ai:approve` — Project Admin / Org Admin / Owner)
mutation approveRecommendation(id): AiRecommendation!       # applies the suggested value
mutation rejectRecommendation(id): AiRecommendation!        # records, changes nothing
mutation overrideRecommendation(id, input): AiRecommendation!  # apply a human value (storyPoints / assigneeId)

query    aiRecommendation(id): AiRecommendation!            # also Project.aiRecommendations(type, approvalStatus)
```
- `approvalStatus`: `PENDING → APPROVED | REJECTED | OVERRIDDEN`.
- `resolutionStatus`: `OPEN → RESOLVED | DISMISSED`.
- Approving a **story-point** estimate sets `task.storyPoints`; approving an
  **assignment** sets `task.assigneeId` (and notifies the assignee). Sprint
  health / progress are informational — approving just records the decision.
- Re-approving a resolved recommendation → `CONFLICT`. Provider failure →
  `SERVICE_UNAVAILABLE` (no crash, nothing persisted).

To wire a real provider later: implement the `AiProvider` interface and call
`setAiProvider(...)` — no resolver/service changes.

---

## Worked example (end-to-end)

```graphql
# 1) Register (you become the org owner). Save accessToken.
mutation { register(input: { email: "me@acme.test", name: "Me", password: "secret123" }) { accessToken user { id } } }

# 2) Create the hierarchy (send Authorization: Bearer <accessToken> on every call)
mutation { createOrganization(input: { name: "Acme" }) { id } }
mutation { createProject(organizationId: "<orgId>", input: { name: "Web" }) { id } }
mutation { createSprint(projectId: "<projId>", input: { name: "Sprint 1", capacity: 20 }) { id } }

# 3) Create a task in the sprint
mutation { createTask(projectId: "<projId>", input: { title: "Build login", sprintId: "<sprintId>", storyPoints: 5 }) { id status } }

# 4) Ask AI to estimate, then approve it
mutation { requestStoryPointEstimate(taskId: "<taskId>") { id metadata } }
mutation { approveRecommendation(id: "<recId>") { approvalStatus } }

# 5) Read analytics
query { projectAnalytics(projectId: "<projId>") { totalStoryPoints completionRate teamVelocity } }
```
