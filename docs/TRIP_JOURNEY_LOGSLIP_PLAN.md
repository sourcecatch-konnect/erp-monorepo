# Vehicle Journey, Trip Legs, Log Slip & Accounts Plan

> Purpose: design the new ERP flow for own-vehicle trips from journey start to log slip and accounts posting. This keeps the legacy ERP's real business logic, but replaces hardcoded flags and UI-only rules with explicit lifecycle, configurable rules, auditability, and clean accounting.
>
> Decision confirmed: **Log slip is generated per full multi-leg vehicle journey**, like the legacy LogProcess flow, not per individual trip leg.

---

## 1. Executive Summary

The new ERP should model an own-vehicle movement as:

```text
VehicleJourney = full truck cycle / trip cycle
VehicleTrip    = one city-to-city leg inside the journey
LogSlip        = final settlement for the full journey
```

Example:

```text
Journey: MH19CY-2171 / Driver X / Started from Jalgaon

Leg 1: Jalgaon -> Ranjangaon
Leg 2: Ranjangaon -> Howrah
Leg 3: Howrah -> Jalgaon

Log Slip: generated after the journey returns/closes
```

This improves the legacy ERP by making the lifecycle explicit:

```text
Start Journey -> Add Legs -> Capture Expenses -> Close Legs -> Return/Close Journey -> Generate Log Slip -> Post Accounts -> Tally
```

The key design improvement is to avoid legacy-style hardcoded rules such as `cityId == 9`. Instead, base/return locations must be configurable per branch/company.

---

## 2. What Legacy Did That We Should Keep

The old ERP had the right business idea:

- A truck journey can contain multiple trip legs.
- The first leg starts from base/HO.
- Each next leg starts where the previous leg ended.
- The journey completes when the vehicle returns to base/HO.
- Log slip is generated after the journey is complete.
- Log slip consolidates freight, advances, diesel, expenses, driver settlement, vehicle P&L, and accounting entries.

Legacy concepts map to the new design like this:

| Legacy | New ERP |
|---|---|
| `LGST_LogProcess` | `VehicleJourney` |
| `LGST_Trip` | `VehicleTrip` / trip leg |
| `Isfirst` | `VehicleTrip.sequenceNo = 1` or `isFirstLeg` derived |
| `Islast` | last completed leg on journey closure |
| `IsTripCompleted` | `VehicleTrip.status = CLOSED` |
| `IsProcessCompleted` | `VehicleJourney.status = RETURNED / READY_FOR_LOGSLIP` |
| `IsLogGenerated` | `LogSlip.status = GENERATED / POSTED` |
| hardcoded Jalgaon city id | configurable `returnBranchId` / `returnCityId` |

---

## 3. What We Should Improve

### 3.1 Replace Flags With Lifecycle Statuses

Legacy used several booleans and tinyint flags. The new ERP should use readable statuses.

Vehicle journey statuses:

```text
DRAFT
ACTIVE
RETURNED
READY_FOR_LOGSLIP
SETTLED
REOPENED
CANCELLED
```

Trip leg statuses:

```text
PLANNED
IN_TRANSIT
ARRIVED
UNLOADING_DONE
CLOSED
CANCELLED
```

Log slip statuses:

```text
DRAFT
GENERATED
POSTED_TO_ACCOUNTS
TALLY_SYNCED
REOPENED
CANCELLED
```

### 3.2 Configurable Base / Return Rule

Do not hardcode Jalgaon.

Add configurable journey rules:

```text
homeBranchId
startCityId
returnCityId
allowNonBaseClosure
requireApprovalForNonBaseClosure
allowMultipleOpenJourneysPerVehicle = false
```

For SK v1, Jalgaon can be configured as the normal return base, but the code must not know Jalgaon specially.

### 3.3 Backend-Enforced Chain Rules

Legacy relied heavily on UI JavaScript. New ERP must enforce rules in server services:

