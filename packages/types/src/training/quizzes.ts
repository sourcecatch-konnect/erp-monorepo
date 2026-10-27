import type { TrainingTrackKey } from "./catalog.js";

/**
 * Track quizzes (A10) — questions and options only. The answer key and the
 * explanations live on the server (modules/training/training.quiz-key.ts) so
 * they are never sent to the browser before grading.
 *
 * Keep questions about what the screens actually do, in plain words. Never
 * change a shipped question id: past attempts refer to it.
 */
export type TrainingQuizQuestion = {
  id: string;
  question: string;
  options: readonly string[];
};

/** Percentage of correct answers needed to pass. */
export const TRAINING_QUIZ_PASS_PERCENT = 80;

export const TRAINING_QUIZZES: Record<TrainingTrackKey, readonly TrainingQuizQuestion[]> = {
  basics: [
    {
      id: "basics.q1",
      question: "Where do you see which business steps are yours?",
      options: [
        "Settings → Users",
        "Training → My role & training",
        "The notifications bell",
        "The search box on any list",
      ],
    },
    {
      id: "basics.q2",
      question: "A word on a screen is new to you, for example 'POD'. What is the quickest way to find out what it means?",
      options: [
        "Ask the customer",
        "Leave the field empty",
        "Open the Glossary under Training",
        "Look in the audit log",
      ],
    },
    {
      id: "basics.q3",
      question: "What does the Help button at the top of a screen show?",
      options: [
        "What the screen is for, how to use it and common mistakes",
        "A list of all users",
        "Your profile",
        "Today's cash plan",
      ],
    },
    {
      id: "basics.q4",
      question: "A colleague can see a menu item that you can't. What is the most likely reason?",
      options: [
        "Your browser is too old",
        "The screen is broken",
        "You need to log in twice",
        "Your role does not have permission for it",
      ],
    },
    {
      id: "basics.q5",
      question: "Which branches can you work in?",
      options: [
        "Any branch you type in",
        "The ones your administrator gave you, shown on My role",
        "Only Head Office",
        "Always every branch",
      ],
    },
  ],
  ops: [
    {
      id: "ops.q1",
      question: "What must exist before you can book an order for a customer?",
      options: [
        "A finalised LR",
        "A Log Slip",
        "The customer, a route and a rate in the rate matrix",
        "The customer's bill",
      ],
    },
    {
      id: "ops.q2",
      question: "You save a new order. What status does it get?",
      options: ["Pending approval", "Confirmed", "Delivered", "Paid"],
    },
    {
      id: "ops.q3",
      question: "What is an LR?",
      options: [
        "A bill sent to the customer",
        "A railway receipt",
        "A driver's advance",
        "The legal document for one consignment, proving SK accepted the goods",
      ],
    },
    {
      id: "ops.q4",
      question: "Who usually makes the e-way bill on the government portal?",
      options: [
        "SK's driver",
        "The customer, who gives SK the number",
        "The railway",
        "The ERP, by itself",
      ],
    },
    {
      id: "ops.q5",
      question: "The goods have reached the consignee. What must happen before Accounts can bill the LR?",
      options: [
        "Nothing, it can be billed straight away",
        "Cancel the trip",
        "Mark it delivered and upload the signed POD",
        "Book a new order",
      ],
    },
  ],
  "branch-manager": [
    {
      id: "bm.q1",
      question: "An order is 'Pending approval'. What do you check before confirming it?",
      options: [
        "The driver's licence",
        "The freight from the rate matrix and the contact person",
        "The bank balance",
        "The Log Slip",
      ],
    },
    {
      id: "bm.q2",
      question: "What happens when an LR is finalised?",
      options: [
        "It gets its LR number and can't be freely changed",
        "It is deleted",
        "It is billed",
        "It goes back to draft",
      ],
    },
    {
      id: "bm.q3",
      question: "A vehicle is back from its journey. What do you do?",
      options: [
        "Wait 10 minutes, then close it",
        "Create a new trip for it",
        "Nothing until the month ends",
        "Enter the end kilometres and close the journey; the Log Slip is ready straight away",
      ],
    },
    {
      id: "bm.q4",
      question: "The operator has entered trip expenses. What is your part?",
      options: [
        "Delete them and enter them again",
        "Post them to Tally by hand",
        "Check them and approve the correct ones",
        "Nothing",
      ],
    },
    {
      id: "bm.q5",
      question: "Why must delivered LRs have their signed POD?",
      options: [
        "So the rake can leave",
        "So Accounts can bill them",
        "So a new order can be booked",
        "So the driver gets fuel",
      ],
    },
  ],
  rail: [
    {
      id: "rail.q1",
      question: "What is a VP?",
      options: [
        "One wagon's worth of space on a rake",
        "A vehicle permit",
        "A vendor payment",
        "A very urgent order",
      ],
    },
    {
      id: "rail.q2",
      question: "Where do the RR and MR come from?",
      options: [
        "The customer",
        "The driver",
        "Paper receipts from the railway, typed into the ERP",
        "The ERP makes them by itself",
      ],
    },
    {
      id: "rail.q3",
      question: "While recording VP loading, the ERP warns that the wagon will be over capacity. What should you do?",
      options: [
        "Ignore the warning",
        "Cancel the rake",
        "Change the wagon type in masters",
        "Check the quantity, and only override if you are allowed to",
      ],
    },
    {
      id: "rail.q4",
      question: "What is demurrage?",
      options: [
        "A charge SK makes to the customer",
        "A charge from Indian Railways for keeping a rake or wagon longer than the free time",
        "Payment for loading labour",
        "A discount on freight",
      ],
    },
    {
      id: "rail.q5",
      question: "What does a Delivery Challan do?",
      options: [
        "Bills the customer",
        "Books the rake",
        "Hands a group of LRs to the truck doing the last-mile delivery",
        "Pays the broker",
      ],
    },
  ],
  accounts: [
    {
      id: "acc.q1",
      question: "Which LRs can be billed in LR to Bill?",
      options: [
        "Any draft LR",
        "Cancelled LRs",
        "LRs still on the road",
        "Delivered LRs with their POD",
      ],
    },
    {
      id: "acc.q2",
      question: "What decides whether a bill has IGST, or CGST + SGST?",
      options: [
        "The place of supply: the same state or another state",
        "The customer's name",
        "The vehicle type",
        "The bill number",
      ],
    },
    {
      id: "acc.q3",
      question: "A customer paid but kept back 2% as TDS. How do you record it?",
      options: [
        "Record only the money received and leave the bill open",
        "Record the payment and enter the TDS on the bill, so it is fully settled",
        "Cancel the bill",
        "Raise a new bill for the 2%",
      ],
    },
    {
      id: "acc.q4",
      question: "A finalised bill is too high. What do you do?",
      options: [
        "Delete it",
        "Edit the amount directly",
        "Raise a credit note",
        "Cancel the LR",
      ],
    },
    {
      id: "acc.q5",
      question: "How is a broker paid?",
      options: [
        "Directly from the ledger",
        "By the driver",
        "Through a customer receipt",
        "Through a payment slip that is raised, approved and then paid",
      ],
    },
  ],
  workshop: [
    {
      id: "ws.q1",
      question: "How do you order spare parts from a supplier?",
      options: ["With a job card", "With a purchase order", "With an LR", "With a receipt"],
    },
    {
      id: "ws.q2",
      question: "The parts have arrived. What do you record?",
      options: [
        "A new vehicle",
        "A trip expense",
        "An inward, so they show in stock",
        "A credit note",
      ],
    },
    {
      id: "ws.q3",
      question: "What is a job card for?",
      options: [
        "Recording a repair on a vehicle: the work done and the parts used",
        "Billing a customer",
        "Booking a rake",
        "Paying the driver",
      ],
    },
    {
      id: "ws.q4",
      question: "An outside garage repaired a vehicle. Where do you enter their bill?",
      options: ["LR to Bill", "Cash planning", "Orders", "Service bills"],
    },
    {
      id: "ws.q5",
      question: "A part was faulty and goes back to the supplier. Where do you track it?",
      options: ["Delivery challans", "Supplier replacement", "The day book", "Trips"],
    },
  ],
  auditor: [
    {
      id: "aud.q1",
      question: "Where can you see who changed users and roles?",
      options: ["The glossary", "LR to Bill", "The audit log", "Orders"],
    },
    {
      id: "aud.q2",
      question: "Where do you see everything posted on one day?",
      options: ["The day book", "The process map", "VP Loading", "Your profile"],
    },
    {
      id: "aud.q3",
      question: "You need to see an LR's signed POD. Where is it?",
      options: [
        "In the rate matrix",
        "In cash planning",
        "In the audit log",
        "Attached to the LR",
      ],
    },
    {
      id: "aud.q4",
      question: "As a read-only user, can you change a bill?",
      options: [
        "Yes, any bill",
        "No. You can look, but not change",
        "Only draft bills",
        "Only if the customer agrees",
      ],
    },
    {
      id: "aud.q5",
      question: "Where do you see every posting for one account?",
      options: ["The Help panel", "The glossary", "Its ledger", "The trip list"],
    },
  ],
  admin: [
    {
      id: "adm.q1",
      question: "A new employee joins. What do you do first?",
      options: [
        "Give them the admin password",
        "Create their user and give them a role",
        "Create an order for them",
        "Nothing, they can sign up themselves",
      ],
    },
    {
      id: "adm.q2",
      question: "You change a role's permissions. Who is affected?",
      options: [
        "Only you",
        "Only the next new user",
        "Everyone who has that role",
        "Nobody until next month",
      ],
    },
    {
      id: "adm.q3",
      question: "A user should only work in the Pune branch. Where do you set that?",
      options: ["User access (branch access)", "The glossary", "The rate matrix", "VP schedule"],
    },
    {
      id: "adm.q4",
      question: "Where do you choose which training a role must take?",
      options: ["Orders", "Your profile", "Notifications", "Settings → Training"],
    },
    {
      id: "adm.q5",
      question: "Where do you decide who is told about events such as a new order?",
      options: ["LR to Bill", "Notification rules", "The audit log", "The day book"],
    },
  ],
};
