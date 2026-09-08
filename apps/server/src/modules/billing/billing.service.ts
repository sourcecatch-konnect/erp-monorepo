import {
  Prisma,
  type BillTaxTreatment,
  type BillType,
  type LRChargeEffect,
} from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";

type DbClient = typeof db | Prisma.TransactionClient;

export const billDetailInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      branchCode: true,
      address: true,
      gstNo: true,
      city: { select: { id: true, name: true, state: true } },
    },
  },
  company: {
    select: {
      id: true,
      name: true,
      address: true,
      companyPAN: true,
      city: { select: { id: true, name: true } },
      state: true,
    },
  },
  serviceCustomer: {
    select: {
      id: true,
      name: true,
      splitBillsByChargeType: true,
      address: true,
      gstNo: true,
      customerPAN: true,
      city: { select: { id: true, name: true } },
      state: true,
    },
  },
  billingCustomer: {
    select: {
      id: true,
      name: true,
      address: true,
      gstNo: true,
      customerPAN: true,
      city: { select: { id: true, name: true } },
      state: true,
    },
  },
  billingLocation: {
    include: { city: { include: { state: true } } },
  },
  supplierState: true,
  placeOfSupplyState: true,
  lines: {
    orderBy: { lineNumber: "asc" as const },
    include: {
      lr: {
        select: {
          id: true,
          lrNumber: true,
          createdAt: true,
          status: true,
          billingStatus: true,
          invoiceNumber: true,
          invoiceAmount: true,
          totalWeight: true,
          unit: true,
          weightUnit: { select: { id: true, code: true, name: true } },
          loadingLocation: {
            select: {
              id: true,
              name: true,
              address: true,
              gstNo: true,
              city: { select: { id: true, name: true, state: true } },
            },
          },
          unloadingLocation: {
            select: {
              id: true,
              name: true,
              address: true,
              gstNo: true,
              city: { select: { id: true, name: true, state: true } },
            },
          },
          goods: {
            orderBy: { createdAt: "asc" as const },
            select: {
              id: true,
              name: true,
              description: true,
              quantity: true,
              unit: true,
              weight: true,
              quantityUnit: { select: { id: true, code: true, name: true } },
              weightUnit: { select: { id: true, code: true, name: true } },
            },
          },
          delivery: {
            select: {
              deliveredAt: true,
              reportedAt: true,
              unloadingAt: true,
              unloadingCharges: true,
            },
          },
          acknowledgement: {
            select: {
              receivedAt: true,
              detentionDays: true,
              detentionAmount: true,
              damageAmount: true,
            },
          },
          group: {
            select: {
              id: true,
              groupNumber: true,
              transportType: true,
              isMarketVehicle: true,
              marketVehicleNumber: true,
              baseFreightAmount: true,
              order: { select: { id: true, orderNumber: true } },
              consignor: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  gstNo: true,
                  customerPAN: true,
                  city: { select: { id: true, name: true } },
                  state: true,
                },
              },
              consignee: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  gstNo: true,
                  customerPAN: true,
                  city: { select: { id: true, name: true } },
                  state: true,
                },
              },
              originBranch: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  city: { select: { id: true, name: true, state: true } },
                },
              },
              destinationBranch: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  city: { select: { id: true, name: true, state: true } },
                },
              },
              transport: { select: { id: true, name: true } },
              marketTransport: { select: { id: true, name: true } },
              marketVehicle: {
                select: {
                  id: true,
                  vehicleNumber: true,
                  bodyType: true,
                  capacityMT: true,
                  vehicleTypeRef: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              primaryTrip: {
                select: {
                  id: true,
                  tripNumber: true,
                  vehicle: {
                    select: {
                      id: true,
                      vehicleNumber: true,
                      bodyType: true,
                      capacityMT: true,
                      vehicleTypeRef: {
                        select: { id: true, code: true, name: true },
                      },
                    },
                  },
                },
              },
              secondaryTrip: {
                select: {
                  id: true,
                  tripNumber: true,
                  vehicle: {
                    select: {
                      id: true,
                      vehicleNumber: true,
                      bodyType: true,
                      capacityMT: true,
                      vehicleTypeRef: {
                        select: { id: true, code: true, name: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      lrCharge: { select: { id: true, status: true, type: true } },
    },
  },
  lrLinks: {
    orderBy: { createdAt: "asc" as const },
    include: {
      lr: {
        select: {
          id: true,
          lrNumber: true,
          status: true,
          billingStatus: true,
          totalWeight: true,
          unit: true,
          weightUnit: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  taxLines: { orderBy: { taxType: "asc" as const } },
  statusHistory: { orderBy: { changedAt: "asc" as const } },
  journalEntry: {
    include: {
      lines: {
        orderBy: { lineNumber: "asc" as const },
        include: {
          ledger: { select: { id: true, name: true, code: true, kind: true } },
        },
      },
      allocations: true,
    },
  },
} satisfies Prisma.BillInclude;

const signed = (amount: bigint, effect: LRChargeEffect) =>
  effect === "DEDUCTION" ? -amount : amount;

const taxForRate = (taxable: bigint, rateBps: number) =>
  (taxable * BigInt(rateBps) + 5000n) / 10000n;

export const evaluateBillingForLR = async (
  client: DbClient,
  lrId: string,
  actorId: string,
) => {
  const lr = await client.lorryReceipt.findUnique({
    where: { id: lrId },
    include: {
      group: {
        select: {
          id: true,
          baseFreightAmount: true,
          // Base freight is truck/group-level. Keep one deterministic LR as
          // its billing owner so a multi-consignment truck is not charged once
          // per LR. LR-specific POD charges remain on their respective LRs.
          lorryReceipts: {
            orderBy: [{ createdAt: "asc" }, { lrNumber: "asc" }],
            take: 1,
            select: { id: true },
          },
        },
      },
      delivery: { select: { id: true, unloadingCharges: true } },
      acknowledgement: {
        select: {
          id: true,
          detentionAmount: true,
          damageAmount: true,
        },
      },
    },
  });
  if (!lr) throw new NotFoundError("Lorry receipt not found");
  if (lr.status !== "ACKNOWLEDGED" || !lr.acknowledgement) {
    await client.lorryReceipt.update({
      where: { id: lrId },
      data: { billingStatus: "NOT_BILLABLE" },
    });
    return { lrId, billingStatus: "NOT_BILLABLE" as const, created: 0 };
  }

  const ownsGroupFreight = lr.group.lorryReceipts[0]?.id === lr.id;
  if (ownsGroupFreight) {
    const groupFreightCharges = await client.lRCharge.findMany({
      where: {
        type: "FREIGHT",
        source: "LR_FREIGHT",
        sourceReferenceId: lr.group.id,
      },
      select: {
        id: true,
        lrId: true,
        createdAt: true,
        billLines: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const canonicalFreight =
      groupFreightCharges.find(
        (charge) => charge.lrId === lr.id && charge.billLines.length > 0,
      ) ??
      groupFreightCharges.find((charge) => charge.billLines.length > 0) ??
      groupFreightCharges.find((charge) => charge.lrId === lr.id) ??
      groupFreightCharges[0];

    if (
      canonicalFreight &&
      canonicalFreight.lrId !== lr.id &&
      canonicalFreight.billLines.length === 0
    ) {
      await client.lRCharge.update({
        where: { id: canonicalFreight.id },
        data: { lrId: lr.id, updatedById: actorId },
      });
    }
    for (const duplicate of groupFreightCharges) {
      if (duplicate.id !== canonicalFreight?.id && duplicate.billLines.length === 0) {
        try {
          await client.lRCharge.delete({ where: { id: duplicate.id } });
        } catch (err) {
          console.error(`Skipping duplicate LRCharge ${duplicate.id} delete:`, err);
        }
      }
    }
  }
  const candidates = [
    ownsGroupFreight &&
      lr.group.baseFreightAmount &&
      lr.group.baseFreightAmount > 0n
      ? {
        type: "FREIGHT" as const,
        effect: "ADDITION" as const,
        source: "LR_FREIGHT" as const,
        sourceReferenceId: lr.group.id,
        amountPaise: lr.group.baseFreightAmount,
        description: "LR freight",
        isTaxable: true,
      }
      : null,
    lr.acknowledgement.detentionAmount &&
      lr.acknowledgement.detentionAmount > 0n
      ? {
        type: "DETENTION" as const,
        effect: "ADDITION" as const,
        source: "ACKNOWLEDGEMENT" as const,
        sourceReferenceId: lr.acknowledgement.id,
        amountPaise: lr.acknowledgement.detentionAmount,
        description: "POD detention",
        isTaxable: true,
      }
      : null,
    lr.delivery?.unloadingCharges && lr.delivery.unloadingCharges > 0n
      ? {
        type: "UNLOADING" as const,
        effect: "ADDITION" as const,
        source: "ACKNOWLEDGEMENT" as const,
        sourceReferenceId: lr.delivery.id,
        amountPaise: lr.delivery.unloadingCharges,
        description: "Delivery unloading",
        isTaxable: true,
      }
      : null,
    lr.acknowledgement.damageAmount && lr.acknowledgement.damageAmount > 0n
      ? {
        type: "DAMAGE_DEDUCTION" as const,
        effect: "DEDUCTION" as const,
        source: "ACKNOWLEDGEMENT" as const,
        sourceReferenceId: lr.acknowledgement.id,
        amountPaise: lr.acknowledgement.damageAmount,
        description: "POD damage deduction",
        isTaxable: false,
      }
      : null,
  ].filter((value) => value !== null);

  let created = 0;
  for (const charge of candidates) {
    const existing = await client.lRCharge.findFirst({
      where: {
        ...(charge.source === "LR_FREIGHT" ? {} : { lrId }),
        type: charge.type,
        source: charge.source,
        sourceReferenceId: charge.sourceReferenceId,
      },
      select: {
        id: true,
        billLines: { select: { id: true } },
      },
    });
    if (!existing) {
      await client.lRCharge.create({
        data: {
          lrId,
          ...charge,
          status: "APPROVED",
          approvedAmountPaise: charge.amountPaise,
          approvedAt: new Date(),
          createdById: actorId,
          approvedById: actorId,
        },
      });
      created += 1;
    } else if (existing.billLines.length === 0) {
      await client.lRCharge.update({
        where: { id: existing.id },
        data: {
          amountPaise: charge.amountPaise,
          approvedAmountPaise: charge.amountPaise,
          effect: charge.effect,
          description: charge.description,
          isTaxable: charge.isTaxable,
          status: "APPROVED",
          updatedById: actorId,
          approvedById: actorId,
          approvedAt: new Date(),
        },
      });
    }
  }

  const candidateKeys = new Set(
    candidates.map(
      (charge) => `${charge.type}|${charge.source}|${charge.sourceReferenceId}`,
    ),
  );
  const staleAutoCharges = await client.lRCharge.findMany({
    where: { lrId, source: { not: "MANUAL" } },
    select: {
      id: true,
      type: true,
      source: true,
      sourceReferenceId: true,
      billLines: { select: { id: true } },
    },
  });
  for (const charge of staleAutoCharges) {
    const key = `${charge.type}|${charge.source}|${charge.sourceReferenceId}`;
    if (!candidateKeys.has(key) && charge.billLines.length === 0) {
      try {
        await client.lRCharge.delete({ where: { id: charge.id } });
      } catch (err) {
        console.error(`Skipping stale LRCharge ${charge.id} delete:`, err);
      }
    }
  }

  const approved = await client.lRCharge.count({
    where: {
      lrId,
      status: { in: ["APPROVED", "PARTIALLY_BILLED"] },
    },
  });
  const billingStatus = approved > 0 ? "READY_TO_BILL" : "NOT_BILLABLE";
  await client.lorryReceipt.update({
    where: { id: lrId },
    data: { billingStatus },
  });
  return { lrId, billingStatus, created };
};
export const calculateBill = async (
  args: {
    billType: BillType;
    billDate: Date;
    supplierStateId: string;
    placeOfSupplyStateId: string;
    charges: Array<{
      amountPaise: bigint;
      approvedAmountPaise: bigint | null;
      effect: LRChargeEffect;
      isTaxable: boolean;
    }>;
  },
  client: DbClient = db,
) => {
  const subtotalAmountPaise = args.charges.reduce(
    (sum, charge) =>
      sum + signed(charge.approvedAmountPaise ?? charge.amountPaise, charge.effect),
    0n,
  );
  const taxableAmountPaise = args.charges.reduce(
    (sum, charge) =>
      charge.isTaxable
        ? sum + signed(charge.approvedAmountPaise ?? charge.amountPaise, charge.effect)
        : sum,
    0n,
  );
  if (subtotalAmountPaise < 0n || taxableAmountPaise < 0n) {
    throw new BadRequestError("Bill deductions cannot exceed additions");
  }

  // GST is charged forward on every non-ROAD bill. Intra vs inter state (so
  // CGST+SGST vs IGST) is decided purely by the operator-picked Place of
  // Supply against the billing branch's state.
  const taxTreatment: BillTaxTreatment =
    args.billType === "ROAD"
      ? "NO_GST"
      : args.supplierStateId === args.placeOfSupplyStateId
        ? "INTRA_STATE"
        : "INTER_STATE";

  let taxRule = null;
  const taxLines: Array<{
    taxType: "CGST" | "SGST" | "IGST";
    rateBps: number;
    taxableAmountPaise: bigint;
    taxAmountPaise: bigint;
  }> = [];
  if (taxTreatment === "INTRA_STATE" || taxTreatment === "INTER_STATE") {
    taxRule = await client.billingTaxRule.findFirst({
      where: {
        billType: args.billType,
        isActive: true,
        effectiveFrom: { lte: args.billDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: args.billDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!taxRule) {
      throw new BadRequestError(
        "No effective GST rule is configured for this bill type and date",
      );
    }
    if (taxTreatment === "INTRA_STATE") {
      taxLines.push(
        {
          taxType: "CGST",
          rateBps: taxRule.cgstRateBps,
          taxableAmountPaise,
          taxAmountPaise: taxForRate(taxableAmountPaise, taxRule.cgstRateBps),
        },
        {
          taxType: "SGST",
          rateBps: taxRule.sgstRateBps,
          taxableAmountPaise,
          taxAmountPaise: taxForRate(taxableAmountPaise, taxRule.sgstRateBps),
        },
      );
    } else {
      taxLines.push({
        taxType: "IGST",
        rateBps: taxRule.igstRateBps,
        taxableAmountPaise,
        taxAmountPaise: taxForRate(taxableAmountPaise, taxRule.igstRateBps),
      });
    }
  }

  const taxAmountPaise = taxLines.reduce((sum, line) => sum + line.taxAmountPaise, 0n);
  const beforeRound = subtotalAmountPaise + taxAmountPaise;
  const roundedRupees = (beforeRound + 50n) / 100n;
  const totalAmountPaise = roundedRupees * 100n;
  const roundOffPaise = totalAmountPaise - beforeRound;
  return {
    taxRuleId: taxRule?.id ?? null,
    taxTreatment,
    subtotalAmountPaise,
    taxableAmountPaise,
    taxAmountPaise,
    roundOffPaise,
    totalAmountPaise,
    outstandingAmountPaise: totalAmountPaise,
    taxLines,
  };
};
export const refreshLRBillingStatus = async (
  tx: Prisma.TransactionClient,
  lrId: string,
) => {
  const charges = await tx.lRCharge.findMany({
    where: { lrId, status: { not: "CANCELLED" } },
    select: {
      id: true,
      status: true,
      amountPaise: true,
      approvedAmountPaise: true,
      billLines: {
        where: { bill: { status: { not: "CANCELLED" } } },
        select: { amountPaise: true, bill: { select: { status: true } } },
      },
    },
  });

  let anyBilled = false;
  let allBilled = charges.length > 0;
  const toBilled: string[] = [];
  const toPartial: string[] = [];
  const toApproved: string[] = [];

  for (const charge of charges) {
    const target = charge.approvedAmountPaise ?? charge.amountPaise;
    const allocated = charge.billLines
      .filter((line) =>
        ["FINALISED", "SENT", "PARTIALLY_PAID", "PAID"].includes(
          line.bill.status,
        ),
      )
      .reduce((sum, line) => sum + line.amountPaise, 0n);

    anyBilled ||= allocated > 0n;
    allBilled &&= allocated >= target;

    const nextStatus =
      allocated >= target
        ? "BILLED"
        : allocated > 0n
          ? "PARTIALLY_BILLED"
          : charge.status === "BILLED" || charge.status === "PARTIALLY_BILLED"
            ? "APPROVED"
            : charge.status;

    if (nextStatus === charge.status) continue; // no-op — skip the write entirely

    if (nextStatus === "BILLED") toBilled.push(charge.id);
    else if (nextStatus === "PARTIALLY_BILLED") toPartial.push(charge.id);
    else if (nextStatus === "APPROVED") toApproved.push(charge.id);
  }

  // At most 3 write queries total, regardless of how many charges the LR has.
  if (toBilled.length)
    await tx.lRCharge.updateMany({
      where: { id: { in: toBilled } },
      data: { status: "BILLED" },
    });
  if (toPartial.length)
    await tx.lRCharge.updateMany({
      where: { id: { in: toPartial } },
      data: { status: "PARTIALLY_BILLED" },
    });
  if (toApproved.length)
    await tx.lRCharge.updateMany({
      where: { id: { in: toApproved } },
      data: { status: "APPROVED" },
    });

  const nextBillingStatus = allBilled
    ? "BILLED"
    : anyBilled
      ? "PARTIALLY_BILLED"
      : charges.length
        ? "READY_TO_BILL"
        : "NOT_BILLABLE";

  await tx.lorryReceipt.updateMany({
    where: { id: lrId, billingStatus: { not: nextBillingStatus } },
    data: { billingStatus: nextBillingStatus },
  });
};