```text
one active journey per own vehicle
one active journey per driver unless override permission
next leg from city = previous leg to city
next opening KM = previous closing KM + 1, unless approved exception
next start time > previous close time
cannot generate log slip while any leg is open
cannot post accounts before log slip is generated
cannot reopen posted log slip without permission and reason
```

### 3.4 Proper Audit And Reopen Flow

Legacy reopens log slips by changing `IsLogGenerated = 0`. New ERP must record:

```text
who reopened
when reopened
reason
old status
new status
which accounting entries were reversed or regenerated
```

---

## 4. Domain Model Plan

### 4.1 VehicleJourney

Represents the full own-vehicle cycle.

Fields:

```text
id
journeyNumber
fyCode
vehicleId
driverId
homeBranchId
startBranchId
returnBranchId
startCityId
returnCityId
currentCityId
openingKm
closingKm
startedAt
closedAt
status
settlementStatus
logSlipId
createdById
updatedById
createdAt
updatedAt
deletedAt
version
```

Recommended enums:

```text
VehicleJourneyStatus:
  DRAFT
  ACTIVE
  RETURNED
  READY_FOR_LOGSLIP
  SETTLED
  REOPENED
  CANCELLED

VehicleJourneySettlementStatus:
  NOT_READY
  PENDING_REVIEW
  READY
  GENERATED
  POSTED
  TALLY_SYNCED
```

Important indexes:

```text
vehicleId + status
journeyNumber unique
fyCode
homeBranchId
settlementStatus
```

Uniqueness rule:

```text
Only one non-cancelled ACTIVE/RETURNED/READY_FOR_LOGSLIP journey per vehicle.
```

---

### 4.2 VehicleTrip Changes

The repo already has `VehicleTrip`. Extend it rather than replacing it.

Add fields:

```text
journeyId
sequenceNo
fromCityId
toCityId
fromBranchId
toBranchId
legType
movementKind
isReturnLeg
isBaseClosureLeg
arrivalDateTime
unloadingCompletedAt
closedById
closeReason
```

Existing useful fields to retain:

```text
vehicleId
driverId
routeId
tripNumber
tripName
tripType
onwardFreight
openingKm
closingKm
startDateTime
endDateTime
isTripEmpty
status
```

Recommended `legType`:

```text
LR
DC
EMPTY
LOCAL
RETURN
WORKSHOP
OTHER
```

Rules:

```text
sequenceNo starts at 1 per journey
sequenceNo cannot repeat inside a journey
leg 1 starts from journey startCityId
leg N starts from leg N-1 toCityId
closingKm >= openingKm
```

---

### 4.3 TripCargoLink

A trip leg may carry one or more operational documents, but v1 can begin with one LR group per leg if business wants simplicity.

Fields:

```text
id
tripId
journeyId
cargoType: LR_GROUP | LR | DC | EMPTY
lrGroupId
lorryReceiptId
deliveryChallanId
isReturnFreight
loadedWeight
packageCount
remarks
createdAt
```

Why separate this from `VehicleTrip`:

- Allows future multi-LR or DC linkage.
- Keeps empty trips clean.
- Lets log slip print all carried documents per leg.

---

### 4.4 TripUnloadingPoint

The repo already has `TripUnloadingPoint`. Make it operationally meaningful.

Fields to use/extend:

```text
id
vehicleTripId
sequence
cityId
locationId
plannedDate
actualArrivalAt
actualUnloadingAt
actualDepartureAt
receivedQty
damageQty
shortageQty
remarks
proofAttachmentId
```

Rules:

```text
Trip cannot close unless required unloading points are completed.
Damage/shortage should trigger claim or LR acknowledgement workflow where applicable.
```

---

### 4.5 DriverAdvance

Driver advances should not be just a number on trip. They are money events.

Fields:

