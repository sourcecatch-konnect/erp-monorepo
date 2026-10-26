/**
 * Answer key for the track quizzes (A10). Server-only on purpose: the browser
 * gets the questions from @skerp/types, and only sees answers and
 * explanations after the attempt is graded.
 *
 * `answer` is the index into that question's `options`.
 */
export type QuizKeyEntry = { answer: number; explain: string };

export const QUIZ_KEY: Record<string, QuizKeyEntry> = {
  "basics.q1": {
    answer: 1,
    explain: "My role & training lists your steps, what you can do there, and who works before and after you.",
  },
  "basics.q2": {
    answer: 2,
    explain: "The Glossary explains the common ERP words in plain language. Many screens also underline words you can click.",
  },
  "basics.q3": {
    answer: 0,
    explain: "Help explains the screen: what it's for, where it fits in the business, how to use it and common mistakes.",
  },
  "basics.q4": {
    answer: 3,
    explain: "The menu only shows screens your role may use. Ask your administrator if you need access.",
  },
  "basics.q5": {
    answer: 1,
    explain: "Your administrator decides your branch access. My role shows which branches you have.",
  },

  "ops.q1": {
    answer: 2,
    explain: "An order picks the customer and route, and works out the freight from the rate matrix.",
  },
  "ops.q2": {
    answer: 0,
    explain: "A new order waits as 'Pending approval' until a manager confirms it.",
  },
  "ops.q3": {
    answer: 3,
    explain: "The LR (Lorry Receipt) is the legal proof that SK accepted the goods. There is one per consignment.",
  },
  "ops.q4": {
    answer: 1,
    explain: "The customer makes the e-way bill. SK attaches the number to the LR and updates Part-B with the vehicle.",
  },
  "ops.q5": {
    answer: 2,
    explain: "Accounts can only bill an LR once it is delivered and its signed POD is in.",
  },

  "bm.q1": {
    answer: 1,
    explain: "Check that the freight worked out from the rate matrix is right and that the contact person is filled in.",
  },
  "bm.q2": {
    answer: 0,
    explain: "Finalising gives the LR its number. After that it can't be freely changed.",
  },
  "bm.q3": {
    answer: 3,
    explain: "Close the journey with the end kilometres. The Log Slip is ready straight away; the old 10-minute wait is gone.",
  },
  "bm.q4": {
    answer: 2,
    explain: "The manager checks the trip expenses and approves the ones that are correct.",
  },
  "bm.q5": {
    answer: 1,
    explain: "The POD proves delivery. Accounts can't bill an LR without it.",
  },

  "rail.q1": {
    answer: 0,
    explain: "A rake has several VPs; each VP is one wagon's worth of space.",
  },
  "rail.q2": {
    answer: 2,
    explain: "The railway gives paper RR (Railway Receipt) and MR (Money Receipt) copies, which you type in.",
  },
  "rail.q3": {
    answer: 3,
    explain: "Re-check the quantity first. Overriding the capacity warning needs a special permission.",
  },
  "rail.q4": {
    answer: 1,
    explain: "Demurrage is paid to the railway. Detention is different: that is what SK charges the customer for waiting.",
  },
  "rail.q5": {
    answer: 2,
    explain: "One Delivery Challan covers all the LRs going out on the same last-mile truck.",
  },

  "acc.q1": {
    answer: 3,
    explain: "LR to Bill only lists LRs that are delivered and have their POD.",
  },
  "acc.q2": {
    answer: 0,
    explain: "Within the same state it is CGST + SGST; to another state it is IGST. The ERP works it out from the place of supply.",
  },
  "acc.q3": {
    answer: 1,
    explain: "Enter the TDS on the receipt against the bill, so the bill shows as fully settled.",
  },
  "acc.q4": {
    answer: 2,
    explain: "A finalised bill isn't edited. A credit note reduces it and keeps the record straight.",
  },
  "acc.q5": {
    answer: 3,
    explain: "Payments to brokers, transporters and labour go through a payment slip: raised, approved, then paid.",
  },

  "ws.q1": { answer: 1, explain: "Spare parts are ordered from the supplier with a purchase order." },
  "ws.q2": { answer: 2, explain: "Record the inward when the parts arrive, so they show in stock." },
  "ws.q3": {
    answer: 0,
    explain: "A job card records one repair: the work done and the parts used on the vehicle.",
  },
  "ws.q4": { answer: 3, explain: "Bills from outside garages and service providers go in Service bills." },
  "ws.q5": { answer: 1, explain: "Faulty parts sent back to the supplier are tracked in Supplier replacement." },

  "aud.q1": { answer: 2, explain: "The audit log records changes to users and roles, and important actions." },
  "aud.q2": { answer: 0, explain: "The day book shows everything posted on one day." },
  "aud.q3": { answer: 3, explain: "The scanned POD is attached to the LR. Open the LR to see it." },
  "aud.q4": { answer: 1, explain: "A read-only role can look at everything it may see, but not change it." },
  "aud.q5": { answer: 2, explain: "Each account's ledger shows every posting for it." },

  "adm.q1": {
    answer: 1,
    explain: "Create the user and give them a role. There is no self sign-up; admins provision every user.",
  },
  "adm.q2": { answer: 2, explain: "A role is shared: change it once and everyone with that role gets the change." },
  "adm.q3": { answer: 0, explain: "Branch access is set per user in User access." },
  "adm.q4": { answer: 3, explain: "Settings → Training lets you describe each role and choose its required training." },
  "adm.q5": { answer: 1, explain: "Notification rules decide who is told about which events." },
};
