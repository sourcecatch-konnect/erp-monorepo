import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
const db = vi.hoisted(() => ({
  role: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  permissionDef: { findMany: vi.fn() },
}));
const mocks = db.role;
vi.mock("../../../../prisma/prisma.js", () => ({ db }));
vi.mock("../../../middlewares/auth.middlware.js", () => ({
  authMiddleware: vi.fn(),
}));
vi.mock("../../../auth/can.middleware.js", () => ({ can: () => vi.fn() }));
vi.mock("../../../auth/permission-cache.js", () => ({
  invalidateAll: vi.fn(),
}));
vi.mock("../../audit/audit.service.js", () => ({
  recordAuditEntry: vi.fn(),
}));
import router from "../roles.route.js";
import { recordAuditEntry } from "../../audit/audit.service.js";
import { invalidateAll } from "../../../auth/permission-cache.js";

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: {
      handle: (req: Request, res: Response, next: NextFunction) => unknown;
    }[];
  };
};
const routes = (router.stack as Layer[]).filter((l) => l.route?.methods.get);
const pageHandler = routes
  .find((l) => l.route?.path === "/page")
  ?.route?.stack.at(-1)?.handle;

const call = async (query: Record<string, string>) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await pageHandler!(
    { query } as unknown as Request,
    res as unknown as Response,
    vi.fn(),
  );
  return res;
};

describe("role list page endpoint", () => {
  it("is registered before /:id so 'page' is never read as a role id", () => {
    const paths = routes.map((l) => l.route!.path);
    expect(paths.indexOf("/page")).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf("/page")).toBeLessThan(paths.indexOf("/:id"));
  });

  it("fetches only the requested database page, filtered by role name", async () => {
    const row = { id: "r1", name: "Accounts", isSystem: false };
    mocks.findMany.mockResolvedValue([row]);
    mocks.count.mockResolvedValue(23);
    const res = await call({ page: "1", size: "10", search: " acc " });
    const where = { name: { contains: "acc", mode: "insensitive" } };
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 10,
        take: 10,
        orderBy: [{ isSystem: "desc" }, { name: "asc" }, { id: "asc" }],
      }),
    );
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [row],
      meta: { total: 23, page: 1, size: 10 },
    });
  });

  it("treats a blank search as no filter and defaults to the first page", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    await call({ search: "  " });
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 20 }),
    );
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

const createHandler = (router.stack as Layer[])
  .find((l) => l.route?.path === "/" && l.route.methods.post)
  ?.route?.stack.at(-1)?.handle;

const create = async (body: Record<string, unknown>) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await createHandler!(
    { body, ctx: { userId: "admin-1" } } as unknown as Request,
    res as unknown as Response,
    vi.fn(),
  );
  return res;
};

const createdPermissions = () =>
  mocks.create.mock.calls[0]![0].data.rolePermissions.createMany.data;

describe("creating a role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockImplementation(
      async ({ data }: { data: { name: string } }) => ({
        id: "new-role",
        name: data.name,
      }),
    );
  });

  it("starts empty when nothing is inherited", async () => {
    const res = await create({ name: "Packers" });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(createdPermissions()).toEqual([]);
    expect(recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ after: { name: "Packers" } }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("starts with a copy of the chosen role's permissions", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "accounts",
      isSystem: false,
      rolePermissions: [{ permissionId: "p1" }, { permissionId: "p2" }],
    });
    await create({ name: "Accounts assistant", inheritFromRoleId: "accounts" });
    expect(createdPermissions()).toEqual([
      { permissionId: "p1" },
      { permissionId: "p2" },
    ]);
    expect(recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        after: { name: "Accounts assistant", copiedFrom: "accounts" },
      }),
    );
    // Nobody holds the new role yet, so cached permissions stay valid.
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("gives every permission when inheriting from a built-in role", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "admin",
      isSystem: true,
      rolePermissions: [{ permissionId: "p1" }],
    });
    db.permissionDef.findMany.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
      { id: "p3" },
    ]);
    await create({ name: "Almost admin", inheritFromRoleId: "admin" });
    expect(createdPermissions()).toHaveLength(3);
  });

  it("refuses a role to inherit from that no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(
      create({ name: "Packers", inheritFromRoleId: "gone" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a name that's already in use", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing" });
    await expect(create({ name: "Accounts" })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
