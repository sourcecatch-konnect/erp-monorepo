# Settings and access: developer notes

> Last checked: 2026-10-09 · User guide: [Settings](../../user-guide/01-settings.md)

## Purpose

Login, users, roles, permissions (RBAC), branch scope, notification setup and the audit log.

## Data model

| Table | What it holds |
|---|---|
| `User` | Login user: name, email, password hash, `roleId`, `branchId` (primary), `branchScope` (`ALL` / `ASSIGNED`), `status` (active), mobile, email/WhatsApp opt-in |
| `Role` | Named role. `isSystem = true` for **Admin** (gets every permission; can't be edited) |
| `PermissionDef` | One row per permission key (synced from the code by `seed-admin`). `admin.*` keys are marked `isSystem` |
| `RolePermission` | Role ↔ permission grants |
| `UserPermission` | Per-user override: `effect` = `GRANT` or `DENY` |
| `UserBranch` | Branches an `ASSIGNED`-scope user can work in |
| `PasswordResetToken` | Forgot-password tokens (30 minutes, single use) |
| `AuditLog` | Who did what, when, before/after |
| `UserTablePref` | Saved table layouts per user (`/me/table-prefs`) |
| `NotificationRule`, `NotificationTemplate`, `UserNotificationSubscription`, `NotificationEvent`, `NotificationDelivery`, `InAppNotification` | Notifications |

**Effective permissions** = role grants + user `GRANT`s − user `DENY`s. Admin (system role) = every permission.
**Effective branches:** scope `ALL` → none needed (no filter); `ASSIGNED` → the `UserBranch` rows, else the primary `branchId`.

## Login flow

```
POST /auth/login (email, password)
  → sets httpOnly cookies: accessToken (JWT, 15 min) + refreshToken (7 days)
Every API call: authMiddleware
  → verifies accessToken → getPermissionContext(userId)   (in-memory cache, 5 min)
  → req.user, req.ctx = { permissions, branchScope, branchIds, role }
401 on the website → lib/api.ts calls POST /auth/refresh once → retries the request
GET /auth/me → current user + permissions (used by the website to show menus)
```

Cookies are `SameSite=strict` (or `none` + secure when `COOKIE_CROSS_SITE=true`).

## API

| Method & path | Permission | Purpose |
|---|---|---|
| `POST /auth/login`, `/auth/logout`, `/auth/refresh`, `GET /auth/me` | — / signed in | Session |
| `POST /auth/forgot-password`, `/auth/reset-password` | — (rate-limited) | Reset password by email link |
| `GET/POST /employees`, `GET /employees/page`, `GET/PATCH/DELETE /employees/:id` | `admin.rbac.manage` | Users (screen "Users") |
| `PATCH /employees/:id/password`, `/employees/:id/status` | `admin.rbac.manage` | Reset password, activate/deactivate |
| `GET /admin/users`, `GET/PATCH /admin/users/:id/access` | `admin.rbac.manage` | User access (role, branches, overrides) |
| `GET/POST /admin/roles`, `GET/PATCH/DELETE /admin/roles/:id`, `POST /admin/roles/:id/copy`, `PUT /admin/roles/:id/permissions` | `admin.rbac.manage` | Roles |
| `GET /admin/permissions`, `/admin/permissions/modules`, `/admin/permissions/page` | signed in / `admin.rbac.manage` | Permission catalogue |
| `GET /admin/branches` | `admin.rbac.manage` | Branch list for the access drawer |
| `GET /admin/audit-log`, `/admin/audit-log/actors` | `admin.audit_log.view` | Audit log |
| `/notifications/*` (inbox, preferences, rules, templates, WhatsApp, test-send) | various `notifications.*` | Alerts |

## Files

| Layer | Files |
|---|---|
| Server, auth | `src/router/auth/auth.route.ts`, `src/Services/auth/password-reset.services.ts`, `src/util/auth.util.ts`, `src/middlewares/auth.middlware.ts` |
| Server, permissions | `src/auth/permission-resolver.ts`, `src/auth/permission-cache.ts`, `src/auth/can.middleware.ts`, `src/auth/branch-scope.ts` |
| Server, users | `src/router/employee/employee.route.ts`, `src/controllers/employee/`, `src/Services/employee/employee.services.ts` |
| Server, RBAC | `src/modules/admin/` (`roles.route.ts`, `users.route.ts`, `permissions.route.ts`, `audit-log.route.ts`, `admin.route.ts`) |
| Server, audit | `src/modules/audit/audit.service.ts` (`recordAuditEntry`) |
| Server, seed | `prisma/seed-admin.ts` (permission catalogue, 5 default roles, admin user, ledgers) |
| Shared | `packages/types/src/permissions.ts` (`PERMS`), `permission-labels.ts` (readable names; **required** for every key) |
| Website | `app/(auth)/*` (sign in, forgot/reset password), `app/(dashboard)/settings/*`, `features/auth`, `features/employees`, `features/rbac`, `features/profile`, `features/notifications`, package `@skerp/notifications-web` |

## Rules enforced by the server

- A role name must be unique; the system role can't be renamed, deleted or have its permissions changed.
- A role with users can't be deleted.
- A user's email must be unique.
- You can't deactivate or delete yourself. The last active admin can't be deactivated. A user with recorded work can't be deleted (deactivate instead).
- Permission changes clear the cache straight away: `invalidateUser` for one user, `invalidateAll` after a role change.

## Adding a new permission (checklist)

1. Add the key to `PERMS` in `packages/types/src/permissions.ts`.
2. Add a readable name in `permission-labels.ts`, and an area name if it's a new area. **The build fails without this.**
3. Use `can(PERMS.…)` on the route, and add `permission` to the menu item in `apps/web/config/navigation.ts`.
4. Grant it to the right default roles in `seed-admin.ts` (Admin gets it automatically).
5. Run `seed-admin` on each database to sync the catalogue.

## Known gaps

- The permission cache is in memory, per server. With more than one server instance it needs Redis (noted in `permission-cache.ts`).
- Forgot-password emails depend on AWS SES credentials. They currently fail with an invalid key (see the deployment notes on secrets).

## How to test

- Server tests: `src/modules/admin/__tests__/` (roles, users), `src/Services/employee/__tests__/`.
- Manual test: create a role, give a user one special *Block*, sign in as that user, and check that the menu item is gone and the API returns 403.
