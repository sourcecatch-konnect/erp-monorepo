# Master Module — Architecture & Build Guideline

> How we build all reference-data masters (Customer, Vehicle, Route, City, Agreement, …)
> in `apps/web` and `apps/server`.
> A "master" = an entity that other transactional modules (Orders, LR, Trips) depend on.

---

## 1. Goals

A new developer joining the team should be able to:

1. Add a brand-new master end-to-end in **under a day** — schema, API, list, form, bulk import.
2. Know exactly **which folder to open** for any master without searching.
3. Get **compile-time errors** if a field is renamed or removed.
4. Add a bespoke field type or per-master rule **without touching shared code**.

Non-goals: a runtime "form builder", an admin-configurable schema, a single endpoint that serves every master.

---

## 2. Core Principles

1. **Each master is a vertical slice.** One folder on the server, one on the web. Deleting that folder should not break any other master.
2. **Schema is the single source of truth.** Prisma model → Zod schema in `packages/validators` → inferred TS types in `packages/types`. Forms and tables consume the **types**, never a parallel config object.
3. **Share typed code, not runtime config.** A reusable CRUD factory and a set of field/cell components are fine. A central "metadata map" describing every master is not.
4. **Explicit routes.** `POST /customers`, not `POST /:master`. 26 routers, each ~10 lines.
5. **Composable field components.** New field type = new component file. Never a new branch in a central `switch`.
6. **Permissions are first-class.** Every master route is gated; the UI uses the same matrix.
7. **No `any`, no untyped `Json` as a design crutch.** If something needs flexibility, model it explicitly.

---

## 3. Folder Layout

### 3.1 Server — `apps/server/src/modules/<master>/`

```
modules/
  customer/
    customer.router.ts        # Express router; mounts CRUD + bespoke endpoints
    customer.controller.ts    # Thin: parse req → call service → return ApiResponse
    customer.service.ts       # Business logic; uses prisma + validators
    customer.repo.ts          # (optional) raw prisma calls if service grows
  vehicle/
    ...
  _shared/
    crud.factory.ts           # Typed generic CRUD helpers (see §5)
    list.query.ts             # pagination / sort / search / filter parser
    bulk-import.ts            # excel → rows → zod-validated batch insert
    response.ts               # ApiResponse envelope helpers
```

Mount in `router/index.ts`:

```ts
app.use("/api/customers", customerRouter);
app.use("/api/vehicles", vehicleRouter);
// …
```

### 3.2 Web — `apps/web/features/masters/<master>/`

```
features/masters/
  _shared/                              # Building blocks for ALL masters
    MasterListPage.tsx                  # Layout shell (header + table + toolbar + pagination)
    MasterFormDialog.tsx                # Form shell (header + zod form + footer)
    MasterTable.tsx                     # Wraps DataTable with sensible defaults
    columns/
      selectColumn.ts
      actionsColumn.tsx
      statusColumn.tsx
      dateColumn.tsx
      currencyColumn.tsx
    fields/                             # Field component registry — one file per kind
      TextField.tsx
      NumberField.tsx
      SelectField.tsx
      AsyncComboboxField.tsx
      DateField.tsx
      MobileField.tsx
      PanField.tsx
      GstField.tsx
      AadhaarField.tsx
      VehicleNumberField.tsx
      DetentionRatesRepeater.tsx
      …
    hooks/
      useMasterList.ts                  # Typed list + pagination + search
      useMasterMutations.ts             # create / update / delete / bulkDelete
      useBulkImport.ts
  customer/
    page.tsx                            # Route: /masters/customer
    CustomerForm.tsx                    # Composes shared field components
    CustomerTable.tsx                   # Defines ColumnDef<Customer>[]
    customer.service.ts                 # Typed fetch wrapper
    customer.keys.ts                    # TanStack query keys
  vehicle/
    page.tsx
    VehicleForm.tsx                     # Owns Container/Open_Body conditionals
    VehicleTable.tsx
    vehicle.service.ts
  registry.ts                           # Navigation + permissions metadata (§4)
```

App Router wiring:

```
app/(dashboard)/masters/
  page.tsx                              # Catalog of master cards (reads registry)
  [master]/page.tsx                     # Looks up master in registry, lazy-loads its page.tsx
```

The dynamism stops at routing. From `customer/page.tsx` onward, everything is concretely typed against `Customer`.

### 3.3 Shared packages

```
packages/validators/src/masters/
  customer.schema.ts                    # customerCreateSchema, customerUpdateSchema
  vehicle.schema.ts
  …
  index.ts                              # re-exports

packages/types/src/masters/
  customer.types.ts                     # type Customer = z.infer<…>; CustomerCreate, CustomerUpdate
  …
```

