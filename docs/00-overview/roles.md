# Roles and permissions

> Last checked: 2026-10-09 · Audience: everyone. Source: default roles in `apps/server/prisma/seed-admin.ts`. The full list of every permission per role is in the **Roles & Permissions** sheet.

## How access works

- Every user has **one role**. A role is a set of **permissions** (e.g. "Pay drivers", "Approve vendor payments").
- An admin can also **give or remove** single permissions for one user (Settings → User access).
- A user sees **all branches**, or only the **branches assigned** to them.
- Menus and buttons a user may not use are **hidden**, and the server refuses the action anyway.

## The 5 default roles

The ERP creates these roles. Admins can edit them, or create new roles, in **Settings → Roles**.

| Role | In short | Can do (main points) | Cannot do |
|---|---|---|---|
| **Admin** | Everything | All permissions, including users, roles and the audit log | — |
| **Branch Manager** | Runs a branch | All masters (add/edit). Orders: approve/reject. LRs: create, approve, deliver, acknowledge. Trips and journeys (incl. chain override). Approve trip expenses. E-way bills. **Approve** bills and receipts | Vendor payments, driver salary, ledgers, workshop |
| **Operations** | Daily booking and movement | View masters. Create/edit orders, LRs, trips, journeys, trip expenses and advances. Deliver LRs. E-way bills | Approvals, billing, accounts, payments |
| **Accounts** | Money and books | View masters (and manage creditors and cash accounts). Acknowledge LRs. Trip expenses: approve/undo. **Log slips** (generate, post). **Billing** (full), **receipts**, **vendor payments** (create, approve, pay), **driver salary and payments**, ledgers and manual journal, cash planning, **workshop** (POs, stock, job cards, service bills) | Create orders/LRs/trips; users and roles |
| **Read-Only Auditor** | Look, don't touch | View almost everything (masters, LRs, trips, journeys, orders, bills, receipts, driver salary, ledgers, workshop) and the **audit log** | Any change |

⚠ Confirm with the owner that these defaults match how the company works, e.g. whether Branch Managers should approve bills.

## Important permissions (money)

| Permission | Who has it by default |
|---|---|
| Approve vendor payments | Admin, Accounts |
| Pay vendors | Admin, Accounts |
| Approve or cancel salary runs | Admin, Accounts |
| Pay drivers | Admin, Accounts |
| Finalise bills | Admin, Accounts |
| Approve receipts | Admin, Branch Manager, Accounts |
| Post log slips to accounts | Admin, Accounts |
| Manual journal | Admin, Accounts |

**Maker-checker:** for vendor payments and salary runs, the person who created a document may be blocked from approving it (a setting).
