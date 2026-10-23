# 17. Paying transporters, hamali and drivers

> Last checked: 2026-10-12 · For: accounts, managers

## Who we pay, and where

| Who | Why we pay them | Screen |
|---|---|---|
| **Transporters** | Freight for **market trucks** we hired | Finance → Vendor Payments |
| **Hamali (labour)** | Loading/unloading at the railhead and branch | Finance → Vendor Payments |
| **Drivers** | Monthly salary, salary advances, log slip balance | Finance → Driver Payments |

All payments follow the same safe pattern: **make → approve → pay**. The person who makes a payment may be blocked from approving it (maker-checker).

## Part 1: Vendor payments (transporters and hamali)

```
 Payment slip (Draft) ──Submit──► Pending approval ──Approve──► Approved ──Disburse──► Partially paid / Paid
                                          └──Reject──► Rejected
```

### Step 1: Make a transporter slip

**Vendor Payments → Payment Slips → new transporter slip.**

1. **Select transporter:** choose the **Transporter**, **Branch** and **From** date.
2. **Select trucks:** the trucks (LR groups) we owe this transporter for. Search by LR no., group no. or vehicle no. Each line shows whether it is **Delivered**.
3. **Review and save:** for each truck the slip shows:

| Line | Meaning |
|---|---|
| **Freight** + **Detention** | What we owe |
| − **Advance**, **Commission**, **Hamali**, **Damage**, **Stationery** | Deductions |
| = **Net payable** | What is left to pay |

Click **Save draft**, or **Save and submit** to send it for approval.

### Step 1 (hamali): Make a hamali slip

**Vendor Payments → new hamali slip.**

1. **Select labour:** choose the **Labour** team, **Branch** and **From** date.
2. **Select sources:** the GRNs where they worked (**Origin GRN** at the railhead, or **Rail Branch GRN** at the destination). Search by GRN no., rake no. or gate no.
3. **TDS and totals:** enter **TDS %**. The ERP shows **Gross hamali** and **Net payable**.

### Step 2: Approve

**Vendor Payments → Approvals.** A manager opens the slip, checks the source lines and totals, then clicks **Approve**, or **Reject** with a reason.

### Step 3: Pay (disburse)

**Vendor Payments → Disbursements → Disburse payment.** Fill:

| Field | What to fill |
|---|---|
| **Amount** | Can be part of the net payable. Can't exceed what is outstanding |
| **Mode** | Bank transfer, Cheque… |
| **Cash / Bank ledger** | Which account the money goes out from |
| **Date** and **Reference no.** | Cheque / UTR number |

Click **Record payment**. The slip shows **Paid so far** and becomes **Partially paid** or **Paid**.

⚠ Known issue (ERP-58): on a truck with several LRs, check the amounts on the slip carefully.

## Part 2: Driver payments

### Salary advance

Money given to a driver **against his salary**. It is deducted in the monthly salary run.

**Driver Payments → Salary Advances → New salary advance.** Fill **Amount**, **Branch**, **Date**, **Mode**, **Paid from** (cash/bank account), **Reference no.**, and an optional **Reason** (e.g. medical). Click **Give advance**.

This is different from a **trip advance** (Chapter 13), which is for road expenses.

### Monthly salary run

The salary sheet for all drivers for one month.

```
 New salary run (Draft) ──Recalculate / edit──► Approve ──► Approved ──Pay salaries──► Paid
```

1. **Driver Payments → Salary Runs → New salary run.** Choose the **Month** and **Branch**, then **Create salary run**.
2. The ERP lists every driver with: **Salary**, **Absent days**, **Earned salary**, **Salary advance** given this month, **Log slip** balance, **Other paid**, amounts carried from earlier months, and **Net pay**.
3. Check each driver. Edit where needed, then click **Recalculate** to refresh from the latest entries.
4. **Approve** the run (a second person, if maker-checker is on).
5. **Pay salaries:** choose the cash/bank account and record the payment.

A driver who left shows a warning. Remove them from the run if they shouldn't be paid.

### Pay a driver directly

**Driver Payments → Pay driver:** for other payments, such as the **log slip balance** we owe a driver (Chapter 13). Fill **Amount**, **Branch**, **Date**, **Mode**, **Paid from** and **Reference no.**

You can't pay more than the cash or bank account holds.

## Common problems

| Problem | Fix |
|---|---|
| Truck not offered on the transporter slip | Check the transporter and **From** date. It may already be on another slip |
| "Exceeds outstanding balance" | Pay only what is still outstanding |
| Can't approve your own slip | Maker-checker: ask another approver |
| Driver missing from the salary run | Check the driver's **joining/leaving date** and branch in the Driver master |

## Try it yourself (test system only)

1. Make a transporter slip for the market truck from Chapter 10 (freight 60,000, advance 30,000). Check **Net payable**.
2. Submit it. Approve it as another user.
3. Disburse ₹10,000. Check the slip shows **Partially paid**.
