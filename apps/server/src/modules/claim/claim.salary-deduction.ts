import type { Prisma } from "../../../generated/prisma/index.js";
import type { db } from "../../../prisma/prisma.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import { postClaimSalaryDeduction, reverseJournal } from "../ledger/posting.service.js";
import { rupeesText } from "./claim.settle.compute.js";

/**
 * C6 — approved DRIVER recoveries deducted through the salary run. Called by
 * driver-finance/salary-run.service at each step of a run:
 *
 *   draft (create / edit) → attach to the driver's line; net pay drops by it
 *   approve               → post Dr Driver / Cr DAMAGE_RECOVERY per recovery
 *   paid                  → recovery RECEIVED
 *   cancel                → voucher reversed, recovery back to pending
 *   removed from a draft  → back to pending, skips that run
 *
 * A recovery sits on at most one salary line (ClaimRecovery.driverSalaryId),
 * so it can't be deducted twice.
 */

type Tx = Prisma.TransactionClient;
type Client = typeof db | Tx;

/** A recovery no live salary line holds. */
const notOnAnyRun = {
  OR: [{ driverSalaryId: null }, { driverSalary: { is: { isActive: false } } }],
} satisfies Prisma.ClaimRecoveryWhereInput;

/** Still to deduct: approved, not posted, on a claim that's still open or settled. */
const deductible = {
  source: "DRIVER",
  status: "APPROVED",
  journalEntryId: null,
  claim: { is: { deletedAt: null, status: { in: ["ACTIVE", "SETTLED"] } } },
} satisfies Prisma.ClaimRecoveryWhereInput;

/**
 * What each driver of this run has deducted (not yet posted), and which free
 * recoveries still need attaching to his line. `runId` is null while the run
 * is being created.
 */
export async function runDeductions(client: Client, runId: string | null, driverIds: string[]) {
  const rows = await client.claimRecovery.findMany({
    where: {
      ...deductible,
      driverId: { in: driverIds },
      OR: runId
        ? [
          { driverSalary: { is: { runId, isActive: true } } },
          {
            AND: [
              notOnAnyRun,
              { OR: [{ deferredFromRunId: null }, { deferredFromRunId: { not: runId } }] },
            ],
          },
        ]
        : [notOnAnyRun],
    },
    select: { id: true, driverId: true, amountPaise: true, driverSalary: { select: { runId: true, isActive: true } } },
  });

  const byDriver = new Map<string, bigint>();
  const toAttach: { recoveryId: string; driverId: string }[] = [];
  for (const row of rows) {
    byDriver.set(row.driverId!, (byDriver.get(row.driverId!) ?? 0n) + row.amountPaise);
    const attached = row.driverSalary?.isActive && row.driverSalary.runId === runId;
    if (!attached) toAttach.push({ recoveryId: row.id, driverId: row.driverId! });
  }
  return { byDriver, toAttach };
}

const recoveryRef = { select: { lineNo: true, amountPaise: true, claimId: true, claim: { select: { claimNumber: true, branchId: true } } } } as const;

/** Put the free recoveries on their drivers' lines of this run. */
export async function attachRunDeductions(
  tx: Tx,
  run: { id: string; runNumber: string },
  toAttach: { recoveryId: string; driverId: string }[],
  lineIdByDriver: Map<string, string>,
  actorId: string,
) {
  for (const { recoveryId, driverId } of toAttach) {
    const lineId = lineIdByDriver.get(driverId);
    if (!lineId) continue;
    const recovery = await tx.claimRecovery.update({
      where: { id: recoveryId },
      data: { driverSalaryId: lineId, deferredFromRunId: null },
      ...recoveryRef,
    });
    await tx.claimEvent.create({
      data: {
        claimId: recovery.claimId,
        eventType: "RECOVERY_STATUS_CHANGED",
        note: `Recovery R${recovery.lineNo} (${rupeesText(recovery.amountPaise)}) put on salary run ${run.runNumber} for deduction`,
        actorId,
      },
    });
  }
}

/**
 * Approve: post one voucher per attached recovery, dated the month end like
 * the salary voucher. Call AFTER the run's lines were recomputed (they counted
 * these as pending; from now on they're ledger movements).
 */