Create / Update schemas are **separate** (updates often allow partial fields, omit immutable ones, and handle nested-write shapes differently).

---

## 4. The Registry — Tiny Map for Navigation Only

There is one shared file that lists masters. It is purely for **navigation, icons, and permissions**. It does not describe fields, columns, or behavior.

```ts
// features/masters/registry.ts
import type { ComponentType } from "react";
import { Users, Truck, MapPin } from "lucide-react";

export type MasterCategory =
  | "Organisation"
  | "Vendors"
  | "Transportation"
  | "Inventory"
  | "Agreement"
  | "Access"
  | "Manpower";

export type MasterEntry = {
  slug: string; // url segment, e.g. "customer"
  label: string; // "Customer"
  icon: ComponentType;
  category: MasterCategory;
  permissionKey: string; // matches Permission matrix
  page: () => Promise<{ default: ComponentType }>;
};

export const masterRegistry: MasterEntry[] = [
  {
    slug: "customer",
    label: "Customer",
    icon: Users,
    category: "Vendors",
    permissionKey: "masters.customer",
    page: () => import("./customer/page"),
  },
  // …
];
```

This file is allowed to grow with N masters because each entry is a one-line pointer to a fully typed module. **It is not a place for field configs or column overrides.**

The catalog page maps over `masterRegistry` to render category-grouped cards. The `[master]` route does:

```tsx
const entry = masterRegistry.find((m) => m.slug === params.master);
if (!entry) notFound();
const { default: Page } = await entry.page();
return <Page />;
```

---

## 5. Server CRUD — A Typed Factory

A generic factory returns a fully wired router for any Prisma delegate. Each master calls it once and adds bespoke routes alongside.

```ts
// modules/_shared/crud.factory.ts
export function createCrudRouter<Create, Update>(opts: {
  model: PrismaDelegate;
  createSchema: ZodType<Create>;
  updateSchema: ZodType<Update>;
  permissionKey: string;
  listOptions?: {
    searchableFields?: string[];
    defaultInclude?: object;
    defaultOrderBy?: object;
    softDelete?: boolean; // hides rows where deletedAt != null
  };
  hooks?: {
    beforeCreate?: (data: Create, ctx: ReqCtx) => Promise<Create>;
    afterCreate?: (row: any, ctx: ReqCtx) => Promise<void>;
    beforeUpdate?: (data: Update, row: any, ctx: ReqCtx) => Promise<Update>;
    transformRow?: (row: any) => any; // shape sent to client (list + detail)
  };
}): Router;
```

```ts
// modules/customer/customer.router.ts
const router = createCrudRouter({
  model: prisma.customer,
  createSchema: customerCreateSchema,
  updateSchema: customerUpdateSchema,
  permissionKey: "masters.customer",
  listOptions: {
    searchableFields: ["name", "gst", "city"],
    defaultInclude: { agreements: { select: { id: true } } },
    softDelete: true,
  },
});

// Bespoke endpoint? Just add it. No engine to fight.
router.get("/:id/agreements", listAgreementsForCustomer);

export default router;
```

Endpoints the factory provides for every master:

| Method | Path           | Purpose                                            |
| ------ | -------------- | -------------------------------------------------- |
| GET    | `/`            | List (paginated, searchable, sortable, filterable) |
| GET    | `/:id`         | Detail                                             |
| POST   | `/`            | Create                                             |
| PATCH  | `/:id`         | Update                                             |
| DELETE | `/:id`         | Delete (soft or hard per options)                  |
| POST   | `/bulk-delete` | `{ ids: string[] }`                                |
| POST   | `/bulk-import` | multipart file → row-by-row validated insert       |
| GET    | `/export`      | streamed CSV/XLSX                                  |
| GET    | `/search`      | typeahead — for AsyncCombobox usage                |

The factory wires `requirePermission(permissionKey, action)` on each verb. **No master can be exposed without a permissionKey.**

### Bespoke logic stays local

When a master has unusual rules ("creating a role also seeds default permissions"), that goes in its `controller.ts`/`service.ts`, **not** as a flag the factory has to learn. The factory exists to remove boilerplate, not to absorb every special case.

---

## 6. UI Architecture — Composition, Not Dispatch

### 6.1 List page shell

`MasterListPage` is a **layout component**, not a generic engine. It accepts already-typed pieces:

