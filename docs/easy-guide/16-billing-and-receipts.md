# 16. Billing and receipts

> Last checked: 2026-10-12 · For: billing team, accounts

## The idea

Once the signed LR is acknowledged (Chapter 15), we can **bill** the customer and later **record the payment**.

```
 Acknowledged LRs ──► LR to Bill ──► Bill (Draft) ──Approve──► Approved ──Finalise──► Finalised
        ──► customer pays ──► Client Receipt ──Approve and post──► Posted ──► bill Paid
```

## Part 1: Make a bill

**Menu: Finance → Billing & Receipts → LR to Bill.** This screen shows every LR that is **ready to bill**.

### Step 1: Fill the bill information

| Field | What to fill |
|---|---|
| **Client** | The customer to bill |
| **Bill Date** / **Due Date** | Invoice date and payment due date |
| **Bill Head** | Which branch/company bills it |
| **Place of Supply** | The state, for GST |
| **Transport Type** | Road or Road & Rail |
| **Include LRs up to** | Only show LRs up to this date |
| **Remarks** | Optional invoice remarks |

### Step 2: Select the LRs

Tick the LRs to put on this bill. They must all belong to **one branch**. Search by LR number, group, route or customer.

### Step 3: Add charges (if any)

Besides freight, you can add charges such as **Detention**, **Hamali** or a **Freight addition**, or a **deduction**. Each needs an amount and a **reason**.

### Step 4: Create the bill

The bill is created as a **Draft invoice**. The **Bill Summary** shows freight, charges, GST and the total.

## Part 2: Approve and finalise

Open the bill (**Billing Register**):

| Button | What it does | Who |
|---|---|---|
| **Approve bill** | Checker confirms the bill is correct | Branch Manager, Accounts |
| **Return to draft** | Sends it back for changes | Approver |
| **Finalise invoice** | Locks the bill, gives the **final bill number**, and **posts the sales voucher** (the customer now owes us) | Accounts |
| **Print / PDF** | Download, print or preview the **tax invoice** | Anyone with access |
| **Cancel bill** | Cancels it (with a reason). Not allowed once any payment is received | Approver |
| **Credit/Debit Note** | Reduce (credit) or increase (debit) a finalised bill, e.g. for a rate difference or damage | Accounts |

### Bill statuses

| Status | Meaning |
|---|---|
| **Draft** | Being prepared. Can be changed |
| **Pending review** | Waiting for the checker |
| **Approved** | Checked, not yet final |
| **Finalised** | Final bill number given. Posted to the books |
| **Sent** | Sent to the customer |
| **Partially paid** / **Paid** | Customer has paid part / all of it |
| **Cancelled** | Cancelled |

## Part 3: Record the customer's payment (Client Receipt)

**Menu: Finance → Billing & Receipts → Client Receipts → New.**

### Step 1: Select client

Choose the customer. Their **outstanding bills** appear.

### Step 2: Select bills and enter amounts

Tick the bills this payment is for. For each bill enter the **Received** amount. Also enter any **TDS** deducted by the customer (TDS section, e.g. 194C, and certificate no.), **Rate difference** or **Damage** deductions. Search by bill number, LR number or truck number. Selected bills must belong to one branch.

### Step 3: Payment details

| Field | What to fill |
|---|---|
| **Date** | When the money came |
| **Payment mode** | How it was paid |
| **Received into** | Which cash or bank account |
| **Reference no.** | Cheque / UTR number |
| **Remark** | Optional |

Click **Confirm payment**.

### Step 4: Approve and post

A draft receipt needs **Approve and post**. This posts the **receipt voucher** (money in) and reduces the bill's outstanding amount. A posted receipt can be **cancelled** with a reason. The cancellation is recorded in the receipt's history.

## Common problems

| Problem | Fix |
|---|---|
| LR not in **LR to Bill** | It hasn't been **acknowledged** (Chapter 15) |
| "Selected LRs must belong to one branch" | Make one bill per branch |
| "The selected LRs do not contain any billable charge" | The LRs have no freight. Check the LR's base freight |
| "Bill branch or customer details are incomplete" | Fill the branch/customer address and GST details in masters |
| Can't cancel a bill | Payment already received. Use a **credit note** instead |

## Try it yourself (test system only)

1. In **LR to Bill**, bill the acknowledged LR from Chapter 15 with its detention charge.
2. **Approve** and **Finalise** it. Note the bill number.
3. Create a **receipt** for half the amount. Approve it. Check the bill shows **Partially paid**.
