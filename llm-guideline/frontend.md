# Frontend Architecture — SKERP Web

Conventions for `web` (Next.js App Router, TypeScript strict).

---

## 1. State Management

- **Redux Toolkit (RTK)** for app/global state — auth/session, and later cross-cutting
  state (current branch, permissions, UI prefs).
- **TanStack React Query** for server data of feature screens (lists, details) — caching,
  invalidation, pagination.
- **Local component state** (`useState`) for ephemeral UI (form open, toggles).

Rule of thumb: _who owns it?_ App-wide & long-lived → RTK. Server-owned & cacheable →
React Query. View-local → `useState`.

### Redux layout (`app/store/`)

- `store.ts` — `configureStore`, combines slices.
- `hooks.ts` — typed `useAppDispatch` / `useAppSelector`.
- `<feature>Slice.ts` — slice + `createAsyncThunk`s per feature (e.g. `authSlice.ts`).

---

## 2. Data Fetching

- **axios** is the HTTP client. One configured instance in `app/lib/api.ts`
  (`baseURL`, `withCredentials: true`).
- **Interceptors** handle cross-cutting concerns: on `401`, transparently call
  `/auth/refresh` once, then retry the original request. Concurrent 401s share a single
  in-flight refresh. On refresh failure → trigger a global auth-failure handler.
- Never call `fetch` directly or create ad-hoc axios instances.
- API calls live in `app/services/<feature>.service.ts` — thin typed functions returning
  `res.data`. Components/thunks call services, never `api` directly.

---

## 3. Auth & Persistent Login

- Tokens are **httpOnly cookies** set by the server (`accessToken` ~15m, `refreshToken` 7d).
  The frontend never reads or stores tokens — it relies on `withCredentials`.
- **Persistent login:** on app load, an `AuthBootstrap` component dispatches `fetchMe`
  (`GET /auth/me`). If it succeeds the user is restored; if it fails (after the interceptor's
  refresh attempt) the session is `unauthenticated`.
- **Session shape** lives in the `auth` slice: `{ user, status, error }` where `status` is
  `idle | loading | authenticated | unauthenticated`.
- **Route protection:** a `ProtectedRoute` wrapper redirects to `/login` when
  `unauthenticated`, and renders a loader while `idle`/`loading`.
- **No signup UI in web.** Admin users are provisioned server-side. A `/signup` route
  may exist as a placeholder only.

---

## 4. Folder Structure

**Feature-first.** `app/` holds _routing only_ — thin pages that compose feature
code. Business logic lives in `features/<feature>/`. `app/` stays at the project
root (no `src/` directory).

```
apps/web/
  app/                         ROUTING ONLY — thin pages, route groups, layouts
    (auth)/
      login/page.tsx           -> renders <LoginForm/>
      signup/page.tsx          placeholder route only
    (dashboard)/
      layout.tsx               ProtectedRoute + AppShell (sidebar/topbar)
      dashboard/page.tsx       /dashboard
    layout.tsx                 root layout
    providers.tsx              client providers (Redux, React Query, AuthBootstrap)
    page.tsx                   redirects to /dashboard
    globals.css                design tokens (see design.md)
  features/                    one folder per domain feature
    <feature>/
      components/              feature UI (e.g. LoginForm, ProtectedRoute)
      hooks/                   feature hooks (e.g. useAuth)
      services/                axios service functions for this feature
      store/                   the feature's Redux slice
      types.ts                 feature types
      index.ts                 barrel — the feature's public API
  components/
    layout/                    app shell: AppShell, Sidebar, Topbar
  config/
    routes.ts                  route path constants (ROUTES)
    navigation.ts              sidebar nav items
  store/
    store.ts                   root store — composes feature reducers
    hooks.ts                   typed useAppDispatch / useAppSelector
  lib/
    api.ts                     configured axios instance + interceptors
    utils.ts                   small helpers (cn, etc.)
  hooks/                       app-wide (cross-feature) hooks
  types/                       app-wide shared types
```

### Rules

- **`app/` is routing only.** A `page.tsx` should mostly import and render a
  feature component. No business logic, no data fetching in route files.
- **Each feature is self-contained** under `features/<feature>/` and exposes a
  public API via `index.ts`. Other code imports from `@/features/<feature>`,
  never from its internal paths.
- **The root store composes feature slices.** A feature owns its slice in
  `features/<feature>/store/`; `store/store.ts` imports the reducer (directly
  from the slice file, not the barrel, to avoid circular imports).
- **Path alias:** import with `@/...` (configured in `tsconfig.json` →
  `paths: { "@/*": ["./*"] }`). No deep `../../../` relative imports across
  folders; relative imports are fine _within_ a feature.
- **New module = new feature folder.** Adding "orders" means
  `features/orders/{components,hooks,services,store,types.ts,index.ts}` plus a
  route under `app/(dashboard)/orders/`.
- UI primitives come from `@skerp/ui` — see [design.md](./design.md).
- Validation schemas come from `@skerp/validators` (shared Zod) — use them with
  `react-hook-form` + `zodResolver`; don't redefine field rules in the app.

---

## 5. Forms

- `react-hook-form` for all forms.
- Validate with the shared Zod schema from `@skerp/validators` via `zodResolver`.
- Field errors render per [design.md §8](./design.md).

---

## 6. Conventions

- TypeScript strict — no `any`. Type service responses and slice state explicitly.
- `"use client"` only where needed (hooks, state, events). Keep pages server components
  when possible.
- No secrets in client code. Public config via `NEXT_PUBLIC_*` env vars.
- Keep `.env.example` updated when adding env vars.
