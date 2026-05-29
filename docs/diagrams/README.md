# Diagrams

Visual companions to the architecture docs.

## Files

| File | Purpose |
|---|---|
| `erp-data-flow.drawio` | **Operational data-flow map as role swimlanes** (business language, no dev phases or support plumbing). Eight horizontal lanes — Customer, Sales & Booking, Road Operations, Rail Desk, Destination & Delivery, Accounts & Billing, Workshop & Maintenance, Customer Care & Compliance — with the consignment flowing left->right and dropping between lanes at each handoff (Order -> LR -> Road/Rail movement -> Delivery/POD -> Bill -> Receipt -> Accounts -> Tally). Shows who owns each step and how data crosses teams (detention -> billing, payments -> ledger, damage -> claims). |
| `erp-business-flow-a3.drawio` | **Business-friendly A3 ERP flow**. Higher-level, one-glance view for printing: customer request -> order -> LR -> road/rail movement -> POD -> billing -> receipts -> Tally/reports, with support modules grouped around it. |
| `erp-flow-v2.drawio` | **Detailed single-page module flow map of the entire SKERP**. Shows phases 0-F, every module, key data flows, the Road vs Rail branch, billing/receivables/accounts chain, asset chain, customer-care, and reports. Designed to print on A3. |

## How to open

- **VSCode** - install the *Drawio Integration* extension (Hediet) and open the `.drawio` file directly.
- **Web** - go to [app.diagrams.net](https://app.diagrams.net/), File -> Open from device, pick the file.
- **Desktop** - install drawio desktop and double-click.

## How to print A3

In drawio:
1. `File -> Page Setup` - set Paper Size to **A3**, Orientation **Landscape**.
2. `File -> Print` or `Ctrl+P` - enable **Fit to Page** so any overshoot scales down. One sheet.
3. To export as PDF for sharing: `File -> Export As -> PDF`, "Crop" off, "Fit Page" on, A3 landscape.

## Legend

For `erp-data-flow.drawio`:

- **Each horizontal lane = the team/role that owns those steps.** The consignment flows left->right; arrows that drop into another lane are handoffs between teams.
- Solid arrow = main flow; dashed arrow = payment, support, or exception flow.
- Oval = external party or system (Customer, Tally Prime).
- Box colour follows the lane it sits in. No development phases or foundation/support modules are shown — this is the business operating flow only.

For `erp-business-flow-a3.drawio`:

- Solid arrows = normal business flow.
- Dashed arrows = support, exception, or background flow.
- Rounded boxes = ERP modules.
- Ovals = external people or systems.

For `erp-flow-v2.drawio`:

- **Color = phase**: green (Phase 0 / Foundation), yellow (PA / Ops MVP), blue (PB / Money depth), orange (PC / Rail + Detention), purple (PD / Asset), red/pink (PE / Customer-care + EWB), cyan (PF / Reports).
- **Dashed border / arrow** = secondary, optional, async, or external.
- **Oval (dashed)** = external actor or system (Customer, Tally Prime).
- **Bold-text node** = decision / convergence point, for example LR Finalised, DC Approval, Bill Finalised.

## Maintenance

When a module spec changes materially in `ERP_MODULE_PLAN_V2.md`, also update the diagrams. The plan is the source of truth, but the diagrams should not drift far.