```tsx
// features/masters/customer/page.tsx
"use client";

export default function CustomerPage() {
  return (
    <MasterListPage
      title="Customers"
      query={useCustomers} // typed list hook
      columns={customerColumns} // ColumnDef<Customer>[]
      FormDialog={CustomerForm} // master's own form
      bulkImport={{
        template: "/templates/customer.xlsx",
        schema: customerCreateSchema,
      }}
      toolbar={<CustomerExtraToolbar />} // optional
    />
  );
}
```

`MasterListPage` handles non-master-specific chrome: header, search box, column-visibility menu, "Add" button, bulk delete, bulk import dialog, pagination, empty/error/loading states. **It does not know what a Customer is.**

### 6.2 Tables — typed columns

Each master defines its own columns. Shared cell helpers cover common cases.

```tsx
// features/masters/customer/CustomerTable.tsx
export const customerColumns: ColumnDef<Customer>[] = [
  selectColumn(),
  { accessorKey: "name", header: "Name" },
  { accessorKey: "gst", header: "GST" },
  { accessorFn: (r) => r.city?.name, id: "city", header: "City" },
  statusColumn(),
  dateColumn("createdAt", "Created"),
  actionsColumn<Customer>({
    onEdit: (row, ctx) => ctx.openForm(row),
    onDelete: (row, ctx) => ctx.delete(row.id),
    permissionKey: "masters.customer",
  }),
];
```

New cell type? Add a helper to `_shared/columns/`. Never a switch.

### 6.3 Forms — JSX composition over a field component registry

Forms are written as **JSX composition** of typed field components. The Zod schema drives validation; the JSX expresses layout and choice of widget.

```tsx
// features/masters/customer/CustomerForm.tsx
export function CustomerForm({
  open,
  onOpenChange,
  row,
}: FormDialogProps<Customer>) {
  const form = useZodForm(customerCreateSchema, { defaultValues: row });
  const { mutate, isPending } = useCustomerMutation({ row });

  return (
    <MasterFormDialog
      title={row ? "Edit Customer" : "Add Customer"}
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={mutate}
      isSubmitting={isPending}
    >
      <FormGrid cols={3}>
        <TextField name="name" label="Name" required />
        <MobileField name="mobile" label="Mobile" />
        <GstField name="gst" label="GST" />
        <PanField name="pan" label="PAN" />
        <AsyncComboboxField name="cityId" label="City" loader={cityLoader} />
        <SelectField name="status" label="Status" options={STATUS_OPTIONS} />
      </FormGrid>
    </MasterFormDialog>
  );
}
```

Conditional fields live **locally** in the form that needs them:

```tsx
// features/masters/vehicle/VehicleForm.tsx
const vehicleType = form.watch("vehicleType");

<FormGrid cols={3}>
  <VehicleNumberField name="number" required />
  <SelectField name="vehicleType" options={VEHICLE_TYPES} required />

  {vehicleType === "Container" && (
    <SelectField name="containerSize" options={CONTAINER_SIZES} />
  )}

  {(vehicleType === "Container" || vehicleType === "Open_Body") && (
    <SelectField name="bodyLength" options={lengthsFor(vehicleType)} />
  )}
</FormGrid>;
```

The Container-specific rule lives in `VehicleForm.tsx`. The other 25 masters never see it.

### 6.4 Field component contract

Every field in `_shared/fields/` follows the same shape:

```tsx
type FieldProps<TFormValues, TName extends Path<TFormValues>> = {
  name: TName;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  // …field-specific props
};
```

Internally each field reads from `useFormContext()` (RHF) and renders the standard `<FormItem>/<FormLabel>/<FormControl>/<FormMessage>` markup. **No coupling to a `field.type` string.**

Adding a new domain-specific input (say `IfscField` for bank codes): create the file in `_shared/fields/`, export it, use it. No central registration step.

### 6.5 When a master form gets big

If a single form file exceeds ~300 lines, split it by section:

```
features/masters/customer/
  CustomerForm.tsx               # composes the sections
  form/
    CustomerIdentitySection.tsx  # name, status, contact
    CustomerTaxSection.tsx       # GST, PAN
    CustomerAddressSection.tsx   # city, area, pincode
```

Sections still use the same shared field components.

---

## 7. Data Flow

### 7.1 Server response shape

```ts
type ApiResponse<T> =
  | { ok: true; data: T; meta?: ListMeta }
  | { ok: false; error: ApiError };

type ListMeta = { page: number; size: number; total: number };
```

`ApiResponse` and `ApiError` live in `packages/types`. The HTTP client unwraps them and throws typed errors.

### 7.2 Web service layer — one file per master