```text
id
journeyId
tripId
driverId
vehicleId
amountPaise
paymentMode: CASH | BANK | CARD | UPI
cashAccountId
cardLedgerId
paidAt
paidById
narration
journalEntryId
status: DRAFT | POSTED | REVERSED
createdAt
```

Posting:

```text
Dr Driver Advance / Vehicle Ledger
Cr Cash / Bank / Card Ledger
```

The exact debit ledger must be finalized with the Accounts module, but the transaction should be posted through the shared JournalPostingService.

---

### 4.6 TripExpense

Captures all journey/trip expenses.

Fields:

```text
id
journeyId
tripId
expenseTypeId
amountPaise
paymentMode: CASH | CARD | CREDIT | BANK | UPI
cityId
pumpId
fuelCardLedgerId
dieselQty
dieselRatePaise
expenseDate
receiptNo
attachmentId
paidByDriver
remarks
status: DRAFT | APPROVED | REJECTED | POSTED | REVERSED
journalEntryId
createdById
approvedById
createdAt
updatedAt
```

Expense examples:

```text
Diesel
Toll
Parking
Food
Repair
Fine
Loading / unloading support
Miscellaneous
```

Posting behavior:

| Payment Mode | Behavior |
|---|---|
| Cash paid from driver advance | Record now, settle at log slip |
| Credit pump diesel | Dr Diesel Expense, Cr Pump Ledger |
| Card/fuel card | Dr Expense, Cr Card/Fuel Ledger |
| Bank/UPI direct | Dr Expense, Cr Bank Ledger |

---

### 4.7 LogSlip

The final settlement document for a VehicleJourney.

Fields:

```text
id
journeyId
logSlipNumber
fyCode
logSlipDate
status
vehicleId
driverId
openingKm
closingKm
totalKm
totalDays
totalFreightPaise
totalAdvancePaise
totalDieselQty
totalDieselAmountPaise
totalCashExpensePaise
totalCreditExpensePaise
totalExpensePaise
netVehicleResultPaise
driverExpensePaise
driverReceivablePaise
driverPayablePaise
previousDieselQty
dieselRatePaise
standardAverage
actualAverage
shortDieselQty
remarks
generatedById
generatedAt
postedJournalEntryId
postedAt
reopenedById
reopenedAt
reopenReason
createdAt
updatedAt
version
```

Derived calculations:

```text
totalKm = closingKm - openingKm + 1
actualAverage = totalKm / totalDieselQty
expectedDiesel = totalKm / standardAverage
shortDieselQty = totalDieselQty + previousDieselQty - expectedDiesel
netVehicleResult = totalFreight - totalExpenses
driverReceivable = max(totalAdvance - driverCashExpenses, 0)
driverPayable = max(driverCashExpenses - totalAdvance, 0)
```

---

### 4.8 LogSlipLine / Settlement Snapshot

Store snapshot lines so log slip remains historically stable even if trip/expense data changes later.

Fields:

```text
id
logSlipId
lineType: TRIP_FREIGHT | ADVANCE | DIESEL | EXPENSE | DRIVER_SETTLEMENT | ADJUSTMENT
sourceType
sourceId
description
quantity
ratePaise
amountPaise
metadataJson
```

Why:

- Print is stable.
- Reopen can compare old vs new.
- Accounts can audit exact source rows.

---

## 5. Operations Workflow

### 5.1 Start Journey

User selects:

```text
vehicle
driver
home branch
start city / branch
opening KM
start date/time
first route / trip leg
```

System validates:

```text
vehicle ownership = own vehicle
vehicle status = AVAILABLE
driver status = AVAILABLE
vehicle docs not expired
no active journey for vehicle
opening KM >= vehicle current KM
```

Result:

```text
VehicleJourney ACTIVE
Vehicle status ON_TRIP
Driver active assignment
First VehicleTrip created as sequenceNo = 1
```

---

### 5.2 Add Trip Leg

User chooses:

