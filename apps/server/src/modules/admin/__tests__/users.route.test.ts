import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("../../../../prisma/prisma.js", () => ({
  db: { user: mocks },
}));
vi.mock("../../../middlewares/auth.middlware.js", () => ({
  authMiddleware: vi.fn(),
}));
vi.mock("../../../auth/can.middleware.js", () => ({ can: () => vi.fn() }));
vi.mock("../../../auth/permission-cache.js", () => ({
  invalidateUser: vi.fn(),
}));
vi.mock("../../audit/audit.service.js", () => ({
  recordAuditEntry: vi.fn(),
}));
import router from "../users.route.js";

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: {
      handle: (req: Request, res: Response, next: NextFunction) => unknown;
    }[];
  };
};
const listHandler = (router.stack as Layer[]).find(
  (layer) => layer.route?.path === "/" && layer.route.methods.get,
)?.route?.stack.at(-1)?.handle;

const call = async (query: Record<string, string>) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await listHandler!(
    { query } as unknown as Request,
    res as unknown as Response,
    vi.fn(),
  );
  return res;
};

describe("user access list endpoint", () => {
  it("fetches only the requested database page, filtered by role name", async () => {
    const row = { id: "u1", email: "a@x.com", role: { name: "Accounts" } };
    mocks.findMany.mockResolvedValue([row]);
    mocks.count.mockResolvedValue(45);
    const res = await call({ page: "2", size: "20", search: " accounts " });
    const where = {
      role: { name: { contains: "accounts", mode: "insensitive" } },
    };
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 40,
        take: 20,
        orderBy: { email: "asc" },
      }),
    );
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [row],
      meta: { total: 45, page: 2, size: 20 },
    });
  });

  it("treats a blank search as no filter and defaults to the first page", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    await call({ search: "   " });
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 20 }),
    );
    expect(mocks.count).toHaveBeenLastCalledWith({ where: {} });
  });

  it("reports unbounded page requests as a 400 validation error", async () => {
    const queries: Record<string, string>[] = [
      { size: "all" },
      { size: "101" },
      { page: "-1" },
    ];
    for (const query of queries)
      await expect(call(query)).rejects.toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
  });
});
