# 18. Books of account (simple)

> Last checked: 2026-10-12 · For: accounts, managers, owner

## The idea

SKERP keeps the company's accounts **like Tally**. The difference: **you don't type most entries.** When you finalise a bill, approve a receipt or pay a transporter, the ERP **writes the accounting entry automatically**.

## Four words to know

| Word | Simple meaning | Example |
|---|---|---|
| **Ledger** | One account, like a page in a book | ABC Industries, Cash, HDFC Bank, Diesel expense |
| **Voucher** | One accounting entry. Money goes **out of** one ledger and **into** another, always equal (debit = credit) | Bill finalised: ABC Industries owes ₹1,06,200 |
| **Debit / Credit** | The two sides of every voucher | |
| **Reversal** | A new voucher that cancels a wrong one | Nothing is ever deleted |

## Which action writes which voucher

| You do this | The ERP writes |
|---|---|
| **Finalise a bill** | **Sales** voucher: the customer owes us |
| **Approve a client receipt** | **Receipt** voucher: money in, customer owes less |
| **Approve / pay a vendor slip** | **Accrual** / **Payment** voucher: we owe, then we pay the transporter or hamali |
| **Approve / pay a salary run**, pay a driver | **Journal** / **Payment** voucher |
| **Post a log slip** | **Log slip** voucher: truck's freight, costs and driver balance |
| **Manual journal** | Any entry an accountant makes by hand |

## The screens

**Menu: Finance → Books of Account** and **Finance → Cash & Bank**

| Screen | What it shows | Use it to |
|---|---|---|
| **Chart of Accounts** | The list of all ledgers, in groups | Find or add a ledger |
| **Ledgers** | One ledger's statement: every voucher, with running balance | "How much does ABC owe us?" or "What did we pay Shree Roadlines?" |
| **Day Book** | All vouchers, date by date | See everything that happened on a day |
| **Manual Journal** | Make an entry by hand | Corrections and adjustments (accountants only) |
| **Opening Balances** | Starting balance of each cash and bank account | Set once, on the start date |
| **Cash Planning** | Daily view of money available and expected | ⚠ Partly connected to the books. Don't rely on it yet |

## Rules the books follow

- **Every voucher balances:** total debit = total credit.
- **Nothing is deleted.** A mistake is fixed with a **reversal**, so the history stays clean for the auditor.
- **Money is stored exactly** (in paise), so there are no rounding errors.
- **You can't pay more than an account holds** (driver payments).

## Not in the books yet

⚠ **Trip advances** and **trip expenses** are not yet posted to cash/bank. This waits on the accountant's decision. They are settled through the **log slip** (Chapter 13).

## Who can see it

By default, **Admin** and **Accounts** use these screens. **Read-Only Auditor** can view ledgers but can't change anything.
