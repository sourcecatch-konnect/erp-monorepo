# Job card operating guide

Status: release guidance prepared; use after the finance migrations and role grants are deployed. Start from Finance -> Job Cards; Workshop uses the same records.

## Plan and complete a repair

1. Create a draft with branch, vehicle, driver, repair location, dates/KM, parts/batches and outside services. Save records the plan without issuing stock, posting expense or holding the vehicle.
2. Record the maintenance reason, replacement intent and inspection evidence reference. Check brakes, steering, tyres, lights and leaks; explain attention items. Start repair when work actually begins. This places a maintenance hold on the vehicle.
3. Record repair work and retained evidence. Before release, complete the clearance checklist and confirm roadworthiness. Release clears this card's hold; another active repair keeps the vehicle held. Cancelling the repair control also requires physical clearance, then the draft can be cancelled separately.
4. Set completion time/KM and finalise. Finalisation issues parts and posts their expense once. Outside service expense is posted when its service bill is posted. A new card cannot finalise without recorded clearance. Creating and finalising together requires both completed inspection and clearance information.

In-transit repair does not finish a trip or change ON_TRIP status. A vehicle with an active repair hold cannot be newly dispatched. After starting/releasing repair, vehicle, branch and repair location cannot be changed without cancelling the repair control. Financial undo does not restart physical work or place a hold; explicitly start repair again when necessary. Legacy cards have no fabricated checklist: operations must review existing drafts and start any repairs actually underway.

## Bill and settle outside services

1. Open Service Bills and select eligible unbilled services for one provider/branch. Selections persist across backend pages; confirm the selected lines before posting.
2. Enter invoice details and discount. Active provider invoice numbers are unique across branches within the bill financial year, ignoring case and surrounding spaces. Punctuation/internal spaces remain significant. Discount is allocated exactly across retained line snapshots.
3. From the posted bill, prepare/open its payment slip. Submit through the shared approval workflow. An authorised approver reviews it; an authorised cashier disburses approved cash and/or TDS. Cash plus TDS reduces outstanding; TDS alone is permitted. Payment does not create another repair expense.
4. If correction is needed, use the reasoned payment reversal action. It retains the original voucher and contra and reopens the liability. Release an unpaid active payment reservation before cancelling the bill. Cancelled bills retain snapshots and release source services for rebilling.

Do not repeatedly create a new card or payment after a network timeout. Retry the existing submission while the form remains open; it retains its request identity. Reloading a new-card form creates a new identity, so first check the register for an already-created card.

## Removed parts and corrections

Record removed parts on the finalised card with custody location and inspection/provenance reference. Reusable parts await independent approval of recoverable value before becoming usable stock. Repairable/scrap records remain custody records, with no usable stock or expense credit. Retain evidence for repair receipts, transfers and disposal and use the displayed lifecycle actions. Do not treat a proposed return value as an approved inventory value.

Undo-finalise is restricted by billing/removed-part dependencies. Never delete records or edit database balances to bypass a blocked correction. Use supported reversals and retained evidence, then refer unresolved history to Finance.

## Review and find records

Search waits 400 ms before requesting matching rows. Next/previous requests a bounded page from the backend; the browser does not load the whole register. Filter changes reset to the first page. Use Refresh after external changes.

Use Repair Cost for current recognised parts/net services/return credits, Unbilled Services for operational estimates, Provider Outstanding for current cash-plus-TDS liability, Repair Reconciliation for linked expense journals, and Job Card Finance Audit for stock, settlements, posting periods and Tally follow-up. Bill-age buckets measure age from bill date, not contractual overdue dates. These views do not reconstruct balances at a historical point in time. Tally status is follow-up evidence, not proof that Tally imported a voucher.

When reporting a failure, retain the card/bill/slip number, action, time, displayed error and evidence reference. Do not include passwords, connection strings or personal records in tickets.
