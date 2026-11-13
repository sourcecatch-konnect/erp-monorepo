import { beforeEach, describe, expect, it, vi } from "vitest";
import { removedPartActionSchema } from "@skerp/validators";
import type { Prisma } from "../../../../generated/prisma/index.js";
import {
  actOnRemovedPartTx,
  lifecycleFingerprint,
} from "../removed-part-lifecycle.service.js";
import { postApprovedRemovedPartTx } from "../job-card-removed-part.service.js";
vi.mock("../job-card-removed-part.service.js", () => ({
  postApprovedRemovedPartTx: vi.fn().mockResolvedValue({ id: "removed" }),
}));
const input = () =>
  removedPartActionSchema.parse({
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    version: 1,
    action: "APPROVE_STOCK",
    reason: "Inspected and valued",
    evidence: "Inspection reference 1",
    custodyLocation: "HO stock bay",
    unitCostPaise: "200",
  });
function fixture() {
  const record = {
    id: "removed",
    jobCardId: "card",
    condition: "REUSABLE",
    lifecycleStatus: "PENDING_APPROVAL",
    version: 1,
    createdById: "maker",
    valuationSubmittedById: "maker",
    unitCostPaise: 100n,
    provenanceReference: "Vehicle inspection",
    custodyLocation: "quarantine",
    repairReceivedAt: null,
    newBatchId: null,
    journalEntryId: null,
    qty: 2,
    sparePartId: "part",
    relatedPartLineId: null,
    jobCard: {
      id: "card",
      branchId: "branch",
      status: "FINALISED",
      version: 3,
    },
  };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    jobCardRemovedPart: {
      findUnique: vi.fn().mockResolvedValue(record),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobCard: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    jobCardRemovedPartEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return { tx, record, db: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());
describe("removed-part lifecycle", () => {
  it("requires reason, evidence, custody and a positive value for stock/repair receipt", () => {
    for (const change of [
      { reason: " " },
      { evidence: "" },
      { custodyLocation: "" },
      { unitCostPaise: 0 },
      { unitCostPaise: undefined },
    ])
      expect(
        removedPartActionSchema.safeParse({ ...input(), ...change }).success,
      ).toBe(false);
  });
  it("requires a separate person from both the recorder and latest submitter", async () => {
    const { tx, record, db } = fixture();
    for (const actor of ["maker", "submitter"]) {
      tx.jobCardRemovedPart.findUnique.mockResolvedValue({
        ...record,
        valuationSubmittedById: "submitter",
      });
      await expect(
        actOnRemovedPartTx(db, "card", "removed", "branch", input(), actor),
      ).rejects.toThrow("different person");
    }
    expect(postApprovedRemovedPartTx).not.toHaveBeenCalled();
    expect(tx.jobCardRemovedPart.updateMany).not.toHaveBeenCalled();
  });
  it("claims parent and record before posting explicitly approved value and immutable audit details", async () => {
    const { tx, db } = fixture();
    await actOnRemovedPartTx(
      db,
      "card",
      "removed",
      "branch",
      input(),
      "approver",
    );
    expect(postApprovedRemovedPartTx).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: "removed", unitCostPaise: 200n }),
      "branch",
      "approver",
    );
    expect(tx.jobCardRemovedPart.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "removed",
          version: 1,
          lifecycleStatus: "PENDING_APPROVAL",
        },
        data: expect.objectContaining({
          lifecycleStatus: "STOCKED",
          approvedById: "approver",
        }),
      }),
    );
    expect(tx.jobCardRemovedPartEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "APPROVE_STOCK",
        fromStatus: "PENDING_APPROVAL",
        toStatus: "STOCKED",
        actorId: "approver",
        details: {
          evidence: input().evidence,
          custodyLocation: input().custodyLocation,
          unitCostPaise: "200",
        },
      }),
    });
  });
  it("replays actions without repeating stock even after a later state change; rejects altered identities", async () => {
    const { tx, record, db } = fixture();
    tx.jobCardRemovedPart.findUnique.mockResolvedValue({
      ...record,
      version: 2,
      lifecycleStatus: "STOCKED",
    });
    tx.jobCardRemovedPartEvent.findUnique.mockResolvedValue({
      removedPartId: "removed",
      requestFingerprint: lifecycleFingerprint("removed", input(), "approver"),
    });
    await expect(
      actOnRemovedPartTx(db, "card", "removed", "branch", input(), "approver"),
    ).resolves.toEqual({ id: "removed" });
    await expect(
      actOnRemovedPartTx(
        db,
        "card",
        "removed",
        "branch",
        { ...input(), unitCostPaise: 201n },
        "approver",
      ),
    ).rejects.toThrow("already used");
    expect(postApprovedRemovedPartTx).not.toHaveBeenCalled();
  });
  it.each([
    ["SEND_REPAIR", "HELD", "REPAIRABLE", "IN_REPAIR"],
    ["RECEIVE_REPAIR", "IN_REPAIR", "REPAIRABLE", "PENDING_APPROVAL"],
    ["DECLARE_SCRAP", "IN_REPAIR", "REPAIRABLE", "SCRAP_HELD"],
    ["REQUEST_DISPOSAL", "SCRAP_HELD", "REPAIRABLE", "DISPOSAL_PENDING"],
    ["APPROVE_DISPOSAL", "DISPOSAL_PENDING", "SCRAP", "DISPOSED"],
    ["REJECT", "PENDING_APPROVAL", "REUSABLE", "HELD"],
    ["REJECT", "DISPOSAL_PENDING", "SCRAP", "SCRAP_HELD"],
  ] as const)(
    "records %s from %s without adding usable stock",
    async (action, status, condition, next) => {
      const { tx, record, db } = fixture();
      tx.jobCardRemovedPart.findUnique.mockResolvedValue({
        ...record,
        lifecycleStatus: status,
        condition,
      });
      await actOnRemovedPartTx(
        db,
        "card",
        "removed",
        "branch",
        { ...input(), action },
        "approver",
      );
      expect(tx.jobCardRemovedPart.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lifecycleStatus: next }),
        }),
      );
      expect(postApprovedRemovedPartTx).not.toHaveBeenCalled();
    },
  );
  it("does not allow a repairable part to bypass repair receipt", async () => {
    const { tx, record, db } = fixture();
    tx.jobCardRemovedPart.findUnique.mockResolvedValue({
      ...record,
      condition: "REPAIRABLE",
      lifecycleStatus: "HELD",
    });
    await expect(
      actOnRemovedPartTx(
        db,
        "card",
        "removed",
        "branch",
        { ...input(), action: "SUBMIT_VALUATION" },
        "maker",
      ),
    ).rejects.toThrow("received repaired");
    expect(postApprovedRemovedPartTx).not.toHaveBeenCalled();
  });
  it("only approves repaired parts once repair receipt is evidenced", async () => {
    const { tx, record, db } = fixture();
    tx.jobCardRemovedPart.findUnique.mockResolvedValueOnce({
      ...record,
      condition: "REPAIRABLE",
    });
    await expect(
      actOnRemovedPartTx(db, "card", "removed", "branch", input(), "approver"),
    ).rejects.toThrow("recorded repair receipt");
    tx.jobCardRemovedPart.findUnique.mockResolvedValueOnce({
      ...record,
      condition: "REPAIRABLE",
      repairReceivedAt: new Date(),
    });
    await actOnRemovedPartTx(
      db,
      "card",
      "removed",
      "branch",
      input(),
      "approver",
    );
    expect(postApprovedRemovedPartTx).toHaveBeenCalledTimes(1);
  });
  it("rejects wrong scope, stale versions and failed parent or record claims", async () => {
    const { tx, db } = fixture();
    await expect(
      actOnRemovedPartTx(db, "card", "removed", "other", input(), "approver"),
    ).rejects.toThrow("not found");
    await expect(
      actOnRemovedPartTx(
        db,
        "card",
        "removed",
        "branch",
        { ...input(), version: 2 },
        "approver",
      ),
    ).rejects.toThrow("changed");
    tx.jobCard.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      actOnRemovedPartTx(db, "card", "removed", "branch", input(), "approver"),
    ).rejects.toThrow("Job card changed");
    tx.jobCardRemovedPart.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      actOnRemovedPartTx(db, "card", "removed", "branch", input(), "approver"),
    ).rejects.toThrow("Removed part changed");
    expect(postApprovedRemovedPartTx).not.toHaveBeenCalled();
  });
  it("propagates posting failure so status, stock and event all roll back", async () => {
    const { tx, db } = fixture();
    vi.mocked(postApprovedRemovedPartTx).mockRejectedValueOnce(
      new Error("Posting failed"),
    );
    await expect(
      actOnRemovedPartTx(db, "card", "removed", "branch", input(), "approver"),
    ).rejects.toThrow("Posting failed");
    expect(tx.jobCardRemovedPartEvent.create).not.toHaveBeenCalled();
  });
});
