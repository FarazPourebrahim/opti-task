# RBAC — Roles & Permission Matrix

The authoritative source is `src/shared/auth/rbac/roles.ts` (`ROLE_PERMISSIONS`).
This table mirrors it for humans. A user may hold several roles at once (e.g.
ORG_ADMIN + TEAM_MEMBER); effective permissions are the **union**, and access is
**deny-by-default** (no role granting a permission ⇒ denied).

## Roles

| Role | Source | Scope |
|---|---|---|
| `ORG_OWNER` | `Organization.ownerId` | Whole organization |
| `ORG_ADMIN` | `OrganizationMember.role = ADMIN` | Whole organization |
| `ORG_MEMBER` | `OrganizationMember.role = MEMBER` | Organization (basic) |
| `PROJECT_ADMIN` | `ProjectMember.role = ADMIN` | One project |
| `PROJECT_MEMBER` | `ProjectMember.role = MEMBER` | One project |
| `TEAM_LEAD` | `TeamMember.role = LEAD` | One team |
| `TEAM_MEMBER` | `TeamMember.role = MEMBER` | One team |
| `VIEWER` | `ProjectMember.role = VIEWER` | One project (read-only) |
| `AI_AGENT` | System role (Phase 10) | Suggestions only |

Scope resolution (`resolveEffectiveRoles`) climbs **team → project → org**, so a
team-scoped action still picks up the user's project- and org-level roles.

## Permission matrix

✔ = allowed. Blank = denied. `ORG_OWNER` has every permission.

| Permission | OWNER | ORG_ADMIN | PROJECT_ADMIN | TEAM_LEAD | MEMBER¹ | VIEWER | AI_AGENT |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| organization:read | ✔ | ✔ | | | ✔ | ✔ | |
| organization:update | ✔ | ✔ | | | | | |
| organization:delete | ✔ | | | | | | |
| organization:manage_members | ✔ | ✔ | | | | | |
| organization:invite | ✔ | ✔ | | | | | |
| project:create | ✔ | ✔ | | | | | |
| project:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| project:update | ✔ | ✔ | ✔ | | | | |
| project:delete | ✔ | ✔ | | | | | |
| project:manage_members | ✔ | ✔ | ✔ | | | | |
| project:configure_workflow | ✔ | ✔ | ✔ | | | | |
| team:create | ✔ | ✔ | ✔ | | | | |
| team:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| team:update | ✔ | ✔ | ✔ | ✔ | | | |
| team:delete | ✔ | ✔ | ✔ | | | | |
| team:manage_members | ✔ | ✔ | ✔ | ✔ | | | |
| sprint:create | ✔ | ✔ | ✔ | | | | |
| sprint:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| sprint:update | ✔ | ✔ | ✔ | | | | |
| sprint:delete | ✔ | ✔ | ✔ | | | | |
| epic:create | ✔ | ✔ | ✔ | | | | |
| epic:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| epic:update | ✔ | ✔ | ✔ | | | | |
| epic:delete | ✔ | ✔ | ✔ | | | | |
| task:create | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| task:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| task:update | ✔ | ✔ | ✔ | ✔ | own² | | |
| task:delete | ✔ | ✔ | ✔ | ✔ | | | |
| task:assign | ✔ | ✔ | ✔ | ✔ | | | |
| task:comment | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| analytics:view | ✔ | ✔ | ✔ | ✔ | | | |
| ai:request | ✔ | ✔ | ✔ | ✔ | ✔ | | ✔ |
| ai:approve | ✔ | ✔ | ✔ | | | | |

¹ MEMBER = `PROJECT_MEMBER` and `TEAM_MEMBER` (identical permission sets).
² `task:update` for a basic member is granted only on tasks they own
(assignee/reporter), enforced via `authorizeOwnerOrPermission(...)` +
`ownsAny(...)` — not by the matrix alone.

## Usage

```ts
import { authorize, authorizeOwnerOrPermission } from '@shared/auth/rbac';

// hard permission check
await authorize(ctx, 'project:update', { projectId });

// member-may-edit-own pattern
await authorizeOwnerOrPermission(ctx, 'task:update', { projectId }, [
  task.assigneeId,
  task.reporterId,
]);
```

Security decisions live in services/resolvers (this engine), not middleware
(`docs/security.md`). `AI_AGENT` can read context and create suggestions but can
never mutate domain data or approve recommendations.
