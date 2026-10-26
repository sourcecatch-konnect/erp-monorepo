import type { TrainingTrackKey, TrainingVerifierKey } from "./catalog.js";

/**
 * Practice missions (A9) — short real-life scenarios to do end to end in the
 * TRAINING environment, using its demo data (prisma/seed-training.ts).
 *
 * A mission with `verifiers` completes itself once every check passes
 * (same checks as A6). A mission without them is marked done by the trainee.
 * Never rename a shipped key: completion is stored as step `mission.<key>`.
 */
export type TrainingMission = {
  key: string;
  trackKey: TrainingTrackKey;
  title: string;
  /** The situation, as a customer or colleague would describe it. */
  story: string;
  /** What must already exist, usually another trainee's mission. */
  before?: string;
  steps: readonly string[];
  verifiers: readonly TrainingVerifierKey[];
};

export const TRAINING_MISSIONS: readonly TrainingMission[] = [
  {
    key: "basics-find-your-way",
    trackKey: "basics",
    title: "Find your way around",
    story: "It's your first day. Get to know the screens you will use every day.",
    steps: [
      "Open Training → My role & training and read which steps are yours.",
      "Open How the business works and click the step that comes after yours.",
      "Find the word 'POD' in the Glossary.",
      "Open Orders and press Help at the top. Read 'Common mistakes'.",
    ],
    verifiers: [],
  },
  {
    key: "ops-book-and-ship",
    trackKey: "ops",
    title: "Book and ship a truck for Demo Appliances",
    story:
      "Demo Appliances Ltd calls: they need one 32 ft HQ truck from their Pune warehouse to their Guwahati depot next Monday.",
    steps: [
      "Book the order: customer Demo Appliances Ltd, from Demo Pune to Demo Guwahati, 1 truck, vehicle type 32 ft HQ.",
      "Ask the trainee manager to approve it (or approve it yourself if you can).",
      "Create the LR from the confirmed order: consignee Demo Appliances — Guwahati Depot, 40 boxes of Demo Refrigerators.",
      "Plan a trip on vehicle MH19TR0001 with Demo Driver Ramesh and attach the LR.",
      "Enter the trip's toll expense, then ask the trainee manager to approve it.",
      "When the truck reaches Guwahati, mark the LR delivered.",
    ],
    verifiers: ["order.created", "lr.created", "trip.created", "trip_expense.created", "lr.delivered"],
  },
  {
    key: "bm-approve-and-control",
    trackKey: "branch-manager",
    title: "Approve today's work",
    story:
      "A trainee has booked an order and entered trip expenses. Check them before the truck leaves.",
    before:
      "Do this alongside the operations trainee's 'Book and ship a truck for Demo Appliances': each step below follows one of theirs.",
    steps: [
      "Open the pending order, check the freight and the contact person, and approve it.",
      "Open its LR, check the consignee and goods, and finalise it.",
      "Open the trip and approve the expenses that are correct.",
    ],
    verifiers: ["order.approved", "lr.finalised", "trip_expense.approved"],
  },
  {
    key: "rail-send-by-rake",
    trackKey: "rail",
    title: "Send goods by rail",
    story:
      "A Demo Appliances LR from Pune to Guwahati is going by rake instead of road.",
    before:
      "A Demo Appliances LR booked as Road & Rail (rail heads Demo Pune Rail Head → Demo Guwahati Rail Head) by the operations trainee.",
    steps: [
      "Create a VP schedule from Demo Pune to Demo Guwahati, rail heads Demo Pune Rail Head → Demo Guwahati Rail Head, with 1 Demo BCN Wagon.",
      "Enter the MR / RR for that VP.",
      "Record the VP loading: put the LR's goods into the wagon.",
    ],
    verifiers: ["vp_schedule.created", "mrrr.created", "vp_loading.created"],
  },
  {
    key: "acc-bill-and-collect",
    trackKey: "accounts",
    title: "Bill Demo Appliances and record their payment",
    story:
      "Demo Appliances' LR has been delivered and its POD is in. They pay at the end of the month, keeping back 2% as TDS.",
    before:
      "A Demo Appliances LR the operations trainee has marked delivered ('Book and ship a truck for Demo Appliances').",
    steps: [
      "The signed POD is back: open the delivered LR and acknowledge it.",
      "In LR to Bill, choose the consignor as the bill head, pick Demo Appliances Ltd and create the bill.",
      "Finalise the bill in the Billing Register.",
      "Record their payment in Client Payment Receivable into Demo Bank Account, with 2% TDS on the bill.",
    ],
    verifiers: ["lr.acknowledged", "bill.created", "receipt.created"],
  },
  {
    key: "ws-repair-a-truck",
    trackKey: "workshop",
    title: "Repair truck MH19TR0001",
    story: "Truck MH19TR0001 needs new brake pads before its next trip.",
    steps: [
      "Raise a purchase order at Demo Pune for 2 sets of Demo Brake Pads from Demo Auto Spares.",
      "Record the inward when the parts arrive.",
      "Open a job card for MH19TR0001 with Demo Driver Ramesh, the work done and the brake pads used.",
    ],
    verifiers: ["purchase_order.created", "inward.created", "job_card.created"],
  },
  {
    key: "aud-paper-trail",
    trackKey: "auditor",
    title: "Follow the paper trail",
    story: "An auditor asks: show me the proof behind one Demo Appliances bill.",
    before: "A finalised Demo Appliances bill, from the accounts trainee's mission.",
    steps: [
      "Find a Demo Appliances LR and open its POD.",
      "Find the bill that includes that LR.",
      "Open the customer's ledger and find the bill's posting.",
    ],
    verifiers: [],
  },
  {
    key: "admin-new-joiner",
    trackKey: "admin",
    title: "Set up a new joiner",
    story: "A new operations assistant starts at Demo Pune tomorrow.",
    steps: [
      "Create a user for them with the Operations role.",
      "In User access, give them Demo Pune only.",
      "Check their My role page shows the Operations training.",
    ],
    verifiers: [],
  },
];

export const missionStepKey = (missionKey: string) => `mission.${missionKey}`;