```text
LR trip / DC trip / Empty trip / Return trip
route or from/to city
linked LR group / DC / no cargo
onward freight
advance if any
```

System auto-suggests:

```text
fromCity = previous leg toCity
openingKm = previous leg closingKm + 1
startDateTime = after previous leg endDateTime
```

If user changes continuity fields, require:

```text
exception reason
permission: trip.override_chain
```

---

### 5.3 Dispatch Leg

A planned leg becomes in-transit when cargo is attached/finalised or operator dispatches it.

Effects:

```text
VehicleTrip status IN_TRANSIT
VehicleJourney currentCity remains previous city until arrival
LR group/trip relation locked for movement
```

---

### 5.4 Capture Expenses

Expenses can be entered:

```text
before close
while in transit
during settlement review, with permission
```

UI should support quick entry:

```text
Diesel
Toll
Parking
Food
Repair
Other
```

For diesel:

```text
pump
quantity
rate
amount auto-calculated
payment mode
receipt attachment
```

---

### 5.5 Close Leg / Unloading

Close leg requires:

```text
arrival/end date-time
closing KM
unloading completion if applicable
remarks if empty or exception
```

System updates:

```text
VehicleTrip CLOSED
TripUnloadingPoint actual fields
VehicleJourney currentCity = leg toCity
Vehicle currentKM = closingKm
```

If leg destination equals journey return city:

```text
VehicleJourney RETURNED
VehicleJourney closingKm = leg closingKm
VehicleJourney closedAt = leg endDateTime
settlementStatus = PENDING_REVIEW
```

---

### 5.6 Settlement Review

Before log slip generation, operations/accounts review:

```text
all legs closed
all expenses approved or intentionally excluded
all advances posted
odometer continuity
diesel quantities and averages
unloading/delivery issues
driver cash balance
```

Output:

```text
VehicleJourney READY_FOR_LOGSLIP
LogSlip DRAFT snapshot created
```

---

### 5.7 Generate Log Slip

User enters/reviews:

```text
log slip date/time
previous diesel qty
diesel rate if needed
remarks
```

System freezes snapshot:

```text
LogSlip GENERATED
logSlipNumber assigned
LogSlipLines stored
VehicleJourney settlementStatus GENERATED
```

---

### 5.8 Post Accounts

Accounts user posts the generated log slip.

System creates journal entries:

```text
cash/credit expenses
vehicle result
advance settlement
driver payable/receivable
```

Result:

```text
LogSlip POSTED_TO_ACCOUNTS
VehicleJourney SETTLED
Vehicle available only after settlement policy is satisfied, or immediately after return if SK prefers operational release earlier
```

Recommended policy:

```text
Vehicle becomes AVAILABLE on physical return.
Journey remains READY_FOR_LOGSLIP until settlement.
```

---

## 6. UI Plan

Follow the repo design rules:

- Use `@skerp/ui` primitives.
- No raw tables.
- No raw colors.
- No oversized rounded cards.
- Dense operational layout, not marketing UI.

### 6.1 Journey Cockpit

Route:

```text
/vehicle-journeys
```

Tabs:

```text
Active
Returned
Ready for Log Slip
Settled
Exceptions
```

Table columns:

```text
Journey No
Vehicle
Driver
Current route chain
Current city
Started at
Opening KM
Last closing KM
Status
Settlement status
Next action
```

Useful filters:

```text
vehicle
driver
branch
status
settlement status
date range
```

Primary actions:

```text
Start Journey
Add Leg
Close Leg
Review Log Slip
```

---

### 6.2 Journey Detail

Route:

```text
/vehicle-journeys/:id
```

Layout:

```text
Header summary
Journey timeline
Trip legs table
Expenses tab
Advances tab
Unloading tab
Log slip tab
Accounting tab
Audit tab
```

Header summary fields:

```text
journeyNumber
vehicleNumber
driverName
status
settlementStatus
openingKm
closingKm
totalKm
startedAt
closedAt
```

