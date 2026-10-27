import {
  IconArrowsDiagonalMinimize2,
  IconArrowsSort,
  IconBell,
  IconBook2,
  IconBuildingStore,
  IconCheck,
  IconClipboardList,
  IconColumns3,
  IconCurrencyRupee,
  IconFileInvoice,
  IconFilter,
  IconFolderOpen,
  IconHistory,
  IconLayoutSidebar,
  IconListCheck,
  IconPackage,
  IconQrcode,
  IconRoute,
  IconSearch,
  IconShieldLock,
  IconThumbUp,
  IconTruck,
  IconTruckDelivery,
  IconUpload,
  IconUserCircle,
  IconUserPlus,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

/**
 * Per-lesson detail for a track step (A4). The catalog in
 * `@skerp/types/training/catalog` holds the step's key, title and one-line
 * summary; this file holds what turns that into a lesson: the numbered things
 * to do, what must exist first, how the document's status moves, the words
 * used and the one thing to watch out for.
 *
 * Keyed by `TrainingStep.key`. A step with no entry still renders — it just
 * shows its summary and the open / done buttons, so content can be written
 * track by track.
 *
 * Wording rule (docs/UI-UX.md): the operator's words, short sentences, no
 * machine values. Keep `group` the same as the lane the work belongs to, so
 * the lesson list reads like the business flow.
 */

/** One numbered thing to do, in order. */
export type LessonAction = {
  icon: Icon;
  title: string;
  /** One or two short sentences. Screen and button names in plain text. */
  detail: string;
};

/** How a document's status moves while doing this lesson. */
export type LessonStatusFlow = {
  document: string;
  steps: readonly string[];
  /** The unhappy path, in one sentence. */
  also?: string;
};

export type LessonContent = {
  /** Lane heading the lesson sits under in the lesson list. */
  group: string;
  icon: Icon;
  /** Replaces the catalog summary when the lesson needs a fuller opening. */
  intro?: string;
  does: readonly LessonAction[];
  /** What has to exist before the lesson can be done. */
  needs?: readonly string[];
  statusFlow?: LessonStatusFlow;
  /** Glossary ids (see content/glossary.ts) for the words used here. */
  terms?: readonly string[];
  /** The mistake people actually make. */
  warn?: string;
};

export const LESSON_CONTENT: Record<string, LessonContent> = {
  /* ---------------------------------------------------------------- */
  /* ERP basics — the track everyone starts with                       */
  /* ---------------------------------------------------------------- */

  "basics.navigation": {
    group: "Getting around",
    icon: IconLayoutSidebar,
    intro:
      "Everything in the ERP opens from the menu on the left. Learn that and you can find any screen.",
    does: [
      {
        icon: IconLayoutSidebar,
        title: "Open a module from the left menu",
        detail:
          "The menu is grouped the way the business works: Masters, Orders, LRs, Trips, Accounts.",
      },
      {
        icon: IconArrowsDiagonalMinimize2,
        title: "Make the menu smaller",
        detail:
          "The button at the top left shrinks the menu to icons, so a wide table has more room.",
      },
      {
        icon: IconRoute,
        title: "Use the trail at the top to go back",
        detail:
          "The line of links above the page title shows where you are and takes you back a level.",
      },
    ],
    terms: ["master-data"],
  },

  "basics.my-role": {
    group: "Getting around",
    icon: IconUserCircle,
    does: [
      {
        icon: IconUserCircle,
        title: "Read your role and your responsibilities",
        detail: "The block at the top says what your role is responsible for.",
      },
      {
        icon: IconListCheck,
        title: "Look at the training set for you",
        detail:
          "Required tracks first, then the ones you can take if you help out elsewhere.",
      },
    ],
  },

  "basics.process-map": {
    group: "Getting around",
    icon: IconRoute,
    intro:
      "The process map is the whole business on one screen, from the customer's call to the money arriving.",
    does: [
      {
        icon: IconRoute,
        title: "Follow the flow from top to bottom",
        detail: "Set up, booking, transport, delivery, billing, receipts.",
      },
      {
        icon: IconUserCircle,
        title: "Set the highlight to Me",
        detail:
          "Only your own steps light up, so you can see your part of the flow.",
      },
      {
        icon: IconFolderOpen,
        title: "Click any step",
        detail:
          "It opens what happens there, who does it, and what is needed first.",
      },
    ],
  },

  "basics.lists": {
    group: "Everyday screens",
    icon: IconFilter,
    intro:
      "Every list screen in the ERP works the same way. Learn it once and all of them are easy.",
    does: [
      {
        icon: IconSearch,
        title: "Type in the search box",
        detail:
          "It searches the whole list, not just the page you are looking at.",
      },
      {
        icon: IconFilter,
        title: "Narrow it with the filters",
        detail: "Filter by status, branch or date to find a record quickly.",
      },
      {
        icon: IconArrowsSort,
        title: "Click a column heading to sort",
        detail: "Click again to flip it the other way.",
      },
      {
        icon: IconColumns3,
        title: "Hide columns you don't need",
        detail:
          "The columns button lets you turn off the ones that get in your way.",
      },
    ],
  },

  "basics.notifications": {
    group: "Everyday screens",
    icon: IconBell,
    does: [
      {
        icon: IconBell,
        title: "Open the bell at the top right",
        detail:
          "It shows only the alerts meant for you, such as an order waiting for approval.",
      },
      {
        icon: IconFolderOpen,
        title: "Click an alert to open the record",
        detail: "It takes you straight to the order, LR or trip it is about.",
      },
    ],
  },

  "basics.profile": {
    group: "Everyday screens",
    icon: IconUserCircle,
    does: [
      {
        icon: IconUserCircle,
        title: "Check your name and mobile number",
        detail: "Your name is what other people see on records you create.",
      },
      {
        icon: IconBell,
        title: "Choose which alerts you want",
        detail:
          "Turn off the ones that are not your job so the bell stays useful.",
      },
    ],
  },

  "basics.glossary": {
    group: "Everyday screens",
    icon: IconBook2,
    intro:
      "The ERP uses the transport trade's words. The glossary explains every one in plain language.",
    does: [
      {
        icon: IconSearch,
        title: "Search for a word you saw on a screen",
        detail: "Try POD, demurrage or TBB. It filters as you type.",
      },
      {
        icon: IconBook2,
        title: "Come back whenever a word stops you",
        detail:
          "Hard words in the training are clickable and jump straight to the glossary.",
      },
    ],
    terms: ["lr", "pod", "tbb", "demurrage"],
  },

  /* ---------------------------------------------------------------- */
  /* Administration track                                              */
  /* ---------------------------------------------------------------- */

  "admin.users": {
    group: "Users and roles",
    icon: IconUserPlus,
    intro:
      "A user is one person's login. Every user gets exactly one role, and the role decides what they can do.",
    does: [
      {
        icon: IconUserPlus,
        title: "Press New user",
        detail: "Open Settings → Users and press New user.",
      },
      {
        icon: IconUserCircle,
        title: "Enter their name, email and mobile",
        detail:
          "The email is the login. Use the person's work email, not a shared one.",
      },
      {
        icon: IconShieldLock,
        title: "Pick their role",
        detail:
          "One role per user. If no role fits, set the role up first rather than inventing a new one here.",
      },
      {
        icon: IconBuildingStore,
        title: "Set the branches they work in",
        detail:
          "All branches, or only the ones you pick. This is what they will be able to see.",
      },
    ],
    needs: [
      "The person's name and work email",
      "A role that matches what they will do",
    ],
    terms: ["branch-scope"],
    warn: "Never share one login between two people. The audit log records who did what, and a shared login makes that useless.",
  },

  "admin.roles": {
    group: "Users and roles",
    icon: IconShieldLock,
    intro:
      "A role is a set of permissions. Change a role once and everyone with that role gets the change — so change it carefully.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Settings → Roles",
        detail:
          "The built-in roles are Admin, Branch Manager, Operations, Accounts and Read-Only Auditor.",
      },
      {
        icon: IconListCheck,
        title: "Open a role and read its permissions",
        detail:
          "They are grouped by module, in the words the screens use — Book new orders, Approve bills.",
      },
      {
        icon: IconShieldLock,
        title: "Turn a permission on or off",
        detail:
          "Think about everyone who holds the role, not the one person who asked. Save when you are sure.",
      },
      {
        icon: IconUsers,
        title: "Check who holds the role",
        detail:
          "The role shows its users, so you can see who your change affects.",
      },
    ],
    needs: [
      "Permission to manage roles",
      "A clear idea of what the role should be able to do",
    ],
    warn: "Built-in roles are shared across every branch. If only one person needs something extra, give them a special permission instead of widening the role for everybody.",
  },

  "admin.access": {
    group: "Users and roles",
    icon: IconBuildingStore,
    intro:
      "Branch access decides which records a user can see at all. The role says what they can do; the branch says where.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Settings → Access",
        detail: "Find the user you want to change.",
      },
      {
        icon: IconBuildingStore,
        title: "Choose all branches, or pick them",
        detail:
          "Branch staff normally get only their own branch. Owners and auditors usually get all.",
      },
      {
        icon: IconShieldLock,
        title: "Add a special permission only if you must",
        detail:
          "Allow or Block one permission for this person alone, when changing the whole role would be wrong.",
      },
    ],
    needs: [
      "The user already exists",
      "You know which branches they actually work in",
    ],
    terms: ["branch-scope"],
    warn: "Too much branch access is the quiet mistake: the person sees other branches' customers and rates. Give the least they need.",
  },

  "admin.notifications": {
    group: "Settings",
    icon: IconBell,
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Settings → Notifications",
        detail: "The rules say who is told about which event.",
      },
      {
        icon: IconBell,
        title: "Pick the event",
        detail:
          "A new order waiting for approval, a trip running late, a bill waiting for review.",
      },
      {
        icon: IconUsers,
        title: "Choose who gets it",
        detail:
          "Send to a role rather than a named person, so it keeps working when staff change.",
      },
    ],
    warn: "Alerting everybody about everything trains people to ignore the bell. Alert only the person who has to act.",
  },

  "admin.audit-log": {
    group: "Settings",
    icon: IconHistory,
    intro:
      "The audit log is the record of who changed what. It is how a disputed change gets settled.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Settings → Audit log",
        detail: "It shows the record, who changed it, what happened and when.",
      },
      {
        icon: IconFilter,
        title: "Filter to what you are looking for",
        detail: "By person, by date, or by the kind of record.",
      },
      {
        icon: IconSearch,
        title: "Open an entry to see the detail",
        detail: "It shows what the value was before and after the change.",
      },
    ],
    needs: ["Permission to view the audit log"],
    warn: "The log cannot be edited or deleted, by anyone. That is the point of it — do not promise someone a change can be erased.",
  },

  /* ---------------------------------------------------------------- */
  /* Operations track                                                  */
  /* ---------------------------------------------------------------- */

  "ops.masters": {
    group: "Set up",
    icon: IconListCheck,
    intro:
      "Master data is the lists the rest of the ERP picks from. An order cannot be booked until the customer, the route and the rate all exist.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Customers and find your customer",
        detail:
          "Search by name. If the customer is not there, ask the person who manages masters to add them — do not book under a similar name.",
      },
      {
        icon: IconUsers,
        title: "Check the pickup and delivery locations",
        detail:
          "Open the customer and look at its locations. The order's from and to addresses are picked from this list.",
      },
      {
        icon: IconRoute,
        title: "Check the route exists",
        detail:
          "A route joins the from branch to the to branch. No route, no order.",
      },
      {
        icon: IconCurrencyRupee,
        title: "Check the rate in the rate matrix",
        detail:
          "The freight on the order is worked out from this rate. If it is missing, the order will not price itself.",
      },
    ],
    needs: ["Nothing. This is where everything starts."],
    terms: ["master-data", "rate-matrix"],
    warn: "Two customers with nearly the same name is the most common mistake here. Check the GST number before you pick one.",
  },

  "ops.book-order": {
    group: "Booking",
    icon: IconClipboardList,
    intro:
      "An order is the customer's request to move goods: from which branch to which branch, when, and by truck or by weight. Saving it sends it for approval.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Press New order",
        detail: "Open Orders and press New order at the top right.",
      },
      {
        icon: IconUsers,
        title: "Pick the customer and the two branches",
        detail:
          "Customer, from branch, to branch. The route and its rate are found from the two branches.",
      },
      {
        icon: IconTruck,
        title: "Enter the pickup date and the trucks",
        detail:
          "Pickup date, vehicle type and how many trucks. For a weight-based order, enter the weight instead.",
      },
      {
        icon: IconCheck,
        title: "Save it",
        detail:
          "Saving sends it to a manager. The order sits at Pending approval until they confirm it.",
      },
    ],
    needs: [
      "The customer and its pickup and delivery locations",
      "A route between the two branches",
      "A rate for that route in the rate matrix",
      "The vehicle type, for truck orders",
    ],
    statusFlow: {
      document: "Order",
      steps: [
        "Pending approval",
        "Confirmed",
        "LR created",
        "In progress",
        "Completed",
      ],
      also: "Rejected or Cancelled if it does not go ahead.",
    },
    terms: ["order", "tbb", "to-pay", "rate-matrix"],
    warn: "Check the freight the ERP worked out before you save. If it looks wrong, the rate matrix is wrong — fix that, do not type over the number.",
  },

  "ops.order-status": {
    group: "Booking",
    icon: IconThumbUp,
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Orders and look at the status column",
        detail: "Your order says Pending approval until a manager acts on it.",
      },
      {
        icon: IconCheck,
        title: "Wait for Confirmed",
        detail:
          "Only a Confirmed order can have LRs made from it. If it says Rejected, open it and read the reason.",
      },
    ],
    needs: ["An order you have booked"],
    statusFlow: {
      document: "Order",
      steps: ["Pending approval", "Confirmed"],
      also: "or Rejected, with the manager's reason on the order.",
    },
    terms: ["order"],
  },

  "ops.create-lr": {
    group: "Booking",
    icon: IconFileInvoice,
    intro:
      "The LR is the legal proof that SK accepted the goods. Make one LR for each consignment. Finalising gives it its LR number.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open the confirmed order and press Make LR",
        detail:
          "From Orders, find the order showing Confirmed. This creates the LR group the LRs belong to.",
      },
      {
        icon: IconUsers,
        title: "Fill who sends and who receives",
        detail:
          "The consignor is usually the customer who booked. The consignee is whoever takes delivery at the other end, with their full address.",
      },
      {
        icon: IconPackage,
        title: "Add the goods and check the freight",
        detail:
          "Description, number of packages and weight. The freight comes from the rate matrix — change it only if your branch allows it.",
      },
      {
        icon: IconCheck,
        title: "Finalise it",
        detail:
          "Only now does the LR get its number. A draft LR has no number and cannot be put on a trip.",
      },
    ],
    needs: [
      "An order that is already Confirmed by a manager",
      "The consignee's name and delivery address",
      "What the goods are and how much they weigh",
    ],
    statusFlow: {
      document: "LR",
      steps: ["Draft", "Finalised", "In trip", "Delivered"],
      also: "Cancelled if the consignment does not move.",
    },
    terms: ["lr", "consignor", "consignee", "fy"],
    warn: "Check the consignee address before you finalise. Once the LR number is issued, changing the address needs a manager.",
  },

  "ops.ewaybill": {
    group: "Booking",
    icon: IconQrcode,
    intro:
      "The e-way bill is the government document that must travel with the goods. The customer usually generates it and gives you the number.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open the LR and go to the e-way bill",
        detail:
          "Attach the e-way bill to the LR it belongs to, not to the order.",
      },
      {
        icon: IconQrcode,
        title: "Enter the number and its valid-until date",
        detail:
          "Type the number the customer gave you and the date it expires.",
      },
      {
        icon: IconTruck,
        title: "Update Part-B with the vehicle number",
        detail:
          "Part-B is the vehicle. It must be filled before the truck leaves, and updated if the vehicle changes on the way.",
      },
    ],
    needs: [
      "A finalised LR",
      "The e-way bill number from the customer",
      "The vehicle number",
    ],
    terms: ["ewb", "part-b", "transin"],
    warn: "An expired e-way bill is a fine at the checkpoint. If the truck is delayed, extend it before it expires — you cannot extend it afterwards.",
  },

  "ops.trip": {
    group: "Road transport",
    icon: IconTruck,
    intro:
      "A trip is one vehicle going out with one or more LRs on it. Creating it also starts the vehicle's journey.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Press New trip",
        detail: "Open Trips and press New trip.",
      },
      {
        icon: IconTruck,
        title: "Pick the vehicle and the driver",
        detail:
          "Own vehicle or a market vehicle. A market vehicle also needs its owner and the hire rate.",
      },
      {
        icon: IconFileInvoice,
        title: "Attach the LRs it carries",
        detail:
          "Only finalised LRs can be attached. One trip can carry several LRs.",
      },
      {
        icon: IconCheck,
        title: "Save and start the journey",
        detail:
          "Enter the start kilometres so the journey can be closed correctly later.",
      },
    ],
    needs: [
      "Finalised LRs to load",
      "A vehicle and a driver",
      "The start kilometre reading",
    ],
    terms: ["market-vehicle", "vehicle-journey"],
  },

  "ops.expenses": {
    group: "Road transport",
    icon: IconCurrencyRupee,
    does: [
      {
        icon: IconFolderOpen,
        title: "Open the trip and go to Expenses",
        detail:
          "Enter the spends as they happen, not all at the end of the month.",
      },
      {
        icon: IconCurrencyRupee,
        title: "Enter diesel, toll and other spends",
        detail:
          "Each line needs the amount and what it was for. Attach the bill where you have it.",
      },
      {
        icon: IconUsers,
        title: "Record cash given to the driver",
        detail:
          "Driver advances are entered here too, so the trip's account balances at the end.",
      },
    ],
    needs: ["A trip that has started"],
    terms: ["happay"],
    warn: "Expenses entered after the journey is closed are painful to correct. Enter them while the trip is running.",
  },

  "ops.deliver": {
    group: "Delivery",
    icon: IconTruckDelivery,
    intro:
      "Delivery is two things: marking the LR delivered, and uploading the signed POD. Accounts cannot bill the LR until the POD is there.",
    does: [
      {
        icon: IconFolderOpen,
        title: "Open Deliveries and find the LR",
        detail: "The LRs out for delivery are listed here with their trip.",
      },
      {
        icon: IconCheck,
        title: "Mark it delivered",
        detail:
          "Enter the date and time the consignee actually took the goods.",
      },
      {
        icon: IconUpload,
        title: "Upload the signed POD",
        detail:
          "Go to the Pending POD tab and upload the photo or scan of the POD the consignee signed.",
      },
    ],
    needs: ["An LR that is on a trip", "The signed POD from the consignee"],
    statusFlow: {
      document: "LR",
      steps: ["In trip", "Delivered", "POD received"],
      also: "An LR sits at Delivered without its POD until someone uploads it.",
    },
    terms: ["pod", "lr"],
    warn: "A missing POD stops the bill. If the consignee will not sign, tell your manager the same day instead of leaving it pending.",
  },
};
