# Settings: login, users, access and roles

> Last checked: 2026-10-09 · Audience: all users (login, profile) and admins (users, access, roles, notifications, audit log)

Everything about **who can use the ERP and what they can do** is in **Settings** (sidebar → Administration → Settings).

| Screen | Who can open it | What it is for |
|---|---|---|
| **Profile** | Everyone | Your own details and photo |
| **Users** | Admins (permission *Manage roles and user access*) | Create users, edit them, reset passwords, deactivate or delete |
| **User access** | Admins | Each person's role, branches and special permissions |
| **Roles** | Admins | Create and edit roles (sets of permissions) |
| **Notifications** | Admins (permission *Set who gets notified, and when*) | Alert rules, messages, WhatsApp templates |
| **Audit log** | Admins and auditors (permission *View the audit log*) | Who changed what, and when |

---

## 1. Signing in

1. Open the ERP website. The **Sign in** page appears.
2. Enter your **Email** and **Password**, then click **Sign in**.
3. You stay signed in while you work. If you are idle too long, the ERP signs you in again in the background. If that fails, you return to the Sign in page.

[screenshot: Sign in page]

### Forgot password

1. On the Sign in page, click **Forgot password?**
2. Enter your email. If the email belongs to a user, a **reset link** is sent to it.
3. Open the link within **30 minutes** and choose a new password. The link works only once.

⚠ Reset emails need the ERP's email service (AWS) to be working. If no email arrives, ask an admin to reset your password from **Users**.

---

## 2. My profile

**Settings → Profile** shows your name, username, email, role, status, branch scope, and when your account was created and updated.

- **Change photo:** click **Change photo** and choose an image.
- Your name, role and branches are changed by an admin in **Users** / **User access**.

### My notifications

- The **bell** at the top shows your alerts. Click one to open the record it is about.
- **Notifications → Notification preferences** lets you turn alerts on or off for yourself (in-app, email, WhatsApp). Some critical alerts can't be turned off.

---

## 3. Users (admins)

**Settings → Users** lists everyone who can sign in. Search by name or email.

### Create a user

1. Click **Create user**.
2. Fill in **First name**, **Last name** (middle name optional), **Email**, **Role**, **Company**, **Branch** and a **Password**.
3. Click **Create**. The **Login credentials** window shows the email and password: **copy them now** and give them to the person.

[screenshot: Create user dialog]

### Edit a user

Open a user to see **User details**:
- **Profile:** name, email, phone number
- **Assignment:** role, company, branch
- **Notification preferences:** WhatsApp and email alerts on/off
- **Timeline:** when the user was created and last updated

### Reset a password

Open the user's menu → **Reset password** → type a new password → save. Give the new password to the person.

### Deactivate or delete

| Action | When to use it | Rules |
|---|---|---|
| **Deactivate** | The person left, or must stop signing in | You can't deactivate **yourself**. The last active **Admin** can't be deactivated |
| **Delete** | Only for a user created by mistake, with no work in the ERP | You can't delete yourself. A user who **has work recorded** (LRs, bills, payments…) can't be deleted. **Deactivate** them instead |

---

## 4. User access (admins)

**Settings → User access** decides **what each person can do** and **which branches they work in**. Open a person to change:

| Setting | Meaning |
|---|---|
| **Role** | The main set of permissions. Pick the one that matches the person's job (see [Roles](../00-overview/roles.md)) |
| **Branches** | Which branches the person can see and work in. Pick at least one, or give access to all branches |
| **Special permissions** | Allow or block **one** action for **this person only**, without changing the role. For each permission choose **Same as role**, **Allow** or **Block** |

- Use **Search permissions** (e.g. "approve payments") to find a permission quickly.
- **Go back to what the role allows** removes all special permissions for this person.
- Changes apply **right away** on the server. The person may need to **refresh the page** to see new menus.

[screenshot: User access drawer]

---

## 5. Roles (admins)

**Settings → Roles** lists all roles. A role is a named set of permissions.

### Create a role

1. Click **New role**.
2. Type a **Role name** (e.g. "Accounts assistant").
3. Optional: **Inherit permissions from** an existing role, so you start from its permissions.
4. Create it, then open the role to adjust its permissions.

**Copy role:** makes a new role with the same permissions, which you can then edit.

### Edit a role's permissions

1. Open the role.
2. Find permissions by **category** or **search** (e.g. "approve", "bills").
3. Tick or untick permissions, then save. Changed items are marked **Changed** until you save.

### Rules

- The **Admin** role is **built-in**: it always has every permission and can't be renamed, deleted or edited.
- A role that is still **assigned to users** can't be deleted. Move those users to another role first.
- Two roles can't have the same name.

---

## 6. Notification setup (admins)

**Settings → Notifications** controls the automatic alerts:
- **Rules:** which events send alerts, to whom, and by which channel (in-app, email, WhatsApp)
- **Templates:** the text of each message
- **WhatsApp templates:** submit them to WhatsApp for approval and keep them in sync
- **Test send:** send a test message to check the setup

⚠ Email and WhatsApp work only when their accounts and keys are set up correctly on the server.

---

## 7. Audit log (admins, auditors)

**Settings → Audit log** is a record of important changes: **who** made them, **when**, and **what changed** (old → new values).

Filter by:
- **Activity** (e.g. salary run approved, vendor payment made)
- **Changed by** (a person)
- **Period** (from / to)

Use **Clear filters** to see everything again. The audit log can't be edited.

---

## Common problems

| Problem | What to do |
|---|---|
| "Forbidden" or a menu is missing | You don't have the permission. Ask an admin to check your **role** or **special permissions** |
| A record from another branch isn't visible | Your **branches** don't include it. Ask an admin |
| You got a new permission but the menu hasn't appeared | Refresh the page, or sign out and in again |
| "A user with this email already exists" | Every user needs a different email |
| "Role still assigned to N user(s)" | Move those users to another role before deleting it |
| A user can't be deleted | They have work in the ERP. **Deactivate** them instead |