Timeline:

```text
Jalgaon -> Pune -> Howrah -> Jalgaon
```

Each node shows:

```text
arrival time
closing KM
linked LR/DC
expense warning
```

---

### 6.3 Start Journey Dialog

Fields:

```text
vehicle
driver
home branch
start city
return city
opening KM
start date/time
first leg route
first leg type
```

Validation messages:

```text
Vehicle already has active journey
Driver already assigned
Vehicle document expired
Opening KM below current KM
```

---

### 6.4 Add Leg Dialog

Fields:

```text
leg type
from city, auto-filled
route / to city
LR group or DC selector
is empty trip
onward freight
advance amount
planned start time
opening KM
remarks
```

UX improvements:

```text
show previous leg destination
show suggested opening KM
show warning when user breaks continuity
```

---

### 6.5 Close Leg Dialog

Fields:

```text
end date/time
closing KM
unloading actual date/time
received qty / damage / shortage if applicable
remarks
receipt/proof attachment
```

If destination is return base, show confirmation:

```text
This leg returns the vehicle to base. Closing it will mark the journey ready for log slip review.
```

---

### 6.6 Expense Drawer

Open from journey detail or leg row.

Fields:

```text
trip leg
expense type
amount
payment mode
city
pump / fuel card when diesel
qty
rate
bill number
attachment
remarks
```

Show running totals:

```text
cash expenses
diesel expenses
credit expenses
unapproved expenses
```

---

### 6.7 Log Slip Workbench

Route:

```text
/vehicle-journeys/:id/log-slip
```

Sections:

```text
Journey summary
Trip freight lines
Advances
Diesel
Other expenses
Driver settlement
Vehicle P&L
Accounting preview
Warnings
```

Actions:

```text
Refresh draft
Generate log slip
Post to accounts
Print
Reopen
```

Only one primary action should be visible based on status.

---

### 6.8 Log Slip Print

The print should include:

```text
log slip number
vehicle
driver
start date/time
return date/time
opening KM
closing KM
total KM
total days
average
standard average
short diesel
trip-wise LR/DC details
freight
advance
diesel details
expense details
driver receivable/payable
net vehicle result
prepared by
posted status
```

---

## 7. Accounts Plan

### 7.1 Ledger Core Dependency

Before log slip accounting is production-ready, build or reuse:

```text
Ledger
JournalEntry
JournalEntryLine
JournalPostingService
Tally export/sync status
```

All trip/log-slip postings must go through one posting service. Do not scatter account entry logic inside trip routes.

---

### 7.2 Posting Events

#### Driver Advance

```text
Dr Driver Advance / Vehicle Ledger
Cr Cash / Bank / Card
```

#### Onward Freight Accrual

Legacy posted this at trip creation. New ERP has two options:

Option A: post at leg dispatch.
Option B: post only at log slip finalization.

Recommendation for v1:

```text
Record onward freight on trip leg.
Post consolidated log slip result during log slip posting.
```

Reason:

- Avoids noisy entries if trips are edited/cancelled.
- Keeps log slip as the official settlement point.
- Easier to audit.

If SK wants Tally to reflect trip freight immediately, add dispatch-time accrual later.

#### Credit Diesel / Credit Expense

```text
Dr Diesel / Expense Ledger
Cr Pump / Vendor / Card Ledger
```

Can be posted immediately once approved.

#### Cash Expense From Driver Advance

```text
No immediate cash posting.
Included in driver settlement at log slip.
```

#### Log Slip Posting

Log slip posting should generate balanced journal entries for:

```text
vehicle P&L
expense consolidation
driver receivable/payable
adjustments
```

Exact ledger mapping must be configured, not hardcoded.

---

### 7.3 Driver Settlement

Calculate:

```text
totalDriverAdvance = sum(driver advances)
driverCashExpenses = sum(cash expenses paid by driver)
```

