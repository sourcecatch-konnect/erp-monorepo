# 4. Who can do what (users, roles and permissions)

> Last checked: 2026-10-12 · For: everyone (understand it), admins (set it up)

## The idea in one line

Every person gets a **role**. The role decides **which menus they see** and **which buttons they can press**. This is called **RBAC** (Role-Based Access Control).

## Why we need it

- A booking clerk should create orders, but **not** approve payments.
- An accountant should pay transporters, but **not** change a customer's rate.
- The person who **makes** a payment should not be the same person who **approves** it.

This protects the company's money and stops mistakes.

## Four words to know

| Word | Meaning | Example |
|---|---|---|
| **User** | One person who signs in | Ramesh, booking clerk |
| **Permission** | Permission to do **one** action | "Approve orders", "Pay vendors" |
| **Role** | A set of permissions for one kind of job | **Operations** = create orders, LRs, trips… |
| **Branch scope** | Which branches a user can see | Ramesh sees only the Pune branch |

## The 5 ready-made roles

| Role | Who gets it | Can do | Cannot do |
|---|---|---|---|
| **Admin** | IT / owner's office | Everything, including users and roles | — |
| **Branch Manager** | Branch head | Masters, **approve orders**, LRs, trips, deliveries, approve bills and receipts | Vendor payments, driver salary, ledgers, workshop |
| **Operations** | Booking / operations staff | Create orders, LRs, trips, journeys, expenses; mark delivered | Approve, bill, pay |
| **Accounts** | Accounts team | Billing, receipts, vendor payments, driver salary, log slips, ledgers, workshop | Create orders, LRs, trips |
| **Read-Only Auditor** | Auditor / CA | **View** almost everything, and the audit log | Change anything |

Admins can edit these roles or create new ones.

## How it works in practice

```
 Ramesh signs in
     │
     ▼
 Role = Operations  +  Branches = Pune
     │
     ├─► sees: Orders, Lorry Receipts, Trips…        (allowed)
     ├─► does NOT see: Vendor Payments, Settings     (not allowed)
     └─► sees only Pune branch records
```

**Special permissions:** an admin can **allow** or **block** one single action for one person, without changing their role. Example: Ramesh is Operations, but is also allowed to "Approve orders" while the manager is on leave.

**Maker-checker:** for payments and salary runs, the person who **created** the document can be blocked from **approving** it. A second person must check it.

## For admins: set up a new person

1. **Settings → Users → Create user.** Fill first name, last name, email, role, company, branch and a password. Click **Create**.
2. **Copy the login details** shown on screen and give them to the person.
3. **Settings → User access.** Open the person. Check the **role** and the **branches**. Add **special permissions** only if needed.
4. Ask the person to sign in and confirm they can see the right menus.

**When someone leaves:** **Deactivate** them (Settings → Users). Don't delete them: their past work stays in the ERP with their name.

## Common problems

| You see | Why | What to do |
|---|---|---|
| A menu is missing | Your role doesn't allow it | Ask your admin |
| "Forbidden" message | You pressed something your role doesn't allow | Ask your admin |
| A record from another branch is missing | It's outside your **branch scope** | Ask your admin |
| You got a new permission but nothing changed | The page is old | **Refresh** the page, or sign out and in |

## Try it yourself (test system only)

1. As admin, create a test user with role **Operations** and one branch.
2. Sign in as that user in a private browser window.
3. Check: can you see **Orders**? Can you see **Settings**? (You should see Orders, but not Settings.)
4. Create an order. Can you **approve** it? (No. Operations can't approve.)
