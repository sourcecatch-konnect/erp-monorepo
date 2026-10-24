# Training environment (A9)

A separate copy of the ERP where staff practise on made-up data. It runs the
same code as production, with one setting changed and its own database.

## What changes when `APP_ENVIRONMENT=training`

| Area | Behaviour on the training copy |
| --- | --- |
| Email (SES) | Not sent. Notification deliveries are marked *skipped*; account emails log one line instead. |
| WhatsApp | Not sent (same as email). In-app notifications still work. Template submit / delete to Meta is refused with a message. |
| E-way bill portal | Behaves as "not set up": no calls to WhiteBooks/NIC. |
| OneLap GPS | No calls; live tracking stays empty. |
| Top bar | Shows a **Training environment** badge (web: `NEXT_PUBLIC_APP_ENVIRONMENT=training`). |
| Training menu | Adds **Practice missions** (`/training/missions`). |
| Demo seed / reset | `pnpm training:seed` and `pnpm training:reset` only run here. |

Code: `apps/server/src/lib/environment.ts`, and the guards in
`notifications/providers.ts`, `notifications/whatsapp.templates.ts`,
`Services/email/email.services.ts`, `ewaybill/whitebooks.client.ts` and
`tracking/onelap.client.ts`. There is no Tally bridge in the server, so
nothing to switch off there.

The in-app **Feedback** button stays on in the training copy, so trainees can
report what confuses them. It has its own switches (`FEEDBACK_ENABLED`,
`NEXT_PUBLIC_FEEDBACK_ENABLED`), set to `"true"` in the setup below.

## Setting it up

1. **Its own database.** A new, empty PostgreSQL database (a separate Supabase
   project or a separate database on your server). **Never** point the
   training copy at the production database.
2. **Its own storage.** A separate S3 bucket (or leave S3 unset: picture
   upload in feedback and attachments then simply stays off) and its own
   `NOTIFICATION_QUEUE_PREFIX` if it shares Redis.
3. **Server environment** (in addition to the normal variables):
   ```env
   APP_ENVIRONMENT="training"
   DATABASE_URL="<training database>"
   DIRECT_URL="<training database, direct connection>"
   TRAINING_DEMO_PASSWORD="<password all trainee logins use>"
   TRAINING_RESET_CONFIRM="reset-training-data"
   FEEDBACK_ENABLED="true"
   # Leave these EMPTY on the training copy:
   # WB_EWAY_*, ONELAP_*, META_WHATSAPP_*, MAIL_FROM
   ```
   Leaving the integration secrets empty is a second lock on top of
   `APP_ENVIRONMENT`.
4. **Web build environment:**
   ```env
   NEXT_PUBLIC_APP_ENVIRONMENT="training"
   NEXT_PUBLIC_API_URL="<training API URL>"
   NEXT_PUBLIC_FEEDBACK_ENABLED="true"
   ```
   (`NEXT_PUBLIC_*` values are baked in at build time: build the training
   web app separately.)
5. **First load:**
   ```bash
   cd apps/server
   pnpm db:deploy            # apply all migrations
   npx tsx prisma/seed-admin.ts
   pnpm training:seed        # demo data + trainee logins
   ```

## Demo data

Created by `apps/server/prisma/seed-training.ts` (safe to re-run). It holds
every master a mission needs, because anything added by hand is wiped by the
nightly reset.

- Branches **Demo Pune** (head office, so a trip from Pune opens its journey
  without an override), **Demo Jalgaon**, **Demo Guwahati**
- Customers **Demo Appliances Ltd** (Pune, with a Guwahati depot) and **Demo Foods Pvt Ltd** (Jalgaon)
- Route Pune → Guwahati with a **32 ft HQ** road rate of ₹1,40,000
- Vehicles **MH19TR0001** (own) and **MH12TR0002** (market); drivers **Demo Driver Ramesh** and **Demo Driver Suresh**
- Goods **Demo Refrigerators**, **Demo Biscuits**; unit **BOX**
- Rail: **Demo Pune Rail Head** and **Demo Guwahati Rail Head** (managed by
  their demo branches), wagon **Demo BCN Wagon**, railway freight ₹1,85,000 per wagon
- Workshop: supplier **Demo Auto Spares**, part **Demo Brake Pads** (category Demo Brakes)
- Accounts: **Demo Bank Account** and **Demo Cash**, plus the chart of
  accounts from `seed-ledger.ts` (bills and receipts post to it)
- Trainee logins (password = `TRAINING_DEMO_PASSWORD`):
  `trainee.ops@training.local`, `trainee.manager@training.local`,
  `trainee.accounts@training.local`, `trainee.auditor@training.local`,
  `trainee.admin@training.local`

## Nightly reset

`pnpm training:reset` wipes the training database, re-applies every
migration and loads seed-admin + the demo data. It refuses to run unless
`APP_ENVIRONMENT=training` **and** `TRAINING_RESET_CONFIRM=reset-training-data`.

Example cron on the training server (02:00 every night):

```cron
0 2 * * * cd /app/apps/server && pnpm training:reset >> /var/log/skerp-training-reset.log 2>&1
```

Trainees' progress, quiz results and feedback on the training copy are wiped
by the reset too. Training progress that must be kept belongs on production.

## Practice missions

Defined in `packages/types/src/training/missions.ts`, one or more per
training track. Missions with checks (booking an order, creating an LR…)
tick themselves using the same lookups as the auto-ticked training steps;
the others are marked done by the trainee.

Some missions pick up another trainee's work; their card shows a **Before
you start** line. For a group session, run them in this order:

1. **Operations** books, ships and delivers the Demo Appliances truck, with
   **Branch Manager** approving the order, finalising the LR and approving the
   trip expense as they go.
2. **Accounts** acknowledges the delivered LR, bills it and records the payment.
3. **Auditor** follows the paper trail of that bill.

Rail needs a Demo Appliances LR booked as Road & Rail (an operations trainee
can book one first). Workshop, Admin and Basics stand alone.