```ts
// features/masters/customer/customer.service.ts
import type { Customer, CustomerCreate, CustomerUpdate } from "@erp/types";

export const customerApi = {
  list: (q: ListQuery) => http.get<Customer[]>("/customers", { params: q }),
  detail: (id: string) => http.get<Customer>(`/customers/${id}`),
  create: (body: CustomerCreate) => http.post<Customer>("/customers", body),
  update: (id: string, body: CustomerUpdate) =>
    http.patch<Customer>(`/customers/${id}`, body),
  remove: (id: string) => http.delete(`/customers/${id}`),
  bulkRemove: (ids: string[]) => http.post("/customers/bulk-delete", { ids }),
  bulkImport: (file: File) =>
    http.upload<BulkImportResult>("/customers/bulk-import", file),
  search: (q: string) =>
    http.get<Customer[]>("/customers/search", { params: { q } }),
};
```

### 7.3 TanStack Query keys

```ts
// features/masters/customer/customer.keys.ts
export const customerKeys = {
  all: ["customers"] as const,
  list: (q: ListQuery) => [...customerKeys.all, "list", q] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};
```

`_shared/hooks/useMasterMutations.ts` is generic over `service + keys` — shared _code_, per-master concrete types. Invalidation is always explicit (`queryClient.invalidateQueries({ queryKey: customerKeys.all })`).

### 7.4 List query syntax (lock this early)

```
GET /customers?page=0&size=25&sort=name:asc&search=acme&filter[status]=active
```

Parsed once in `_shared/list.query.ts` on the server, and once in `useMasterList` on the web. **Same shape across every master.**

---

## 8. Bulk Import / Export

Per-master, **not** generic.

- **Import:** `POST /<master>/bulk-import` accepts XLSX/CSV. Each row validated against `createSchema`. Response: `{ inserted: number; errors: { row: number; issues: string[] }[] }`. The shared bulk-import dialog renders the per-row error report — never silently swallows failures.
- **Templates:** each master ships a downloadable template at `public/templates/<master>.xlsx`. Column headers match the create-schema field names.
- **Export:** `GET /<master>/export?format=csv|xlsx` streams the same shape the list returns, columns picked by the master's table definition.

---

## 9. Permissions

The Permission matrix is `(role × moduleKey × action)`. Every master declares a `permissionKey` (see §4 and §5).

- **Server:** `createCrudRouter` wires `requirePermission(permissionKey, action)` on every verb. Bespoke endpoints in a master's router must also call it.
- **Web:**
  - `useCan(permissionKey, action)` gates buttons (Add, Edit, Delete, Bulk Import, Export).
  - The catalog page filters `masterRegistry` by what the user can `read`.
  - Server is the source of truth — UI gating is a UX nicety, not a security boundary.

---

## 10. Cross-Cutting Concerns

| Concern                     | Decision                                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Soft delete**             | Default ON for masters referenced by transactional modules (Customer, Vehicle, Route, Agreement, …). Add `deletedAt DateTime?` to those Prisma models. The factory hides soft-deleted rows from list/detail unless `?includeDeleted=true` is passed by an admin. |
| **Audit fields**            | Every master row has `createdAt`, `updatedAt`, `createdById`, `updatedById`. Populated by a Prisma extension that reads the request context — never by hand in service code.                                                                                     |
| **Status field**            | Masters that have lifecycle use a typed enum (`ACTIVE`/`INACTIVE`), not a free-form string. Status changes go through a dedicated endpoint when they trigger side effects.                                                                                       |
| **IDs**                     | CUIDs (Prisma `@default(cuid())`). Never expose raw DB sequences.                                                                                                                                                                                                |
| **Timestamps**              | ISO strings on the wire. Date pickers convert at the form boundary.                                                                                                                                                                                              |
| **Numbers (money, weight)** | Decimal in Prisma; string-on-the-wire to avoid float drift; parsed at the form boundary.                                                                                                                                                                         |
| **i18n**                    | Field labels live in the master's form/table files. Not central.                                                                                                                                                                                                 |

---

## 11. Adding a New Master — Checklist

Goal: this list stays at ~6 steps. If it grows, the architecture is broken.

1. **Prisma model** in `apps/server/prisma/schema.prisma` + migration. Include `createdAt/updatedAt/createdById/updatedById` and (if referenced by transactions) `deletedAt`.
2. **Zod schemas** (`<name>CreateSchema`, `<name>UpdateSchema`) in `packages/validators/src/masters/<name>.schema.ts`. Export inferred types from `packages/types`.
3. **Server module**: create `modules/<name>/` with a router using `createCrudRouter`. Mount it in `router/index.ts`. Add bespoke endpoints if needed.
4. **Web feature**: create `features/masters/<name>/` with `page.tsx`, `<Name>Form.tsx`, `<Name>Table.tsx`, `<name>.service.ts`, `<name>.keys.ts`.
5. **Registry entry** in `features/masters/registry.ts` (one line).
6. **Permissions seed**: add `masters.<name>` to the module-registry seed so roles can grant it.

