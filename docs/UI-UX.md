# UI / UX Guide — Writing Screens for Everyday Staff

How SK ERP screens should **talk** and **behave** so that the people using them
every day understand them without training.

- Visual rules (colors, radius, spacing, components) → [`llm-guideline/design.md`](../llm-guideline/design.md)
- Code architecture → [`llm-guideline/frontend.md`](../llm-guideline/frontend.md)
- Feature ideas and roadmap → [`OPUS_UI_SUGGESTIONS.md`](./OPUS_UI_SUGGESTIONS.md)

This guide covers what those leave out: words, the information a screen shows,
and how it responds. Read it before building or reworking a screen, and add a
row to the [screen log](#9-screen-log) when you finish one.

---

## 1. Who we design for

Our users are branch staff, accountants, managers and owners, mostly in their
30s and 40s. They know the transport business well: LR, POD, e-way bill, rake
and VP are everyday words to them. They are **not** software people.

So a screen should:

1. **Use their words, not ours.** "Approve vendor payments", not `accounts.payment.approve`.
2. **Never show machine values.** No IDs, codes, JSON, `SCREAMING_CASE` or paise.
3. **Answer the question they came with.** Who did it, what changed, can this person do X.
4. **Show the simple version first.** Details are one click away, never forced on them.

---

## 2. Plain language

### Rules

- **Start actions with a verb**: *Create bills*, *Approve LRs*, *Pay vendors*.
- **Use the sidebar's names.** If the menu says "Lorry Receipts", don't call it something else on another screen.
- **Short, everyday words.** Use "pick" over "select", "see" over "access", "block" over "deny".
- **Write full sentences in summaries and help text**, with a full stop. A label is a noun phrase with no full stop.
- **Say what will happen.** Prefer "Go back to what the role allows" over "Reset override".
- **Sentence case everywhere** ("Special permissions", not "Special Permissions").

### Words to swap

| Don't show | Show instead |
|---|---|
| `accounts.payment.approve` | Approve vendor payments |
| Grant / Deny / — (inherit) | Allow / Block / Same as role |
| Override, per-user override | Special permission |
| Branch scope: ALL / ASSIGNED | All branches / Only the branches I pick |
| Entity, Actor, Action | Record, Changed by, What happened |
| `PENDING_REVIEW` | Pending review |
| `cmrk5z5ue006g4web0iuzr0pm` | Ramesh Patil |
| `1200000` (paise) | ₹12,000.00 |
| `2026-10-02T09:30:00.000Z` | 2 Oct 2026, 3:00 pm |
| diff, payload, metadata | Details |
| System role | Built-in role |
| Error 403 / Forbidden | You don't have permission to do this. |

---

## 3. Never show machine values

Every internal value should go through a helper that makes it readable.

| Value | Helper | Where |
|---|---|---|
| Money stored in paise | `formatPaise(value)` | `@/lib/money` |
| Date / date-time | `formatDate(iso)`, `formatDateTime(iso)` | `@/lib/format` |
| Audit log entry | `describeAuditEntry(entry)` | `features/rbac/audit-log.format.ts` |
| Enum values | A label map next to the feature (e.g. `JOURNEY_STATUS_LABELS`) | per feature |
| Permission key | `permissionLabel(key)` | `@skerp/types` |

**IDs are never content.** If a screen would show an ID, resolve it to a name
on the server, because the person viewing may not have permission to look it
up. The reference is `resolveRefLabels` in
`apps/server/src/modules/admin/audit-log.route.ts`: any `roleId`, `userId(s)`,
`branchId(s)`, `driverId(s)` or `vehicleId(s)` found in an audit entry comes
back as a name.

If a technical value is genuinely useful to support staff, put it in a
`title` tooltip, never in the visible text.

---

## 4. List screens

**Filters people can use**
- Pick from lists, don't type codes. Use a `Select` for fixed choices, a
  `Combobox` (searchable) for people and records, and presets for dates
  (Today · Last 7 days · Last 30 days · Custom dates).
- Show **Clear filters** as soon as any filter is set.
- A user must never need to know an internal string like `role.create` to filter.

**Rows that scan**
- Lead with the human summary: *who did what to which record*.
- Group by day for anything time-based ("Today", "Yesterday", "Wednesday, 30 Sep 2026"),
  and show only the time on each row. The full date goes in a tooltip.
- Mark the current user's own rows "(you)".
- A coloured dot can signal the kind of event: green for created, approved or paid;
  red for deleted, cancelled or rejected; neutral otherwise. Never rely on colour alone.

**Details on demand**
- Each row gets one readable sentence. If there's more, add a **Show details** toggle
  that expands a labelled list (`Label → value`, `before → after`), never raw JSON.
- Long lists collapse to the first few items plus **+N more**.

**Every state has words**

| State | What to show |
|---|---|
| First load | `Skeleton` rows shaped like the real rows |
| Loading the next page | Keep the current rows, dimmed (`placeholderData: keepPreviousData`) |
| No data yet | What will appear here, and why it's empty |
| No match for filters | "No … match these filters" + a **Clear filters** button |
| Failed to load | "Couldn't load …" + **Try again** |

Use `TableEmptyState` (it takes `description` and `action`) and
`TablePaginationFooter` from `@/components/data-table`.

**Drill down, don't dead-end.** If a row names a record, let people click it to
see more. For example, the audit log's record name opens that record's full
history, with a clear **Back to all activity**.

*Reference implementation: Settings → Audit log (`features/rbac/AuditLogPage.tsx`).*

---

## 5. Forms and drawers

- **One section per question**, each with a title and a one-line help sentence
  in plain words: *Role: "The role decides what this person can do."*
- **Either/or choices are radio buttons** (`RadioGroup`), not dropdowns.
- **Show the starting point next to the exception.** When someone can change a
  default, show what the default is.
- **Show what's already been changed**, even if it's on another page or tab.
- **Advanced things stay folded away**, with a count in the header ("2 set" / "None")
  so nobody has to open it to know if something is there.
- **Saving**: the button reads "Saving…" while busy. Show server errors in plain
  words near the button. Don't close the drawer on failure.
- **Search should forgive.** The placeholder suggests a real example
  ("Search, e.g. approve payments"), and the no-match text suggests a simpler word.

---

## 6. Writing copy

| Thing | Pattern | Example |
|---|---|---|
| Page subtitle | What this page is for, one sentence | "Choose what each person can do and which branches they work in." |
| Button | Verb + object | "Save changes", "Clear filters", "Back to all activity" |
| Empty state | What's missing + what fills it | "Nothing has been recorded yet. Changes to roles, user access, … will appear here." |
| Error | What failed + what to do | "Couldn't load the audit log. Check your connection and try again." |
| Summary sentence | Past tense, specific, with numbers | "Gave 3 new permissions and took away 1. The role now has 42 permissions." |
| Help text | Second person, why it matters | "Most people don't need any." |

Avoid: "Invalid input", "Something went wrong", "N/A", "null", "undefined",
"Error:" prefixes, exclamation marks and ALL CAPS.

---

## 7. Checklist before shipping a screen

In addition to the visual checklist in `llm-guideline/design.md` §10:

- [ ] No IDs, keys, enum codes, paise or ISO dates visible anywhere.
- [ ] Filters are pickers, not free text for internal values.
- [ ] Loading, empty, no-match and error states each have their own words.
- [ ] Each row or record can be understood without opening details.
- [ ] Buttons start with a verb, and there's one primary button per view.
- [ ] Someone outside the team could use the screen without asking what a word means.

---

## 8. Spec: Settings → User access → Edit access

> **Status: implemented.** The Edit access drawer follows this specification.

### 8.1 Problems today

The "Advanced Permissions" part of the drawer shows raw permission keys and
technical options:

```
accounts.payment.approve     — (inherit)
accounts.payment.cancel      — (inherit)
accounts.payment.create      — (inherit)
accounts.payment.disburse    — (inherit)
```

- Keys like `accounts.payment.disburse` mean nothing to most staff.
- "— (inherit)", "Grant" and "Deny" are system words, not everyday ones.
- You can't see whether the person's **role** already allows an action, so you
  can't tell whether an exception is even needed.
- Only one module is shown at a time, so exceptions set in other modules are
  invisible unless you go looking for them.
- The module picker shows codes (`masters.customer`) under each name.
- It uses a raw `<table>` and the string "Loading permissions...", both against
  the rules in `CLAUDE.md`. It should use `Table` and `Skeleton`.
- Save errors are not shown.

### 8.2 Proposed layout

```
┌ Edit access for Ravi Kumar ─────────────────────────────────┐
│ ravi.kumar@sktranslines.com                                 │
│                                                             │
│ ┌ Role ───────────────────────────────────────────────────┐ │
│ │ The role decides what this person can do. Pick the one  │ │
│ │ that matches their job.                                 │ │
│ │ [ Operations                                     ▾ ]    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌ Branches ───────────────────────────────────────────────┐ │
│ │ Which branches can this person see and work in?         │ │
│ │ ( ) All branches                                        │ │
│ │ (•) Only the branches I pick     2 of 6 picked          │ │
│ │     [x] Pune   PUN      [x] Mumbai  MUM                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌ Special permissions ──────────────────────── 2 set  › ──┐ │
│ │ Allow or block a single action for this person only,    │ │
│ │ without changing their role. Most people don't need any.│ │
│ │                                                         │ │
│ │ Set for this person                                     │ │
│ │  [✓ Allowed] Approve vendor payments · Vendor payments  [Remove] │
│ │  [⊘ Blocked] Cancel LRs · Lorry receipts (LR)           [Remove] │
│ │                                                         │ │
│ │ [🔍 Search, e.g. approve payments ] [ All areas    ▾ ]  │ │
│ │                                                         │ │
│ │ What they can do          Their role     For this person│ │
│ │ ── Vendor payments ───────────────────────────────────  │ │
│ │ View vendor payments      ✓ Allowed      [Same as role▾]│ │
│ │ Create vendor payments    ✓ Allowed      [Same as role▾]│ │
│ │ Approve vendor payments   Not allowed    [Allow       ▾]│ │
│ │ Pay vendors               Not allowed    [Same as role▾]│ │
│ │ Cancel vendor payments    Not allowed    [Same as role▾]│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ Cancel ]                              [ Save changes ]    │
└─────────────────────────────────────────────────────────────┘
```

Key behaviours:

- **Title** names the person; the email sits underneath.
- **Branches** uses radio buttons, with a live "N of M picked" count.
- **Special permissions** is folded away by default. Its header shows "N set"
  or "None", so you know without opening it.
- **"Set for this person"** lists every exception across all areas, each with a
  **Remove** button ("Go back to what the role allows").
- **Search** covers every area at once and matches the plain-English names and
  area names. The area dropdown narrows to one area.
- **"Their role"** shows *Allowed* / *Not allowed* from the selected role. If
  the role changes in the form, this column updates.
- Rows with an exception get a light `bg-primary/5` highlight.
- Within an area, rows go View → Create → Edit → Delete, then the special actions.
- **Save** shows "Saving…" while busy, and server errors appear above the buttons.

### 8.3 Choice labels

| Today | Proposed | Meaning |
|---|---|---|
| — (inherit) | **Same as role** | No exception; the role decides. |
| Grant | **Allow** | This person can do it even if the role can't. |
| Deny | **Block** | This person can't do it even if the role can. |
| (system) next to a role | **(built-in)** | A role that comes with the system. |

### 8.4 Plain-English permission names

Every permission key gets a short name that starts with a verb. The same names
should be used on **Edit access**, **Roles → role detail** and **Audit log**,
so a permission reads the same everywhere.

#### Master data (same six actions for every master)

| Action | Name pattern | Example (customer) |
|---|---|---|
| `view` | View *things* | View customers |
| `create` | Add *things* | Add customers |
| `update` | Edit *things* | Edit customers |
| `delete` | Delete *things* | Delete customers |
| `bulk_import` | Upload *things* from a file | Upload customers from a file |
| `export` | Download *thing* list | Download customer list |

Nouns per master (singular / plural):

| Master | Noun | Master | Noun |
|---|---|---|---|
| state | state / states | labour | labour / labour |
| city | city / cities | goods | goods / goods |
| area | area / areas | unit-of-measure | unit of measure / units of measure |
| transport | transporter / transporters | pump | fuel pump / fuel pumps |
| vehicle | vehicle / vehicles | wagon | wagon / wagons |
| vehicle-type | vehicle type / vehicle types | railway-freight | railway freight rate / railway freight rates |
| spare-category | spare category / spare categories | agreement | agreement / agreements |
| spare-part | spare part / spare parts | rate-matrix | rate matrix / rate matrices |
| spare-part-supplier | spare part supplier / spare part suppliers | creditor | creditor / creditors |
| customer | customer / customers | cash-account | cash account / cash accounts |
| company | company / companies | branch | branch / branches |
| route | route / routes | warehouse | warehouse / warehouses |
| driver | driver / drivers | | |

Area name for a master: **Master data: *Things*** (e.g. "Master data: Customers").

#### Everything else

**Vendor payments** (`accounts`)

| Key | Name |
|---|---|
| `accounts.payment.view` | View vendor payments |
| `accounts.payment.create` | Create vendor payments |
| `accounts.payment.approve` | Approve vendor payments |
| `accounts.payment.disburse` | Pay vendors |
| `accounts.payment.cancel` | Cancel vendor payments |

**Lorry receipts (LR)** (`lorry_receipt`)

| Key | Name |
|---|---|
| `lorry_receipt.view` | View LRs |
| `lorry_receipt.create` | Create LRs |
| `lorry_receipt.update` | Edit LRs |
| `lorry_receipt.delete` | Delete LRs |
| `lorry_receipt.approve` | Approve LRs |
| `lorry_receipt.cancel` | Cancel LRs |
| `lorry_receipt.generate_invoice` | Create bill from LR |
| `lorry_receipt.deliver` | Mark LRs as delivered |
| `lorry_receipt.acknowledge` | Add proof of delivery (POD) |

**Orders** (`order`)

| Key | Name |
|---|---|
| `order.view` | View orders |
| `order.create` | Create orders |
| `order.update` | Edit orders |
| `order.delete` | Delete orders |
| `order.approve` | Approve orders |
| `order.reject` | Reject orders |
| `order.cancel` | Cancel orders |

**Trips** (`trip`)

| Key | Name |
|---|---|
| `trip.view` | View trips |
| `trip.create` | Create trips |
| `trip.update` | Edit trips |
| `trip.delete` | Delete trips |
| `trip.close` | Close trips |
| `trip.cancel` | Cancel trips |
| `trip.correct_closed` | Edit closed trips |
| `trip.correct_in_transit` | Edit trips that are on the road |

**Vehicle journeys** (`vehicle_journey`)

| Key | Name |
|---|---|
| `vehicle_journey.view` | View vehicle journeys |
| `vehicle_journey.create` | Start vehicle journeys |
| `vehicle_journey.update` | Edit vehicle journeys |
| `vehicle_journey.close` | Close vehicle journeys |
| `vehicle_journey.cancel` | Cancel vehicle journeys |
| `vehicle_journey.reopen_settlement` | Reopen settled journeys |
| `vehicle_journey.override_chain` | Add trip out of route order |

**Trip expenses** (`trip_expense`) and **Driver advances** (`trip_advance`)

| Key | Name |
|---|---|
| `trip_expense.view` | View trip expenses |
| `trip_expense.create` | Add trip expenses |
| `trip_expense.update` | Edit trip expenses |
| `trip_expense.approve` | Approve trip expenses |
| `trip_expense.reverse` | Undo trip expenses |
| `trip_advance.view` | View driver advances |
| `trip_advance.create` | Give driver advances |
| `trip_advance.reverse` | Undo driver advances |

**Log slips** (`logslip`)

| Key | Name |
|---|---|
| `logslip.view` | View log slips |
| `logslip.generate` | Create log slips |
| `logslip.post_accounts` | Send log slips to accounts |
| `logslip.reopen` | Reopen log slips |
| `logslip.print` | Print log slips |

**VP schedule** (`vp_schedule`) and **VP loading** (`vp_loading`)

| Key | Name |
|---|---|
| `vp_schedule.view` | View VP schedule |
| `vp_schedule.create` | Create VP schedule |
| `vp_schedule.update` | Edit VP schedule |
| `vp_schedule.delete` | Delete VP schedule |
| `vp_schedule.confirm` | Confirm VP schedule |
| `vp_schedule.cancel` | Cancel VP schedule |
| `vp_loading.view` | View VP loading |
| `vp_loading.create` | Create VP loading |
| `vp_loading.update` | Edit VP loading |
| `vp_loading.delete` | Delete VP loading |
| `vp_loading.mark_loaded` | Mark a VP as loaded |
| `vp_loading.cancel` | Cancel VP loading |
| `vp_loading.complete` | Complete VP loading |
| `vp_loading.verify` | Verify VP loading |
| `vp_loading.capacity_override` | Load more than VP capacity |
| `vp_loading.assign_tracker` | Add tracker to VP |
| `vp_loading.replace_tracker` | Change tracker on VP |
| `vp_loading.release_tracker` | Remove tracker from VP |

**MR / RR** (`mrrr`)

| Key | Name |
|---|---|
| `mrrr.view` | View MR / RR |
| `mrrr.create` | Create MR / RR |
| `mrrr.update` | Edit MR / RR |
| `mrrr.delete` | Delete MR / RR |
| `mrrr.submit` | Submit MR / RR |
| `mrrr.cancel` | Cancel MR / RR |

**GRN at rail head** (`grn`) and **GRN at branch** (`rail_branch_grn`)

| Key | Name |
|---|---|
| `grn.view` | View GRN at rail head |
| `grn.create` | Create GRN at rail head |
| `grn.update` | Edit GRN at rail head |
| `grn.delete` | Delete GRN at rail head |
| `grn.submit` | Submit GRN at rail head |
| `grn.cancel` | Cancel GRN at rail head |
| `rail_branch_grn.view` | View GRN at branch |
| `rail_branch_grn.create` | Create GRN at branch |
| `rail_branch_grn.update` | Edit GRN at branch |
| `rail_branch_grn.delete` | Delete GRN at branch |
| `rail_branch_grn.submit` | Submit GRN at branch |
| `rail_branch_grn.cancel` | Cancel GRN at branch |

**Rakes** (`rail_rake_operation`, `rake_at_rail_head`, `rake_at_branch`)

| Key | Name |
|---|---|
| `rail_rake_operation.view` | View rail rake operations |
| `rail_rake_operation.create` | Create rail rake operations |
| `rail_rake_operation.update` | Edit rail rake operations |
| `rail_rake_operation.delete` | Delete rail rake operations |
| `rail_rake_operation.submit` | Submit rail rake operations |
| `rake_at_rail_head.view` | View rake & DC/WC at rail head |
| `rake_at_rail_head.create` | Create rake & DC/WC at rail head |
| `rake_at_rail_head.update` | Edit rake & DC/WC at rail head |
| `rake_at_rail_head.delete` | Delete rake & DC/WC at rail head |
| `rake_at_rail_head.submit` | Submit rake & DC/WC at rail head |
| `rake_at_branch.view` | View rake & DC/WC at branch |
| `rake_at_branch.create` | Create rake & DC/WC at branch |
| `rake_at_branch.update` | Edit rake & DC/WC at branch |
| `rake_at_branch.delete` | Delete rake & DC/WC at branch |
| `rake_at_branch.submit` | Submit rake & DC/WC at branch |

**Delivery challans** (`delivery_challan`) and **E-way bills** (`ewaybill`)

| Key | Name |
|---|---|
| `delivery_challan.view` | View delivery challans |
| `delivery_challan.create` | Create delivery challans |
| `delivery_challan.update` | Edit delivery challans |
| `delivery_challan.delete` | Delete delivery challans |
| `delivery_challan.issue` | Issue delivery challans |
| `delivery_challan.cancel` | Cancel delivery challans |
| `ewaybill.view` | View e-way bills |
| `ewaybill.create` | Create e-way bills |
| `ewaybill.update` | Edit e-way bills |
| `ewaybill.delete` | Delete e-way bills |
| `ewaybill.extend` | Extend e-way bills |
| `ewaybill.cancel` | Cancel e-way bills |

**Wagon tracking** (`tracking`) and **OneLap trackers** (`masters.one-lap-tracker`)

| Key | Name |
|---|---|
| `tracking.view` | View wagon tracking |
| `masters.one-lap-tracker.view` | View OneLap trackers |
| `masters.one-lap-tracker.update` | Edit OneLap trackers |
| `masters.one-lap-tracker.sync` | Update trackers from OneLap |

**Billing** (`billing`) and **Client payments** (`receipt`)

| Key | Name |
|---|---|
| `billing.view` | View bills |
| `billing.create` | Create bills |
| `billing.update` | Edit bills |
| `billing.approve` | Approve bills |
| `billing.finalise` | Complete bills |
| `billing.cancel` | Cancel bills |
| `billing.print` | Print bills |
| `billing.charge_approve` | Approve extra charges on bills |
| `billing.tax_rule_manage` | Change GST / tax rules |
| `billing.credit_note_create` | Create credit notes |
| `receipt.view` | View client payments |
| `receipt.create` | Add client payments |
| `receipt.approve` | Approve client payments |
| `receipt.cancel` | Cancel client payments |

**Cash planning** (`cashplanning`) and **Ledgers** (`ledger`)

| Key | Name |
|---|---|
| `cashplanning.view` | View cash planning |
| `cashplanning.enter` | Add cash planning amounts |
| `cashplanning.approve` | Approve cash planning |
| `cashplanning.close` | Close the cash planning day |
| `ledger.view` | View ledgers |
| `ledger.voucher_view` | View vouchers |
| `ledger.manage` | Add and edit ledger accounts |
| `ledger.journal_create` | Add journal entries |

**Workshop** (`workshop`)

| Key | Name |
|---|---|
| `workshop.po.view` | View purchase orders |
| `workshop.po.manage` | Create and edit purchase orders |
| `workshop.po.approve` | Approve purchase orders |
| `workshop.inward.view` | View incoming stock |
| `workshop.inward.manage` | Add incoming stock |
| `workshop.jobcard.view` | View job cards |
| `workshop.jobcard.manage` | Create and edit job cards |
| `workshop.jobcard.finalise` | Complete job cards |
| `workshop.servicebill.view` | View service bills |
| `workshop.servicebill.manage` | Create and edit service bills |
| `workshop.servicebill.pay` | Pay service bills |
| `workshop.replacement.view` | View supplier replacements |
| `workshop.replacement.manage` | Create and edit supplier replacements |

**Administration** (`admin`), **Notifications** (`notifications`), **Attachments** (`attachments`)

| Key | Name |
|---|---|
| `admin.rbac.manage` | Manage roles and user access |
| `admin.audit_log.view` | View the audit log |
| `notifications.view` | View notifications |
| `notifications.manage_rules` | Set who gets notified, and when |
| `notifications.manage_templates` | Edit notification messages |
| `notifications.test_send` | Send test notifications |
| `attachments.view` | View attachments |
| `attachments.create` | Upload attachments |
| `attachments.download` | Download attachments |
| `attachments.delete` | Delete attachments |

#### Area names

| Module code | Area name |
|---|---|
| `accounts` | Vendor payments |
| `lorry_receipt` | Lorry receipts (LR) |
| `order` | Orders |
| `trip` | Trips |
| `vehicle_journey` | Vehicle journeys |
| `trip_expense` | Trip expenses |
| `trip_advance` | Driver advances |
| `logslip` | Log slips |
| `vp_schedule` | VP schedule |
| `vp_loading` | VP loading |
| `mrrr` | MR / RR |
| `grn` | GRN at rail head |
| `rail_branch_grn` | GRN at branch |
| `rail_rake_operation` | Rail rake operations |
| `rake_at_rail_head` | Rake & DC/WC at rail head |
| `rake_at_branch` | Rake & DC/WC at branch |
| `delivery_challan` | Delivery challans |
| `ewaybill` | E-way bills |
| `tracking` | Wagon tracking |
| `cashplanning` | Cash planning |
| `billing` | Billing |
| `receipt` | Client payments |
| `ledger` | Ledgers |
| `workshop` | Workshop |
| `admin` | Administration |
| `notifications` | Notifications |
| `attachments` | Attachments |
| `masters.<slug>` | Master data: *Things* |
| `masters.one-lap-tracker` | Master data: OneLap trackers |

### 8.5 How to build it

1. **One label map, in `packages/types`.** Add `src/permission-labels.ts` next to
   `permissions.ts` with the names from §8.4. Type it as
   `Record<every leaf of PERMS, string>`, so adding a permission without a name
   is a compile error. Generate master-data names from the noun table; write the
   rest by hand. Export `permissionLabel(key)`,
   `permissionAreaLabel(moduleCode)` and `permissionAreaOf(key)`, each with a
   readable fallback for unknown keys. Re-export from `src/index.ts`, then
   `pnpm --filter @skerp/types build`.
2. **Edit access drawer.** Rebuild the "Advanced" block as in §8.2:
   - Load all permissions once, using `rbacApi.permissions()` with no module.
   - Load the selected role's keys with `rbacApi.getRole(roleId)` for the "Their role" column.
   - Use `Table`, `Skeleton`, `RadioGroup` and `Collapsible` from `@skerp/ui`.
   - `SearchableModuleSelect.tsx` is no longer needed once the area dropdown replaces it.
3. **Use the same names elsewhere.**
   - **Roles → role detail:** show `permissionLabel(key)` instead of the bare action, and move the raw key chip into a `title` tooltip.
   - **Audit log:** switch `audit-log.format.ts` from its local key-titleizing `permissionLabel` to the shared one.
4. **Page copy.**
   - **User access subtitle:** "Choose what each person can do and which branches they work in."
   - **Column name:** "Branch scope" becomes "Branches".

---

## 9. Screen log

Screens reworked under this guide. Add a row when you finish one.

| Screen | Status | What changed | Key files |
|---|---|---|---|
| Settings → Audit log | Done (`1b4ce98`) | Raw JSON diff replaced by a plain sentence + "Show details" list; IDs resolved to names server-side (roles, users, branches, drivers, vehicles, slips, trips, journeys); filters for activity, person and period; day grouping; click a record for its full history; empty/error states | `features/rbac/AuditLogPage.tsx`, `features/rbac/audit-log.format.ts`, `apps/server/src/modules/admin/audit-log.route.ts` |
| Settings → User access → Edit access | Done | Shared plain permission names; selected-role defaults; database pagination and search across areas; exception summary; branch pickers; loading, retry and save states | `features/rbac/UserAccessDrawer.tsx`, `packages/types/src/permission-labels.ts` |

**Next candidates:** Settings → Roles, Settings → Users, then the master screens
one by one (see `OPUS_UI_SUGGESTIONS.md` §3).