export async function postRunDeductions(
  tx: Tx,
  run: { id: string; runNumber: string; monthEnd: Date; monthLabel: string },
  actorId: string,
) {
  const recoveries = await tx.claimRecovery.findMany({
    where: { ...deductible, driverSalary: { is: { runId: run.id, isActive: true } } },
    select: {
      id: true,
      driverId: true,
      driverSalaryId: true,
      lineNo: true,
      amountPaise: true,
      claimId: true,
      claim: { select: { claimNumber: true, branchId: true } },
      driver: { select: { name: true } },
    },
  });
  const runSeq = run.runNumber.split("/").pop();
  for (const recovery of recoveries) {
    const voucherNumber = `${recovery.claim.claimNumber}/R${recovery.lineNo}/S${runSeq}`;
    const journal = await postClaimSalaryDeduction(tx, {
      sourceId: `${recovery.id}:${recovery.driverSalaryId}`,
      voucherNumber,
      voucherDate: run.monthEnd,
      fyCode: fyCodeFor(run.monthEnd),
      branchId: recovery.claim.branchId,
      driverId: recovery.driverId!,
      amountPaise: recovery.amountPaise,
      narration: `Damage claim ${recovery.claim.claimNumber} R${recovery.lineNo} deducted from ${recovery.driver?.name ?? "driver"}'s ${run.monthLabel} salary — ${run.runNumber}`,
      createdById: actorId,
    });
    await tx.claimRecovery.update({
      where: { id: recovery.id },
      data: { journalEntryId: journal.id, version: { increment: 1 } },
    });
    await tx.claimEvent.create({
      data: {
        claimId: recovery.claimId,
        eventType: "RECOVERY_STATUS_CHANGED",
        note: `Recovery R${recovery.lineNo} deducted in salary run ${run.runNumber} — voucher ${journal.voucherNumber}`,
        actorId,
      },
    });
  }
}

/** The run is fully paid: its deducted recoveries are RECEIVED. */
export async function receiveRunDeductions(
  tx: Tx,
  run: { id: string; runNumber: string },
  paidAt: Date,
  actorId: string,
) {
  const recoveries = await tx.claimRecovery.findMany({
    where: {
      source: "DRIVER",
      status: "APPROVED",
      journalEntryId: { not: null },
      driverSalary: { is: { runId: run.id, isActive: true } },
    },
    select: { id: true, lineNo: true, claimId: true },
  });
  if (!recoveries.length) return;
  await tx.claimRecovery.updateMany({
    where: { id: { in: recoveries.map((r) => r.id) } },
    data: { status: "RECEIVED", receivedAt: paidAt, version: { increment: 1 } },
  });
  await tx.claimEvent.createMany({
    data: recoveries.map((recovery) => ({
      claimId: recovery.claimId,
      eventType: "RECOVERY_STATUS_CHANGED",
      note: `Recovery R${recovery.lineNo} received — salary run ${run.runNumber} paid`,
      actorId,
    })),
  });
}

/**
 * The run is cancelled: reverse any deduction voucher and free the recoveries
 * for the next run. Call before the run's lines are deactivated.
 */
export async function releaseRunDeductions(
  tx: Tx,
  run: { id: string; runNumber: string },
  reason: string,
  actorId: string,
) {
  const recoveries = await tx.claimRecovery.findMany({
    where: { source: "DRIVER", status: "APPROVED", driverSalary: { is: { runId: run.id } } },
    select: { id: true, lineNo: true, claimId: true, journalEntryId: true },
  });
  for (const recovery of recoveries) {
    if (recovery.journalEntryId) await reverseJournal(tx, recovery.journalEntryId, reason, actorId);
    await tx.claimRecovery.update({
      where: { id: recovery.id },
      data: { driverSalaryId: null, journalEntryId: null, version: { increment: 1 } },
    });
    await tx.claimEvent.create({
      data: {
        claimId: recovery.claimId,
        eventType: "RECOVERY_STATUS_CHANGED",
        note: `Salary run ${run.runNumber} cancelled — recovery R${recovery.lineNo} waits for the next run`,
        actorId,
      },
    });
  }
}

/** Take one recovery off a draft run; it waits for the next run instead. */
export async function deferRunDeduction(
  tx: Tx,
  run: { id: string; runNumber: string },
  recoveryId: string,
  actorId: string,
) {
  const recovery = await tx.claimRecovery.findFirst({
    where: {
      id: recoveryId,
      journalEntryId: null,
      driverSalary: { is: { runId: run.id, isActive: true } },
    },
    select: { id: true, lineNo: true, claimId: true },
  });
  if (!recovery) return false;
  await tx.claimRecovery.update({
    where: { id: recovery.id },
    data: { driverSalaryId: null, deferredFromRunId: run.id, version: { increment: 1 } },
  });
  await tx.claimEvent.create({
    data: {
      claimId: recovery.claimId,
      eventType: "RECOVERY_STATUS_CHANGED",
      note: `Recovery R${recovery.lineNo} taken off salary run ${run.runNumber} — deducted from a later run`,
      actorId,
    },
  });
  return true;
}

/** Recoveries on a run's lines, for the salary run screen. */
export async function runDeductionRows(client: Client, runId: string) {
  const rows = await client.claimRecovery.findMany({
    where: { source: "DRIVER", driverSalary: { is: { runId, isActive: true } } },
    select: {
      id: true,
      driverId: true,
      lineNo: true,
      amountPaise: true,
      status: true,
      journalEntryId: true,
      claim: { select: { id: true, claimNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driverId!,
    label: `${row.claim.claimNumber} R${row.lineNo}`,
    claimId: row.claim.id,
    amountPaise: row.amountPaise,
    status: row.status,
    posted: row.journalEntryId !== null,
  }));
}