That's it. No central form config to edit. No central column map. No shared switch statement to extend.

---

## 12. Build Order

Build one small master end-to-end before starting the rest, to harden the `_shared/` primitives.

| Wave | Masters                                                                                                     | Why this order                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1    | **City**, State, Area                                                                                       | Trivial fields, no relations. Proves the list shell, table, form dialog, bulk import, permissions.    |
| 2    | Company, Branch, Warehouse                                                                                  | Org tree. Proves relational selects via `AsyncComboboxField`.                                         |
| 3    | **Customer**                                                                                                | Heaviest field variety (GST, PAN, mobile, status). Proves the field registry covers the common cases. |
| 4    | Vehicle                                                                                                     | Conditional fields (Container/Open_Body). Proves per-master conditionals stay local.                  |
| 5    | Agreement + DetentionRate                                                                                   | Nested writes. Proves the repeater field.                                                             |
| 6    | Driver, Labour, Transport, Pump, Spare\*, RateMatrix, RailwayFreightMatrix, Route, Goods, Wagon, User, Role | Pattern is now stable. Should be near-mechanical.                                                     |

Bold = "stop here and review the shared primitives before continuing".

---

## 13. Anti-Patterns — Reject in Code Review

- A field-config object passed from server to client to drive form rendering.
- A central `switch` over master name or field type — anywhere.
- `if (slug === "...")` anywhere outside that master's own folder.
- A new `case "..."` added to a shared file to support one master.
- A web feature importing `prisma` directly.
- A master exposed without a `permissionKey`.
- Cross-master imports: `features/masters/customer/` importing from `features/masters/vehicle/`. If two masters share logic, it goes in `_shared/`.
- One Zod schema reused for both create and update without explicit reason.
- Untyped column arrays (`ColumnDef<any>[]`) or "flatten the row, guess headers".
- Bulk import that returns `{ success: true }` without a per-row error report.
- Silent client-side permission filtering with no server check.

---

## 14. Decisions to Lock Before Wave 1

These shape every master that follows. Settle them in writing, then build.

- **HTTP client:** native `fetch` wrapper vs `ky` vs `axios`. Needs typed `ApiResponse` unwrap + error throw.
- **Response envelope:** confirm `{ ok, data, meta, error }` shape; put it in `packages/types`.
- **List query syntax:** `page=&size=&sort=field:dir&search=&filter[k]=v` — finalise and put in `_shared/list.query.ts`.
- **Form library:** React Hook Form + `zodResolver` from `@hookform/resolvers/zod`.
- **Table library:** TanStack Table v8.
- **Date library:** `date-fns` (already in tree).
- **Soft delete policy:** which masters get `deletedAt`?
- **Audit propagation:** Prisma extension reading `AsyncLocalStorage` request context.
- **Toast/Notification library:** `sonner` (already in tree).
- **Empty/error/loading states:** one shared component set in `_shared/`.

---

## 15. Summary

| Layer                                                  | Per-master                   | Shared                                |
| ------------------------------------------------------ | ---------------------------- | ------------------------------------- |
| Prisma model                                           | ✅                           | —                                     |
| Zod create/update schema                               | ✅                           | —                                     |
| TS types (inferred)                                    | ✅                           | —                                     |
| Server router/controller/service                       | ✅                           | `createCrudRouter`                    |
| List endpoint behavior (pagination/search/sort/filter) | —                            | `_shared/list.query.ts`               |
| Bulk import endpoint                                   | ✅ (calls helper)            | `_shared/bulk-import.ts`              |
| Permissions middleware                                 | —                            | `requirePermission`                   |
| Web `page.tsx`                                         | ✅                           | —                                     |
| Web form                                               | ✅ (composes shared fields)  | field components                      |
| Web table                                              | ✅ (composes shared columns) | column helpers                        |
| Web service / query keys                               | ✅                           | `useMasterList`, `useMasterMutations` |
| List page shell (header, toolbar, pagination, dialogs) | —                            | `MasterListPage`                      |
| Form dialog shell                                      | —                            | `MasterFormDialog`                    |
| Navigation entry                                       | ✅ (one line)                | `registry.ts`                         |

The pattern: **typed code primitives are shared; everything that describes a specific master lives in that master's folder.** When a master needs to be weird, it's weird locally — the other 25 don't notice.
