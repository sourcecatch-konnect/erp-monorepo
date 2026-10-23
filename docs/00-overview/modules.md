# Modules (menu by menu)

> Last checked: 2026-10-09 · Audience: everyone. Source: the sidebar menu (`apps/web/config/navigation.ts`).

**Status:** ✅ in use · ⚠ partly built · ❌ planned

| Menu section | Menu item | What it is for | Main users | Status |
|---|---|---|---|---|
| Overview | Dashboard | Starting page | All | ✅ |
| Operations | Orders | Customer orders for trucks; freight from the rate matrix; approval | Booking | ✅ |
| Operations | Lorry Receipts | LR groups and LRs (one group per truck), own or market truck, road or road + rail | Booking | ✅ |
| Operations | Deliveries | Mark LRs delivered; acknowledge the signed LR | Branch | ✅ |
| Operations | LR Unloading Report | Unloading details per LR | Branch, managers | ✅ |
| Operations | VP Management → VP Schedule | Plan wagons per date and route | Rail team | ✅ |
| Operations | VP Management → VP Loading | Load goods into wagons; creates the rake | Rail team | ✅ |
| Operations | VP Management → MR / RR | Railway Receipt rows per wagon | Rail team | ✅ |
| Operations | VP Management → GRN At Rail Head | Goods received at the railhead | Rail team | ✅ |
| Operations | VP Management → GRN At Branch | Goods received from wagons at the destination | Branch | ✅ |
| Operations | VP Management → Rake & DC/WC (rail head / branch) | Rake dispatch, arrival, unloading | Rail team | ✅ |
| Operations | VP Management → Delivery Challans | Put goods on a delivery truck (LDC freight, advance) | Branch | ✅ |
| Operations | E-Way Bills | E-way bill dashboard and inbox | — | ⚠ test data only, not in scope yet |
| Container | Trips | Trips of own trucks | Operations | ✅ |
| Container | Vehicle Journeys | Full rounds of own trucks; legs; expenses; log slip | Operations, accounts | ✅ |
| Container | Wagon Tracking | Live GPS map (OneLap) | Rail team | ✅ |
| Master Data | Masters | All base records: places, fleet, parties, rates & rail, goods & spares, company & cash accounts | Admin, managers | ✅ |
| Finance | Billing & Receipts → LR to Bill | LRs ready to bill | Billing | ✅ |
| Finance | Billing & Receipts → Billing Register | Bills (GST), approval, finalise, credit notes | Billing | ✅ |
| Finance | Billing & Receipts → Client Receipts | Customer payments against bills | Accounts | ✅ |
| Finance | Vendor Payments → Payment Slips | Transporter and hamali payment slips | Accounts | ✅ (known bug ERP-58 on multi-LR trucks) |
| Finance | Vendor Payments → Approvals | Approve or reject slips | Managers | ✅ |
| Finance | Vendor Payments → Disbursements | Pay approved slips | Accounts | ✅ |
| Finance | Driver Payments → Salary Runs | Monthly driver salary: create, edit, approve, pay | Accounts | ✅ |
| Finance | Driver Payments → Salary Advances | Advances against salary | Accounts | ✅ |
| Finance | Driver Payments → Driver Payments | Other payments to drivers | Accounts | ✅ |
| Finance | Cash & Bank → Cash Planning | Daily money view | Accounts | ⚠ partly connected to the books |
| Finance | Cash & Bank → Opening Balances | Starting balance of cash and bank accounts | Accounts | ✅ |
| Finance | Books of Account → Ledgers | Ledger statements | Accounts | ✅ |
| Finance | Books of Account → Day Book | All vouchers by date | Accounts | ✅ |
| Finance | Books of Account → Manual Journal | Manual accounting entries | Accounts | ✅ |
| Finance | Books of Account → Chart of Accounts | List of ledgers | Accounts | ✅ |
| Reports | Vehicle Reports → Vehicle P&L | Profit per truck | Managers, owner | ✅ |
| Reports | Vehicle Reports → Vehicle Performance | Monthly sheet per truck, freight difference | Managers, owner | ✅ |
| Reports | Vehicle Reports → Vehicle Costs | Monthly fixed costs per truck (EMI, insurance…) | Accounts | ✅ |
| Workshop | Purchase Orders | Order spare parts | Store | ✅ |
| Workshop | Inward Stock | Receive parts into stock | Store | ✅ |
| Workshop | Stock | Stock on hand; low-stock badge | Store | ✅ |
| Workshop | Job Cards | Repairs: parts and service per vehicle | Workshop | ✅ |
| Workshop | Service Bills | Outside workshop bills and their payment | Workshop, accounts | ✅ |
| Workshop | Supplier Replacement | Parts returned or replaced by suppliers | Store | ✅ |
| Account | Notifications / preferences | Your alerts and alert settings | All | ✅ |
| Administration | Settings → Profile, Users, User access, Roles, Notifications, Audit log | Users, permissions, alert rules, history of changes | Admin | ✅ |

## Planned or partly built (not in the menu yet)

| Area | Status |
|---|---|
| DC detention + LDC broker payment (detention slabs) | ❌ planned |
| Tally export | ❌ planned |
| Trip advances and diesel posted to cash/bank | ⏸ waiting for the accountant |
| Claims / damage settlement | ❌ planned |
| Customer complaints | ❌ planned |
| Vehicle documents (permit, fitness, PUC) and alerts | ❌ planned (only insurance date today) |
