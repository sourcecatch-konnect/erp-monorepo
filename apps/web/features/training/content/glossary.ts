/**
 * Words used across the ERP, explained simply. Source: docs/CONTEXT.md §2.
 * `id` is what <Term id="…"> refers to — keep ids stable.
 */
export type GlossaryEntry = {
  id: string;
  term: string;
  /** Spelled-out name, when the term is an abbreviation. */
  fullName?: string;
  meaning: string;
};

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: "lr",
    term: "LR",
    fullName: "Lorry Receipt",
    meaning:
      "The main transport document, one per consignment. It is the legal proof that SK accepted the goods for carriage.",
  },
  {
    id: "order",
    term: "Order",
    meaning:
      "A customer's request to move goods. After it is confirmed, one or more LRs are made from it.",
  },
  {
    id: "consignor",
    term: "Consignor",
    meaning: "The person or company sending the goods, usually the customer who booked.",
  },
  {
    id: "consignee",
    term: "Consignee",
    meaning: "The person or company receiving the goods.",
  },
  {
    id: "pod",
    term: "POD",
    fullName: "Proof of Delivery",
    meaning:
      "The delivery receipt signed by the consignee. It is scanned into the ERP and is needed before an LR can be billed.",
  },
  {
    id: "grn",
    term: "GRN",
    fullName: "Goods Receipt Note",
    meaning: "A record of goods physically received at a branch or rail head.",
  },
  {
    id: "tbb",
    term: "TBB",
    fullName: "To Be Billed",
    meaning:
      "A payment mode: the customer is billed later, instead of paying up front or paying on delivery.",
  },
  {
    id: "to-pay",
    term: "To Pay",
    meaning: "A payment mode where the freight is collected when the goods are delivered.",
  },
  {
    id: "rake",
    term: "Rake",
    meaning: "A full goods train made of many wagons, booked from Indian Railways.",
  },
  {
    id: "vp",
    term: "VP",
    fullName: "Vehicle Placement",
    meaning: "One wagon's worth of space on a rake. A rake has several VPs.",
  },
  {
    id: "rr",
    term: "RR",
    fullName: "Railway Receipt",
    meaning: "Indian Railways' legal document for each VP. It is entered into the ERP from the paper copy.",
  },
  {
    id: "mr",
    term: "MR",
    fullName: "Money Receipt",
    meaning: "The railway's receipt for the rail freight SK paid. Entered from the paper copy.",
  },
  {
    id: "dc",
    term: "DC",
    fullName: "Delivery Challan",
    meaning:
      "Hands a group of LRs to the truck doing the last-mile delivery from the railhead. One DC covers many LRs.",
  },
  {
    id: "ldc",
    term: "LDC",
    fullName: "Local Delivery Challan",
    meaning: "Another name for a Delivery Challan. You will see it in screen names like 'LDC Ack'.",
  },
  {
    id: "dc-wc",
    term: "DC / WC at rail head",
    fullName: "Demurrage Charges / Warpage Charges",
    meaning:
      "The form that records demurrage, warpage and any waiver for a rake at the rail head.",
  },
  {
    id: "demurrage",
    term: "Demurrage",
    meaning:
      "A charge from Indian Railways for keeping a rake or wagon longer than the free time. SK pays it to the railway.",
  },
  {
    id: "warpage",
    term: "Warpage",
    meaning: "A charge for goods damaged during rail transit.",
  },
  {
    id: "waiver",
    term: "Waiver (Waivel)",
    meaning: "A letter from the railway that reduces the demurrage SK owes.",
  },
  {
    id: "detention",
    term: "Detention",
    meaning:
      "A charge SK makes to the customer when trucks or wagons are kept waiting too long at their site. Not the same as demurrage, which SK pays to the railway.",
  },
  {
    id: "hamali",
    term: "Hamali",
    meaning: "Payment for labour that loads and unloads goods.",
  },
  {
    id: "broker",
    term: "Broker / Transporter",
    meaning:
      "An outside party that supplies hired trucks or handles goods at the railhead. SK pays them through payment slips.",
  },
  {
    id: "market-vehicle",
    term: "Market vehicle",
    meaning: "A truck hired from outside, as opposed to one of SK's own vehicles.",
  },
  {
    id: "gta",
    term: "GTA",
    fullName: "Goods Transport Agency",
    meaning: "How GST law classifies a transport company like SK. GTA services have their own GST rules.",
  },
  {
    id: "rcm",
    term: "RCM",
    fullName: "Reverse Charge Mechanism",
    meaning:
      "A GST rule where the customer, not SK, pays the GST to the government. SK then does not charge GST on the bill.",
  },
  {
    id: "place-of-supply",
    term: "Place of supply",
    meaning:
      "The state the goods are going to, for GST. It decides whether the bill has CGST + SGST or IGST.",
  },
  {
    id: "gst",
    term: "CGST / SGST / IGST",
    meaning:
      "The parts of GST. Within the same state: CGST + SGST. Between two states: IGST.",
  },
  {
    id: "hsn-sac",
    term: "HSN / SAC",
    meaning: "Tax codes for goods (HSN) and services (SAC). Transport services usually use 9965.",
  },
  {
    id: "tds",
    term: "TDS",
    fullName: "Tax Deducted at Source",
    meaning:
      "Tax the customer keeps back from a payment (about 2%) and pays to the government for SK. Record it on the receipt.",
  },
  {
    id: "log-slip",
    term: "Log Slip",
    meaning:
      "The official record that a vehicle finished a trip, with end kilometres, time and expenses. Created when the trip is closed.",
  },
  {
    id: "vehicle-journey",
    term: "Vehicle journey",
    meaning: "A vehicle's full outing from leaving to coming back. It can include more than one trip.",
  },
  {
    id: "happay",
    term: "Happay card",
    meaning: "A prepaid card given to drivers for fuel and toll. Its spends are matched with trip expenses.",
  },
  {
    id: "ewb",
    term: "E-way bill (EWB)",
    meaning:
      "A government transit pass needed for goods worth more than ₹50,000. The customer makes it; SK attaches it to the LR.",
  },
  {
    id: "part-b",
    term: "Part-B",
    meaning: "The part of the e-way bill with the vehicle number. SK updates it when the truck is assigned.",
  },
  {
    id: "transin",
    term: "TRANSIN",
    meaning: "SK's transporter ID from GSTN, used when updating Part-B of an e-way bill.",
  },
  {
    id: "rate-matrix",
    term: "Rate matrix",
    meaning: "The table of freight rates by route and vehicle type. Orders use it to work out the freight.",
  },
  {
    id: "master-data",
    term: "Master data",
    meaning: "The basic lists the ERP picks from: customers, routes, rates, vehicles, drivers and so on.",
  },
  {
    id: "fy",
    term: "FY",
    fullName: "Financial Year",
    meaning: "April to March. FY26-27 means April 2026 to March 2027. Document numbers restart each FY.",
  },
  {
    id: "docket",
    term: "Docket",
    meaning: "The courier tracking number used when the paper POD is sent back to head office.",
  },
  {
    id: "branch-scope",
    term: "Branch access",
    meaning: "Which branches you can see and work in. Your administrator sets it.",
  },
];
