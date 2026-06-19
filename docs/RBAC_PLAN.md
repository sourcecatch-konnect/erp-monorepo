# RBAC Plan

Authoritative reference for the role-based access control system. Read this
before touching `Role`, `Permission`, `requirePermission`, or any auth flow.

> Status: **Done.** Permission registry, server gating (`requirePermission` / `can`), branch scoping, permission cache, and the admin surface (roles / access / audit-log) are all implemented and in use. This doc remains the authoritative reference for the model.

---

## 1. Goals

1. Admins configure access from a UI — no code change to grant or revoke a
   permission.
2. Every gated action in the system has a single, well-known string key.
3. Authorization checks are O(1) in memory after the first request per user.
4. A non-admin user only sees data for the branches they belong to.
5. Every change to roles, permissions, or user access is auditable.

## 2. Chosen approach

### 2.1 Granularity — `resource.action` string keys

A permission is a string. Examples:

```
master.customer.view
master.customer.create
master.customer.bulk_import
lorry_receipt.approve
lorry_receipt.cancel
trip.close
trip.generate_invoice
admin.rbac.manage
```

Permission rows are catalog data, not schema. Adding a new gated action is a
seed change, not a migration.

Replaces the current `Permission { canView, canCreate, canUpdate, canDelete }`
shape, which cannot express non-CRUD actions (approve / cancel / close /
bulk-import / export).

### 2.2 Subject model — Role + per-user overrides

```
User ──roleId──▶ Role ──▶ RolePermission ──▶ Permission
   └──▶ UserPermission (effect: GRANT | DENY)   // optional, gated behind "Advanced"
```

- One role per user. Multi-role is intentionally deferred — most multi-role
  needs in this domain are solved by a composite role ("Branch Manager +
  Approver").
- `UserPermission` exists for genuine one-off exceptions. DENY beats GRANT.
- No user groups, no nested roles. Add later only if a real requirement forces
  it.

### 2.3 Scope — branch-level only, never row-level

Every user has:

```
User { branchScope: ALL | ASSIGNED }
UserBranch { userId, branchId }   // populated when scope = ASSIGNED
```

Middleware attaches `req.ctx.branchIds` (`string[] | "ALL"`). Services compose
that into the prisma `where` via a `branchFilter(req)` helper.

Row-level / attribute-based rules ("can edit LRs created in last 24h", "can
only see own customers") are **out of scope for v1**. Model them as separate
permission keys when needed.

### 2.4 Evaluation — resolve once, cache per user

- `PermissionResolver.resolve(userId)` returns
  `{ permissions: Set<string>, branchScope, branchIds }` in one query.
- In-memory LRU cache, TTL 5 min, keyed by `userId`.
- `requireAuth` middleware hydrates `req.ctx` from the cache on every request.
- `can(PERMS.LR_APPROVE)` middleware is a `Set.has` check — zero DB hits.
- `/auth/me` returns the resolved set so the frontend can hide buttons.

Invalidation triggers (call `cache.invalidate(userId)`):
- `User.roleId` change
- `Role` mutation (invalidate every user of that role)
- `RolePermission` change (invalidate every user of that role)
- `UserPermission` change (invalidate that user)
- `UserBranch` change (invalidate that user)

### 2.5 Cache backend

**Decision: in-memory LRU for v1.** Server runs as a single instance today
(see `apps/server/src/index.ts`). Acceptable trade-off:

- Pros: zero new infra, simple code, fast.
- Cons: desyncs across instances. **Hard blocker** before any horizontal
  scaling.
- Migration path: swap the cache module's implementation to Redis pub/sub.
  The resolver API does not change.

Re-evaluate when:
- Server is deployed to >1 instance, OR
- Any service outside `apps/server` needs to check permissions.

## 3. What is explicitly deferred

| Item | Defer until |
|---|---|
| User groups / nested roles | A real org-chart requirement appears |
| Multi-role per user | A single role can't model a real position |
| Row-level / ABAC rules | More than 3 such rules accumulate |
| Per-field permissions | Never. Model as separate views instead |
| External policy engine (Casbin, OPA) | Probably never |
| Redis cache | Horizontal scaling lands |

## 4. Permission key conventions

- Lowercase, dot-separated, snake_case segments.
- First segment is the resource family: `master`, `lorry_receipt`, `trip`,
  `order`, `admin`.
- Masters use the pattern `master.<entity>.<action>` matching the master's
  registry slug (`master.customer.view`, `master.spare_part_supplier.create`).
- Non-CRUD actions name the verb: `.approve`, `.cancel`, `.close`,
  `.bulk_import`, `.export`, `.generate_invoice`.
- The constant in `permissions.ts` is the SCREAMING_SNAKE form of the key.

## 5. Phase-by-phase rollout

Tracked in the task list on this branch. Summary:

| Phase | What ships |
|---|---|
| 0 | Permission registry, decision doc, audit-log scaffold |
| 1 | Schema migration (additive). Old + new shape coexist |
| 2 | Resolver + cache + new middleware. Compatibility shim keeps old `requirePermission(key, action)` working |
| 3 | Branch scoping helper, applied through CRUD factory |
| 4 | Admin APIs for roles / users / audit |
| 5 | Admin UI (Roles, Users, Audit Log pages) |
| 6 | Frontend `useCan` / `<Can>` + master gating |
| 7 | Cleanup: delete shim, delete `ROLES.ADMIN` name-match bypass, delete old bool columns |

## 6. Open questions

- `User.branchId` is currently required and non-nullable. Phase 1 keeps it
  as "primary branch" for backwards compat. Decide in Phase 3 whether to
  drop it entirely once `UserBranch` is the source of truth.
- Audit-log retention policy. Compliance probably wants forever; start with
  no purge and revisit.
