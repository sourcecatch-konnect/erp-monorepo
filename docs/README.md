# SKERP Documentation

SKERP is the ERP (business software) of **SK Translines**. It runs the transport work, by road and by road + rail, from the customer's order to the money in the books.

## Which file should I read?

Find yourself in the table and read the files **in that order**.

| You are | Read, in this order | Time |
|---|---|---|
| **Anyone new** | 1. [ERP flow](00-overview/erp-flow.md) → 2. [Glossary](00-overview/glossary.md) → 3. [Modules](00-overview/modules.md) | 30 min |
| **Office user** (booking, branch, billing, accounts) | The **Easy guide**, Parts A–C, then the part for your work (see the [list below](#easy-guide)). Also available as **SKERP-Easy-Guide.pdf** | 1–2 hours |
| **Manager / owner** | [Business overview](00-overview/business-overview.md) → [ERP flow](00-overview/erp-flow.md) → [Roles](00-overview/roles.md) → Easy guide [ch. 20: Reports](easy-guide/20-reports-glossary-errors.md) | 45 min |
| **Admin** | [Roles](00-overview/roles.md) → [Settings](user-guide/01-settings.md) → [Masters](user-guide/02-masters.md) | 1 hour |
| **Developer** | Everything for "Anyone new" → [CLAUDE.md](../CLAUDE.md) → [Setup](developer-guide/setup.md) → [Architecture](developer-guide/architecture.md) → [Conventions](developer-guide/conventions.md) → the [module note](#developer-guide) for the area you work on | Half a day |
| **Tester** | Easy guide, Parts A–C. Every chapter ends with a **"Try it yourself"** task | 2 hours |

**The single most important page is [ERP flow](00-overview/erp-flow.md).** If you read only one file, read that.

## All sections

**Start with the Overview.** It explains the business and the full flow in plain words. The other sections go deeper, one module at a time.

| Section | For | What is inside |
|---|---|---|
| [00 · Overview](00-overview/) | Everyone | Business overview, full ERP flow, glossary, list of modules |
| [Easy guide](easy-guide/) | New users | What each part of the ERP is, why it exists and how to use it, in flow order |
| [User guide](user-guide/) *(module by module)* | Office staff, accounts, managers | Step-by-step instructions for each screen |
| [Developer guide](developer-guide/) | Developers | Setup, architecture, conventions, deployment; module notes coming |
| [Background and old plans](#background-and-old-plans) | Developers | Older plans and explainers, kept as history. Some parts may be out of date |

## Overview pages

1. [Business overview](00-overview/business-overview.md): what the company does and who uses the ERP
2. [ERP flow](00-overview/erp-flow.md): how work moves through the system, from start to finish
3. [Glossary](00-overview/glossary.md): meaning of every term (LR, DC, VP, MR/RR, GRN, log slip…)
4. [Modules](00-overview/modules.md): every screen in the menu and what it is for
5. [Roles and permissions](00-overview/roles.md): who can do what

## Easy guide

Every module in simple words: what it is, why it exists, and how to use it. The chapters follow the flow of the work. Built into **SKERP-Easy-Guide.pdf**.

| Part | Chapters |
|---|---|
| **A. Start here** | [1. What is SKERP](easy-guide/01-what-is-skerp.md) · [2. The full flow](easy-guide/02-the-full-flow.md) · [3. Login and screens](easy-guide/03-login-and-screens.md) · [4. Who can do what](easy-guide/04-who-can-do-what.md) |
| **B. Masters** | [5. What is a master](easy-guide/05-what-is-a-master.md) · [6. Each master explained](easy-guide/06-each-master-explained.md) |
| **C. Order to LR** | [7. Orders](easy-guide/07-orders.md) · [8. What is an LR](easy-guide/08-what-is-an-lr.md) · [9. Types of LR](easy-guide/09-types-of-lr.md) · [10. Create and finalise an LR](easy-guide/10-create-and-finalise-an-lr.md) |
| **D. Trucks on the road** | [11. Trips](easy-guide/11-trips.md) · [12. Vehicle journey](easy-guide/12-vehicle-journey.md) · [13. Advances, expenses and log slip](easy-guide/13-expenses-and-log-slip.md) |
| **E. Road + Rail** | [14. Road + Rail](easy-guide/14-road-and-rail.md) |
| **F. Delivery** | [15. Delivery and the signed LR](easy-guide/15-delivery.md) |
| **G. Money** | [16. Billing and receipts](easy-guide/16-billing-and-receipts.md) · [17. Paying transporters, hamali and drivers](easy-guide/17-paying-transporters-hamali-drivers.md) · [18. Books of account](easy-guide/18-books-of-account.md) |
| **H. Others** | [19. Workshop](easy-guide/19-workshop.md) · [20. Reports, glossary and common errors](easy-guide/20-reports-glossary-errors.md) |

## User guide

**My daily work** (one page per role):
- [Booking / operations clerk](user-guide/daily-work/01-booking-clerk.md)

**How to… (one chapter per module):**
1. [Settings: login, users, access and roles](user-guide/01-settings.md)
2. [Masters: the base records](user-guide/02-masters.md)
3. [Orders and Lorry Receipts](user-guide/03-orders-and-lr.md)

## Developer guide

1. [Setup](developer-guide/setup.md): install, environment files, run locally, test vs live database
2. [Architecture](developer-guide/architecture.md): how the project is built and where everything lives
3. [Conventions](developer-guide/conventions.md): rules for money, vouchers, locks, permissions, migrations
4. [Deployment](developer-guide/deployment.md): how live runs on EC2 and how to release

Module notes: [Settings and access](developer-guide/modules/01-settings-and-access.md) · [Masters](developer-guide/modules/02-masters.md) · [Orders and LR](developer-guide/modules/03-orders-and-lr.md) · [Road + Rail](developer-guide/modules/04-road-and-rail.md)

## Background and old plans

These files were written while the ERP was being planned and built. They explain the **why**, but **parts may be out of date**. When they disagree with the pages above or with the code, the pages above and the code win.

| File | Read it when | Note |
|---|---|---|
| [CONTEXT.md](CONTEXT.md) | You want the business background and the reasons behind decisions | Good background |
| [ERP_MODULE_PLAN_V2.md](ERP_MODULE_PLAN_V2.md) | You want the original plan for all modules | A plan: some parts were built differently |
| [TRIP_CLOSE_LOGSLIP_EXPLAINED.md](TRIP_CLOSE_LOGSLIP_EXPLAINED.md) | You want trip → log slip → accounts explained from zero, with numbers | Describes the **old** system. The new ERP uses vehicle journeys |
| [ACCOUNTS_MODULE_MAP.md](ACCOUNTS_MODULE_MAP.md) | You work on accounts | Old ERP vs new ERP |
| [RBAC_PLAN.md](RBAC_PLAN.md) | You work on permissions | Developer detail |
| [MASTER_MODULE_PLAN.md](MASTER_MODULE_PLAN.md) | You build or change a master screen | Developer detail |
| [CURRENT_ORDER_LR_FLOW_GUIDE.md](CURRENT_ORDER_LR_FLOW_GUIDE.md) | You need the long, detailed order → LR flow | Check against the code |

**Skip unless you work on that exact feature** (build plans, kept as history): `ACCOUNTS_LEDGER_BUILD.md`, `ACCT-R1-audit.md`, `CUSTOMER_LEDGER.md`, `G5_DIESEL_HPCL_WALLET_PLAN.md`, `GRN_VPLOADING_PLAN.md`, `LR_DELIVERY_ACKNOWLEDGEMENT_PLAN.md`, `LR_DELIVERY_ACK_PLAN.md`, `LR_GROUP_MULTI_LOADING_PLAN.md`, `LR_HUB_RAILHEAD_PLAN.md`, `TRIP_JOURNEY_LOGSLIP_PLAN.md`, `OPUS_UI_SUGGESTIONS.md`, `UI-UX.md`. `INFO.md` is internal company notes only.

## Other formats

Readers don't need these Markdown files. They get **4 files**:

| File | For |
|---|---|
| **SKERP-Easy-Guide** (PDF / Word) | New users: learn the ERP flow step by step |
| **SKERP-User-Guide** (PDF / Word) | Office staff, accounts, managers |
| **SKERP-Developer-Guide** (PDF / Word) | Developers |
| **SKERP-Reference** (Excel) | Everyone: glossary, modules, statuses, roles, permissions |

Build them with `python docs/tools/build_docs.py`. They go to `docs/exports/`, which is **not committed**. See [tools/README.md](tools/README.md).

## Rules for keeping docs correct

- A change to a feature updates its doc page **in the same pull request**.
- Every page shows **Last checked** at the top.
- A line marked **⚠ Confirm** is still waiting for a business answer. Don't treat it as final.