If advance > cash expenses:

```text
Driver receivable = advance - cash expenses
```

If expenses > advance:

```text
Driver payable = cash expenses - advance
```

UI must show this clearly before posting.

---

### 7.4 Tally

After journal entries are posted:

```text
Tally status = PENDING
```

Tally export/sync should support:

```text
manual XML export
live HTTP transfer later
retry failed voucher
store Tally master id
alter existing voucher on repost/reopen
```

---

## 8. Permissions

Add permissions to the typed registry.

```text
vehicle_journey.view
vehicle_journey.create
vehicle_journey.update
vehicle_journey.close
vehicle_journey.cancel
vehicle_journey.override_chain

trip.view
trip.create
trip.dispatch
trip.close
trip.cancel

trip_expense.view
trip_expense.create
trip_expense.approve
trip_expense.reverse

trip_advance.view
trip_advance.create
trip_advance.reverse

logslip.view
logslip.generate
logslip.post_accounts
logslip.reopen
logslip.print

accounts.journal.view
accounts.journal.post
accounts.tally.sync
```

Role suggestion:

| Role | Access |
|---|---|
| Operations | create journey, add/close legs, expenses |
| Branch Manager | override chain, approve exceptions |
| Accounts | review/generate/post log slip |
| Admin | reopen, reverse, configure rules |
| Auditor | view only |

---

## 9. API Plan

Server module folders:

```text
apps/server/src/modules/vehicle-journey/
apps/server/src/modules/trip-expense/
apps/server/src/modules/log-slip/
apps/server/src/modules/accounts-ledger/
```

Endpoints:

```text
GET    /vehicle-journeys
POST   /vehicle-journeys
GET    /vehicle-journeys/:id
POST   /vehicle-journeys/:id/add-leg
POST   /vehicle-journeys/:id/close-leg/:tripId
POST   /vehicle-journeys/:id/mark-ready-for-log-slip
POST   /vehicle-journeys/:id/cancel

POST   /trip-expenses
PATCH  /trip-expenses/:id
POST   /trip-expenses/:id/approve
POST   /trip-expenses/:id/reverse

GET    /log-slips/:journeyId/preview
POST   /log-slips/:journeyId/generate
POST   /log-slips/:id/post-accounts
POST   /log-slips/:id/reopen
GET    /log-slips/:id/pdf
```

Validators:

```text
packages/validators/src/vehicle-journey/
packages/validators/src/trip-expense/
packages/validators/src/log-slip/
```

Types:

```text
packages/types/src/vehicle-journey/
packages/types/src/log-slip/
```

---

## 10. Frontend Plan

Feature folders:

```text
apps/web/features/vehicle-journeys/
apps/web/features/trip-expenses/
apps/web/features/log-slips/
```

Pages:

```text
/vehicle-journeys
/vehicle-journeys/new
/vehicle-journeys/:id
/vehicle-journeys/:id/log-slip
/log-slips
/log-slips/:id
```

Key components:

```text
VehicleJourneyListPage
VehicleJourneyDetail
JourneyTimeline
TripLegTable
StartJourneyDialog
AddLegDialog
CloseLegDialog
TripExpenseDrawer
AdvanceDialog
LogSlipWorkbench
LogSlipPreviewTable
AccountingPreview
```

Use TanStack Query for server data and `@skerp/ui` for all controls.

---

## 11. Reports

Add reports after the transactional flow works:

```text
Active Vehicle Journey Report
Pending Log Slip Report
Journey P&L Report
Driver Settlement Report
Vehicle Diesel Average Report
Expense Exception Report
Reopened Log Slip Audit Report
Vehicle Utilization Report
```

Pending log slip rule:

```text
VehicleJourney status in RETURNED / READY_FOR_LOGSLIP
and no generated/posted log slip
```

---

## 12. Implementation Phases

### Phase 1: Schema & Lifecycle

