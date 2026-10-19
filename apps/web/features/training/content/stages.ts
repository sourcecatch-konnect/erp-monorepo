import type { TrainingStageKey } from "@skerp/types";

/**
 * Longer, plain-language explanation for each business step, shown when a
 * step is opened on the process map. Typed as a full Record so adding a stage
 * to the catalog without writing its explanation is a compile error.
 *
 * Status names match what the screens show. Keep sentences short.
 */
export type StageContent = {
  explain: string;
  /** What has to exist before this step can be done. */
  needs: string[];
  /** How the document's status moves at this step, in order. */
  statusFlows?: { document: string; steps: string[]; also?: string }[];
  tip?: string;
};

export const STAGE_CONTENT: Record<TrainingStageKey, StageContent> = {
  "setup.masters": {
    explain:
      "Master data is the list of customers, routes, rates, vehicles and drivers that the rest of the ERP picks from. If something is missing here, an order or trip can't be made.",
    needs: ["Nothing. This is where everything starts."],
    tip: "Check that a customer and its rate exist before booking its first order.",
  },
  "booking.order": {
    explain:
      "An order is the customer's request to move goods: from which branch to which branch, when, and by truck or by item. Saving it sends it for approval.",
    needs: [
      "The customer and its pickup and delivery locations",
      "A route between the two branches",
      "A rate for this route in the rate matrix, so the freight can be worked out",
      "The vehicle type, for truck orders",
    ],
    statusFlows: [
      {
        document: "Order",
        steps: ["Pending approval", "Confirmed", "LR created", "In progress", "Completed"],
        also: "Rejected or Cancelled if it does not go ahead.",
      },
    ],
  },
  "booking.order-approval": {
    explain:
      "A manager checks the order and the freight the system worked out from the rate matrix, adds the contact person, and confirms or rejects it. Only confirmed orders can have LRs.",
    needs: ["An order that is 'Pending approval'"],
    statusFlows: [
      {
        document: "Order",
        steps: ["Pending approval", "Confirmed"],
        also: "or Rejected.",
      },
    ],
  },
  "booking.lr": {
    explain:
      "The LR (Lorry Receipt) is the legal proof that SK accepted the goods. Make one LR per consignment: who sends it, who receives it, the goods and the freight. Finalising gives it its LR number.",
    needs: [
      "A confirmed order",
      "The consignee's name and address",
      "The goods and their quantities",
    ],
    statusFlows: [
      {
        document: "LR",
        steps: ["Draft", "Finalised", "Delivered", "Acknowledged"],
        also: "Cancelled if it was made by mistake.",
      },
    ],
  },
  "booking.ewaybill": {
    explain:
      "The customer makes the e-way bill on the government portal and gives SK the number. You attach it to the LR and update Part-B with the vehicle, and extend it if the truck is late.",
    needs: [
      "The e-way bill number from the customer (needed for goods over ₹50,000)",
      "The vehicle number, for Part-B",
    ],
    statusFlows: [
      {
        document: "E-way bill",
        steps: ["Part-B pending", "Active", "In transit", "Delivered"],
        also: "Expired if its validity runs out, or Cancelled.",
      },
    ],
  },
  "road.trip": {
    explain:
      "A trip puts the LRs on a truck with a driver. Own trucks and hired market trucks both go through a trip, so you always know which vehicle carries which goods.",
    needs: ["Finalised LRs to carry", "A free vehicle and a driver"],
    statusFlows: [
      {
        document: "Trip",
        steps: ["Planned", "In transit", "Closed"],
        also: "Cancelled if the truck does not go.",
      },
    ],
  },
  "road.expenses": {
    explain:
      "While the truck is on the road, diesel, toll and other spends are entered against the trip, along with any cash advance given to the driver. A manager approves them.",
    needs: ["A trip that has started"],
    tip: "Enter expenses as they happen. It makes closing the trip much quicker.",
  },
  "road.close": {
    explain:
      "When the vehicle is back, enter the end kilometres and close the journey. The Log Slip, the official record of the trip with its kilometres and expenses, is ready straight away.",
    needs: [
      "The vehicle has returned",
      "The end kilometre reading",
      "All trip expenses entered",
    ],
    statusFlows: [
      {
        document: "Vehicle journey",
        steps: ["Draft", "Active", "Returned", "Ready for Log Slip", "Settled"],
        also: "Can be Reopened to correct a mistake.",
      },
      {
        document: "Log Slip",
        steps: ["Generated", "Posted to accounts"],
      },
    ],
    tip: "There is no need to wait after closing. The old system needed a 10-minute wait; this one doesn't.",
  },
  "rail.vp-schedule": {
    explain:
      "For long distances, goods go by rake (a full goods train). A VP is one wagon's worth of space on the rake. The VP schedule plans which LRs travel in which VP.",
    needs: ["A rake booked with Indian Railways", "Finalised LRs going by rail"],
    statusFlows: [
      {
        document: "VP schedule",
        steps: [
          "Draft",
          "Planned",
          "MR/RR created",
          "Loading",
          "Loaded",
          "Verified",
          "Finalised",
        ],
      },
    ],
  },
  "rail.mrrr": {
    explain:
      "The railway gives paper receipts: the RR (Railway Receipt) for each VP and the MR (Money Receipt) for the freight SK paid. Type them in against the VP schedule.",
    needs: ["A VP schedule", "The paper RR and MR from the railway"],
    statusFlows: [{ document: "MR / RR", steps: ["Draft", "Submitted"] }],
  },
  "rail.vp-loading": {
    explain:
      "Record what was physically loaded into each wagon. The ERP warns you if a wagon is loaded over its capacity.",
    needs: ["A VP schedule with its MR / RR", "The goods at the rail head"],
    statusFlows: [{ document: "VP loading", steps: ["Draft", "Loaded"] }],
  },
  "rail.rail-head": {
    explain:
      "Record the rake's times at the rail head with any demurrage (railway charge for holding the rake too long), wharfage or waiver, and the GRN for the goods received there.",
    needs: ["The rake's arrival or departure times", "The goods received at the rail head"],
    statusFlows: [
      { document: "Rake record", steps: ["Draft", "Submitted"] },
      { document: "GRN at rail head", steps: ["Draft", "Submitted"] },
    ],
  },
  "rail.branch": {
    explain:
      "When the goods reach the destination branch, record the rake there and the GRN for what was actually received, including any shortage.",
    needs: ["The rake has reached the destination", "The goods unloaded at the branch"],
    statusFlows: [
      { document: "Rake record", steps: ["Draft", "Submitted"] },
      { document: "GRN at branch", steps: ["Draft", "Submitted"] },
    ],
  },
  "rail.dc": {
    explain:
      "A Delivery Challan (DC) hands a group of LRs to the truck that does the last-mile delivery from the railhead. One challan can cover many LRs.",
    needs: [
      "The goods received at the destination (branch GRN)",
      "The broker or truck doing the last-mile delivery",
    ],
    statusFlows: [
      {
        document: "Delivery challan",
        steps: ["Draft", "Issued"],
        also: "Cancelled if made by mistake.",
      },
    ],
  },
  "delivery.deliver": {
    explain:
      "When the goods reach the consignee, mark the LR delivered and note any shortage or damage. Then upload the signed POD (proof of delivery). Accounts can only bill an LR once its delivery is confirmed.",
    needs: [
      "A finalised LR that has reached the consignee",
      "The signed POD to upload",
    ],
    statusFlows: [
      { document: "LR", steps: ["Finalised", "Delivered", "Acknowledged"] },
      { document: "LR billing", steps: ["Not billable", "Ready to bill", "Billed"] },
    ],
  },
  "accounts.bill": {
    explain:
      "Accounts picks who pays (the consignor or the consignee), selects the delivered LRs and creates the bill. The freight comes from the LR and GST is worked out from where the goods went.",
    needs: ["Delivered LRs with their POD", "Who pays: consignor or consignee"],
    statusFlows: [
      {
        document: "Bill",
        steps: [
          "Draft",
          "Pending review",
          "Approved",
          "Finalised",
          "Sent",
          "Partially paid",
          "Paid",
        ],
        also: "Cancelled, or corrected later with a credit note.",
      },
    ],
  },
  "accounts.receipt": {
    explain:
      "When a customer pays, record the amount and match it to their bills. Many customers deduct TDS. Record that too, so the bill shows as fully settled.",
    needs: ["Bills sent to the customer", "The payment details: amount, date, bank and any TDS"],
    statusFlows: [
      {
        document: "Receipt",
        steps: ["Draft", "Pending approval", "Posted"],
        also: "or Cancelled.",
      },
    ],
  },
  "accounts.vendor-payment": {
    explain:
      "Money going out to brokers, transporters and labour (hamali) goes through a payment slip: someone raises it, a manager approves it, and then it is paid.",
    needs: [
      "Who is being paid",
      "What the payment is for, such as a delivery challan or hamali",
    ],
    statusFlows: [
      {
        document: "Payment slip",
        steps: ["Draft", "Pending approval", "Approved", "Partially paid", "Paid"],
        also: "or Cancelled.",
      },
    ],
  },
  "accounts.ledger": {
    explain:
      "Every bill, receipt and payment posts entries to the ledgers automatically. The day book shows everything posted on one day. Manual journals are only for corrections.",
    needs: ["Nothing. Entries appear here on their own as work is done."],
  },
  "workshop.repair": {
    explain:
      "The workshop keeps own vehicles running: order spare parts with a purchase order, receive them into stock, open a job card for each repair and pay service bills from outside garages.",
    needs: ["The vehicle that needs work", "The parts supplier, for purchase orders"],
    statusFlows: [
      {
        document: "Purchase order",
        steps: ["Draft", "Approved", "Sent", "Partially received", "Received", "Closed"],
      },
      { document: "Job card", steps: ["Draft", "Finalised"] },
      { document: "Service bill", steps: ["Draft", "Posted"] },
    ],
  },
  "cash.planning": {
    explain:
      "Each day, the cash position and the payments planned for the day are entered and approved, so everyone knows how much money is available.",
    needs: ["Today's bank and cash balances", "The payments planned for the day"],
    statusFlows: [{ document: "Cash day", steps: ["Open", "Closed"] }],
  },
};

/** Glossary words used at each step (ids from content/glossary.ts). */
export const STAGE_TERMS: Partial<Record<TrainingStageKey, string[]>> = {
  "setup.masters": ["master-data", "rate-matrix"],
  "booking.order": ["order", "tbb", "to-pay", "rate-matrix"],
  "booking.order-approval": ["rate-matrix"],
  "booking.lr": ["lr", "consignor", "consignee", "fy"],
  "booking.ewaybill": ["ewb", "part-b", "transin"],
  "road.trip": ["market-vehicle"],
  "road.expenses": ["happay"],
  "road.close": ["vehicle-journey", "log-slip"],
  "rail.vp-schedule": ["rake", "vp"],
  "rail.mrrr": ["rr", "mr"],
  "rail.vp-loading": ["vp"],
  "rail.rail-head": ["grn", "dc-wc", "demurrage", "warpage", "waiver"],
  "rail.branch": ["grn"],
  "rail.dc": ["dc", "ldc", "broker"],
  "delivery.deliver": ["pod", "docket", "detention"],
  "accounts.bill": ["place-of-supply", "gst", "rcm", "gta", "hsn-sac"],
  "accounts.receipt": ["tds"],
  "accounts.vendor-payment": ["broker", "hamali"],
};
