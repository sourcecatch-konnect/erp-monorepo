import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response, Router } from "express";
import { PERMS, type PermissionKey } from "@skerp/types";
import type { UserPermissionContext } from "../../../auth/permission-resolver.js";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  verify: vi.fn(),
  db: {
    jobCard: { findUnique: vi.fn() },
    serviceBill: { findUnique: vi.fn() },
    jobCardRepairEvent: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../../../../prisma/prisma.js", () => ({ db: mocks.db }));
vi.mock("../../../auth/permission-cache.js", () => ({
  getPermissionContext: mocks.context,
}));
vi.mock("../../../util/auth.util.js", () => ({
  verifyAccessToken: mocks.verify,
}));
// Authentication and permission/branch middleware remain real. Only identity
// verification, context storage and persistence are replaced with fixtures.
import jobCards from "../job-card.route.js";
import serviceBills from "../../service-bill/service-bill.route.js";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
type Layer = {
  handle: Handler;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: Handler }[];
  };
};
type Case = {
  label: string;
  router: Router;
  method: string;
  path: string;
  key: PermissionKey;
  body?: Record<string, unknown>;
};
const W = PERMS.WORKSHOP;
const cases: Case[] = [
  {
    label: "job register",
    router: jobCards,
    method: "get",
    path: "/",
    key: W.JOBCARD_VIEW,
  },
  {
    label: "job detail",
    router: jobCards,
    method: "get",
    path: "/:id",
    key: W.JOBCARD_VIEW,
  },
  {
    label: "repair history",
    router: jobCards,
    method: "get",
    path: "/:id/repair-events",
    key: W.JOBCARD_VIEW,
  },
  {
    label: "removed-part history",
    router: jobCards,
    method: "get",
    path: "/:id/removed-parts/:removedId/events",
    key: W.JOBCARD_VIEW,
  },
  {
    label: "batch lookup",
    router: jobCards,
    method: "get",
    path: "/lookup/batches",
    key: W.JOBCARD_VIEW,
  },
  {
    label: "create draft",
    router: jobCards,
    method: "post",
    path: "/",
    key: W.JOBCARD_MANAGE,
  },
  {
    label: "edit draft",
    router: jobCards,
    method: "patch",
    path: "/:id",
    key: W.JOBCARD_MANAGE,
  },
  {
    label: "create and finalise",
    router: jobCards,
    method: "post",
    path: "/create-and-finalise",
    key: W.JOBCARD_FINALISE,
  },
  {
    label: "finalise",
    router: jobCards,
    method: "post",
    path: "/:id/finalise",
    key: W.JOBCARD_FINALISE,
  },
  {
    label: "undo finalise",
    router: jobCards,
    method: "post",
    path: "/:id/undo-finalise",
    key: W.JOBCARD_FINALISE,
  },
  {
    label: "cancel draft",
    router: jobCards,
    method: "post",
    path: "/:id/cancel",
    key: W.JOBCARD_MANAGE,
  },
  {
    label: "start repair",
    router: jobCards,
    method: "post",
    path: "/:id/repair-control",
    key: W.JOBCARD_MANAGE,
    body: { action: "START" },
  },
  {
    label: "release repair",
    router: jobCards,
    method: "post",
    path: "/:id/repair-control",
    key: W.JOBCARD_FINALISE,
    body: { action: "RELEASE" },
  },
  {
    label: "cancel repair",
    router: jobCards,
    method: "post",
    path: "/:id/repair-control",
    key: W.JOBCARD_FINALISE,
    body: { action: "CANCEL" },
  },
  ...["APPROVE_STOCK", "APPROVE_DISPOSAL", "REJECT"].map((action) => ({
    label: action,
    router: jobCards,
    method: "post",
    path: "/:id/removed-parts/:removedId/actions",
    key: W.JOBCARD_RETURN_APPROVE,
    body: { action },
  })),
  {
    label: "bill register",
    router: serviceBills,
    method: "get",
    path: "/",
    key: W.SERVICEBILL_VIEW,
  },
  {
    label: "bill detail",
    router: serviceBills,
    method: "get",
    path: "/:id",
    key: W.SERVICEBILL_VIEW,
  },
  {
    label: "bill create",
    router: serviceBills,
    method: "post",
    path: "/",
    key: W.SERVICEBILL_MANAGE,
  },
  {
    label: "payment slip",
    router: serviceBills,
    method: "post",
    path: "/:id/payment-slip",
    key: PERMS.ACCOUNTS.PAYMENT.CREATE,
  },
  {
    label: "settlement reversal",
    router: serviceBills,
    method: "post",
    path: "/:id/payments/:paymentId/reverse",
    key: PERMS.ACCOUNTS.PAYMENT.CANCEL,
  },
];
function context(keys: PermissionKey[]): UserPermissionContext {
  return {
    userId: "maker",
    roleId: "workshop",
    roleName: "Workshop",
    isSystemRole: false,
    permissions: new Set(keys),
    branchScope: "ASSIGNED",
    branchIds: ["branch-a"],
  };
}
async function call(
  test: Pick<Case, "router" | "method" | "path" | "body">,
  keys: PermissionKey[],
  options: { anonymous?: boolean; query?: Record<string, unknown> } = {},
) {
  mocks.context.mockResolvedValue(context(keys));
  const stack = test.router.stack as Layer[];
  const route = stack.find(
    (layer) =>
      layer.route?.path === test.path && layer.route.methods[test.method],
  );
  expect(route, `registered route ${test.method} ${test.path}`).toBeDefined();
  const req = {
    cookies: options.anonymous ? {} : { accessToken: "fixture-token" },
    params: { id: "card", removedId: "removed", paymentId: "payment" },
    query: options.query ?? {},
    body: test.body ?? {},
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  for (const handler of [
    stack[0]!.handle,
    ...route!.route!.stack.map((layer) => layer.handle),
  ]) {
    let proceed = false;
    await handler(
      req,
      res as unknown as Response,
      (() => {
        proceed = true;
      }) as NextFunction,
    );
    if (!proceed) break;
  }
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockReturnValue({ userId: "maker", role: "Workshop" });
  mocks.db.jobCard.findUnique.mockResolvedValue({
    id: "card",
    branchId: "branch-b",
  });
  mocks.db.serviceBill.findUnique.mockResolvedValue({
    id: "bill",
    branchId: "branch-b",
    lines: [],
  });
});
describe("job-card and service-bill route access", () => {
  it("rejects an expired token before looking up permissions", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("Expired token");
    });
    const res = await call({ router: jobCards, method: "get", path: "/" }, [
      W.JOBCARD_VIEW,
    ]);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("returns an authorised own-branch card through the real middleware", async () => {
    const card = { id: "card", branchId: "branch-a" };
    mocks.db.jobCard.findUnique.mockResolvedValue(card);
    const res = await call({ router: jobCards, method: "get", path: "/:id" }, [
      W.JOBCARD_VIEW,
    ]);
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: card });
  });
  it("pages repair history in the backend and resolves only page actors", async () => {
    mocks.db.jobCard.findUnique.mockResolvedValue({
      id: "card",
      branchId: "branch-a",
    });
    mocks.db.jobCardRepairEvent.findMany.mockResolvedValue([
      { id: "event", actorId: "worker" },
    ]);
    mocks.db.jobCardRepairEvent.count.mockResolvedValue(25);
    mocks.db.user.findMany.mockResolvedValue([
      { id: "worker", firstName: "Repair", lastName: "Reviewer" },
    ]);
    const res = await call(
      { router: jobCards, method: "get", path: "/:id/repair-events" },
      [W.JOBCARD_VIEW],
      { query: { page: "1", size: "10", search: " release " } },
    );
    expect(mocks.db.jobCardRepairEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: expect.objectContaining({
          jobCardId: "card",
          OR: expect.arrayContaining([
            { action: { contains: "release", mode: "insensitive" } },
          ]),
        }),
      }),
    );
    expect(mocks.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["worker"] } } }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { page: 1, size: 10, total: 25 },
        data: [
          { id: "event", actorId: "worker", actorName: "Repair Reviewer" },
        ],
      }),
    );
  });
  it("rejects the retired direct-pay endpoint even with its old permission", async () => {
    await expect(
      call({ router: serviceBills, method: "post", path: "/:id/pay" }, [
        W.SERVICEBILL_PAY,
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it.each(cases)("$label rejects an unauthenticated request", async (test) => {
    const res = await call(test, [], { anonymous: true });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it.each(cases)(
    "$label requires its server permission before touching data",
    async (test) => {
      const res = await call(test, []);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ details: { required: [test.key] } }),
        }),
      );
      expect(mocks.db.jobCard.findUnique).not.toHaveBeenCalled();
      expect(mocks.db.serviceBill.findUnique).not.toHaveBeenCalled();
      expect(mocks.db.$transaction).not.toHaveBeenCalled();
    },
  );
  it.each([
    { router: jobCards, path: "/:id", method: "get", key: W.JOBCARD_VIEW },
    {
      router: jobCards,
      path: "/:id/repair-events",
      method: "get",
      key: W.JOBCARD_VIEW,
    },
    {
      router: serviceBills,
      path: "/:id",
      method: "get",
      key: W.SERVICEBILL_VIEW,
    },
  ])("$path denies direct IDs outside assigned branches", async (test) => {
    await expect(call(test, [test.key])).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.db.jobCardRepairEvent.findMany).not.toHaveBeenCalled();
  });
  it("repair managers cannot clear roadworthiness using manage permission", async () => {
    const res = await call(
      {
        router: jobCards,
        method: "post",
        path: "/:id/repair-control",
        body: { action: "RELEASE" },
      },
      [W.JOBCARD_MANAGE],
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it("removed-part makers cannot approve valuation with manage permission", async () => {
    const res = await call(
      {
        router: jobCards,
        method: "post",
        path: "/:id/removed-parts/:removedId/actions",
        body: { action: "APPROVE_STOCK" },
      },
      [W.JOBCARD_MANAGE],
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    PERMS.WORKSHOP.SERVICEBILL_VIEW,
    PERMS.LEDGER.VIEW,
    PERMS.ACCOUNTS.PAYMENT.VIEW,
  ])("audit requires %s in addition to job-card view", async (missing) => {
    const keys = [
      W.JOBCARD_VIEW,
      W.SERVICEBILL_VIEW,
      PERMS.LEDGER.VIEW,
      PERMS.ACCOUNTS.PAYMENT.VIEW,
    ].filter((key) => key !== missing);
    const res = await call(
      { router: jobCards, method: "get", path: "/reports/audit" },
      keys,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it("explicit report branch filters cannot escape assigned scope", async () => {
    await expect(
      call(
        { router: jobCards, method: "get", path: "/reports/repair-costs" },
        [W.JOBCARD_VIEW],
        { query: { branchId: "branch-b" } },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