- Add `VehicleJourney`.
- Link `VehicleTrip` to `VehicleJourney`.
- Add statuses and sequence fields.
- Add journey number generation through `DocumentSequence`.
- Add backend chain validation.

Acceptance:

```text
Can start journey.
Can add sequential trip legs.
System blocks second active journey for same vehicle.
System enforces city/KM/time continuity.
```

### Phase 2: Journey UI

- Build journey cockpit.
- Build journey detail page.
- Build start/add/close dialogs.
- Show route chain timeline.

Acceptance:

```text
Operator can manage full multi-leg journey from one screen.
No need to jump between isolated trip pages.
```

### Phase 3: Expenses & Advances

- Add `TripExpense`.
- Add `DriverAdvance`.
- Add expense drawer and advance dialog.
- Add approval flow for expenses if required.

Acceptance:

```text
Expenses and advances appear in journey totals.
Diesel qty/rate are captured.
Receipts can be attached.
```

### Phase 4: Close Journey & Log Slip Preview

- Close leg behavior updates journey current city.
- Returning to base marks journey returned.
- Build log slip preview calculations.
- Create draft snapshot.

Acceptance:

```text
Journey becomes ready for log slip only after all legs are closed and return condition is met.
Preview shows freight, expense, diesel, driver settlement, and vehicle result.
```

### Phase 5: Log Slip Generation & Print

- Generate log slip number.
- Freeze LogSlip and LogSlipLine snapshots.
- Build PDF/print view.
- Add reopen flow with audit.

Acceptance:

```text
Generated log slip is stable and printable.
Reopen requires permission and reason.
```

### Phase 6: Accounts Posting

- Build ledger core if not already built.
- Build posting templates.
- Post driver advances, approved credit expenses, and log slip settlement.
- Add accounting preview before posting.

Acceptance:

```text
Every posted log slip has balanced journal entries.
Accounts can trace each entry back to journey/log slip/expense.
```

### Phase 7: Tally & Reports

- Add Tally export/sync status.
- Add pending log slip and driver settlement reports.
- Add vehicle P&L and diesel average reports.

Acceptance:

```text
Accounts can export or sync log slip vouchers to Tally.
Management can see pending settlements and vehicle performance.
```

---

## 13. Open Questions To Resolve During Build

These are not blockers for planning, but must be decided before final accounting implementation:

1. Should onward freight be posted at dispatch or only at log slip posting?
   - Recommendation: only at log slip posting for v1.
2. Which exact ledgers should be used for driver advance and vehicle settlement?
   - Needs Accounts module ledger mapping.
3. Should vehicle become available immediately after physical return, or only after log slip posting?
   - Recommendation: available after physical return; settlement stays pending.
4. Should expenses require approval before log slip generation?
   - Recommendation: yes for credit/card expenses; optional for small cash expenses.
5. Should non-base journey closure be allowed?
   - Recommendation: allowed only with permission and reason.

---

## 14. Non-Negotiable Build Rules

- No hardcoded Jalgaon/HO IDs.
- No accounting writes inside random trip handlers.
- No string-packed allocation values like legacy `RefNo$Amount`.
- No generated log slip mutation without audit.
- No UI-only enforcement of chain rules.
- No log slip generation while open legs exist.
- Money stored as BigInt paise to match current repo convention.
- Use shared validators and typed API responses.
- Use repo design system and `@skerp/ui` components.

---

## 15. Success Definition

This module is successful when operations and accounts can handle this real scenario end to end:

```text
Truck starts from Jalgaon.
Carries LR load to City A.
Takes another load from City A to City B.
Returns or closes at configured base.
All advances, diesel, tolls, and expenses are captured.
Log slip preview calculates freight, expenses, diesel average, driver balance, and vehicle result.
Accounts generates and posts the log slip.
The voucher is ready for Tally.
Vehicle and driver history are auditable.
```
