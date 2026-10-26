# 8. What is an LR?

> Last checked: 2026-10-12 · For: everyone

## The LR (Lorry Receipt)

An **LR** is the **transport document** for one consignment. It travels with the goods and says:

- **who** sends them (consignor) and **who** receives them (consignee)
- **from where** (loading point) **to where** (unloading point)
- **what** is carried (goods, quantity, weight)
- the customer's **invoice number** and the **e-way bill**

When the goods arrive, the receiver **signs** the LR. The signed LR is the **proof of delivery**. Without it, we can't bill the customer.

Each LR gets its own **LR number** (e.g. LR 00051).

## The LR group: one per truck

One truck can carry goods for **more than one** loading or unloading point. Each of these is a separate LR. So SKERP puts all LRs of **one truck** together in an **LR group**.

```
 LR GROUP (one truck: MH19-AB-1234)
   ├── LR 00051   Pune factory   → Kolkata warehouse A   200 boxes
   └── LR 00052   Pune factory   → Kolkata warehouse B   120 boxes
```

| | LR group | LR |
|---|---|---|
| **Means** | Everything about **one truck** | **One consignment** on that truck |
| **Holds** | Truck, driver, trip or transporter, freight, advance, road or rail | Loading/unloading point, goods, weight, invoice, e-way bill |
| **How many** | One per truck | One or more per group |
| **Number** | e.g. SKG/HO/26-27/00042 | e.g. LR 00051 |

## How orders, groups and LRs fit together

```
 ORDER  "3 trucks Pune → Kolkata"
   ├── LR group  Truck #1 ──► LR 00051, LR 00052
   ├── LR group  Truck #2 ──► LR 00053
   └── LR group  Truck #3 ──► LR 00054
```

- **1 order** can have **many trucks**.
- **1 truck** = **1 LR group**.
- **1 LR group** can have **many LRs**.

## Two ways to make an LR

| Way | When | How |
|---|---|---|
| **From an order** (normal) | The customer placed an order and it is **Confirmed** | Open the order → **Create LR** |
| **Instant LR** | Urgent job with **no order** in the ERP | Lorry Receipts → **Create LR**. You choose the consignor, consignee and branches yourself |

Use the order route whenever possible. It brings the freight and details from the order automatically.

## The life of an LR

```
 Draft ──Finalise──► Finalised ──Deliver──► Delivered ──Signed LR received──► Acknowledged ──► Bill
```

| Status | Meaning |
|---|---|
| **Draft** | Being prepared. You can still add or remove LRs, change details |
| **Finalised** | Complete and locked. The truck can go. Can be printed for the driver |
| **Delivered** | Goods unloaded at the receiver |
| **Acknowledged** | The **signed LR** has reached the office. The LR is **ready to bill** |

The next chapter explains the **types** of LR. Chapter 10 shows how to create one, step by step.
