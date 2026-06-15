# LR Hub & Railhead — corrected model

Status: proposed (pending team sign-off — data-model change + migration)

## Why this doc

The current LR implementation conflates two unrelated concepts into one `hubId`
field and forces the "trip split" to be declared when the LR is created. Real
operations work differently. This doc records the corrected model so the schema
change can be reviewed before code.

## The two concepts (they are NOT the same thing)

| | **Hub** | **Railhead** |
|---|---|---|
| What it is | The HO transshipment point — **always Jalgaon**, hardcoded | A branch with a rail head, **user-selected** |
| Applies to | Order LR **and** Instant LR | Order LR **only** |
| Trigger | A road trip gets broken into two legs at Jalgaon | Transport type = Road & Rail |
| Value | Derived from `Branch.isHeadOffice` — never picked | Picked from branches where `Branch.isRailHead = true` |
| Set where | Server-side, by the HO "split at hub" action | In the order LR create/edit form |
| Required? | n/a (set by action) | **Required** when Road & Rail |

## The operational scenario (source of truth)

1. **Pune branch** creates trip Pune→Kolkata and an Instant LR. At this point it
   is a **single direct trip, single LR**. No leg split. No hub. Nobody knows
   Jalgaon will become a hub yet.
2. Driver stops at **Jalgaon (HO)**, drops expenses.
3. **HO (Jalgaon)** edits the *trip*: changes destination to Jalgaon, closes it.
   Then creates a **new trip Jalgaon→Pune** (leg 2).
4. **HO edits the already-FINALISED LR**, runs "split at hub", and attaches the
   leg-2 trip.

Consequences that drive the design:

- **Leg 1 / leg 2 never exist at LR creation.** The split is created *after the
  fact*, by HO. `tripLegType` is therefore a **derived outcome of the split**,
  not a creation-time input.
- **The hub is always Jalgaon** and is decided by the HO action, not the creator.
- The split only happens on a **FINALISED** LR.

## Where the current code is wrong

- `createLRFromOrderSchema` validates `hubId` as "Select a railhead hub for Road
  & Rail" — conflates hub with railhead.
  ([lorry-receipt.schema.ts:148](../packages/validators/src/lorry-receipt/lorry-receipt.schema.ts#L148))
- `LRForm` shows a selectable "Railhead hub" combobox bound to `hubId`
  ([LRForm.tsx:534](../apps/web/features/lorry-receipts/components/LRForm.tsx#L534)).
  Hub should never be selectable.
- `tripLegType` (TO_HUB/FROM_HUB) + a leg-2 trip picker are demanded at creation
  ([LRForm.tsx:567-587](../apps/web/features/lorry-receipts/components/LRForm.tsx#L567-L587)).
  Both legs cannot be known at creation.
- The Instant LR (road-only) flow has no hub wiring at all — the one place the
  Jalgaon split actually applies.

## Target model

### Schema

- `Branch.isHeadOffice Boolean @default(false)` — marks Jalgaon. Hub derives from
  it. (`isRailHead` already exists.)
- `LorryReceipt.railheadBranchId String?` + relation — order LR, Road & Rail only.
- `LorryReceipt.hubId` — **kept**, but now set **only** by the split action, on
  either LR type, always = the `isHeadOffice` branch. Never picked in a form.
- `LorryReceipt.tripLegType` — kept, but becomes a **derived** value set by the
  split action (→ `FROM_HUB`), not a form input.

### Validators

- Order create: drop `hubId`, add `railheadBranchId`. `superRefine`: require
  `railheadBranchId` when `transportType === "RoadAndRail"`. Remove the hub
  refinement.
- Instant create: drop `tripLegType` and `secondaryTripId` from the input.
- New `splitLRAtHubSchema`: `{ secondaryTripId }` — the leg-2 trip.

### Server

- New endpoint: `POST /lorry-receipts/:id/split-at-hub` — guarded by an HO/RBAC
  permission. Asserts LR is **FINALISED**, looks up the `isHeadOffice` branch,
  sets `hubId`, `secondaryTripId`, `tripLegType = FROM_HUB`. Rejects if no
  head-office branch is configured.
- `lrListSelect` / `lrDetailInclude`: add `railheadBranch`.

### Web

- **Order form:** transport type only. Road → nothing extra. Road & Rail →
  railhead branch picker (options filtered to `isRailHead`), **required**. No hub,
  no `tripLegType`, no leg pickers.
- **Instant form:** one trip field labeled "Trip". No `tripLegType` control, no
  leg-2 picker. Created direct.
- **LR detail (finalised):** an HO-only "Split at hub" action that opens a small
  dialog to pick the leg-2 trip and calls the new endpoint.

## Open / assumed

- Hub split is **only** allowed on FINALISED LRs. (confirmed)
- Railhead is **required** for Road & Rail order LRs. (confirmed)
- Exactly one branch should have `isHeadOffice = true` (Jalgaon). Seed/guard to
  enforce singleton — TBD.

## Migration notes

- No backfill — still under development. Existing LR rows can be deleted, so the
  migration does not need to preserve the old `hubId`-as-railhead data.
