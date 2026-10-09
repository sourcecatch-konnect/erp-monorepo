import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("../../../../prisma/prisma.js", () => ({
  db: { permissionDef: mocks },
}));
vi.mock("../../../middlewares/auth.middlware.js", () => ({
  authMiddleware: vi.fn(),
}));
vi.mock("../../../auth/can.middleware.js", () => ({ can: () => vi.fn() }));
import router from "../permissions.route.js";

describe("permission page endpoint", () => {
  it("queries only the requested database page with filtered count and selected role", async () => {
    mocks.findMany.mockResolvedValue([
      {
        key: "billing.view",
        moduleCode: "billing",
        rolePermissions: [{ roleId: "role-123" }],
      },
      { key: "billing.update", moduleCode: "billing", rolePermissions: [] },
    ]);
    mocks.count.mockResolvedValue(60);
    type Layer = {
      route?: {
        path: string;
        stack: {
          handle: (req: Request, res: Response, next: NextFunction) => unknown;
        }[];
      };
    };
    const layers = router.stack as Layer[];
    const handler = layers
      .find((layer) => layer.route?.path === "/page")
      ?.route?.stack.at(-1)?.handle;
    expect(handler).toBeDefined();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler!(
      {
        query: {
          page: "1",
          size: "20",
          moduleCode: "billing",
          roleId: "role-123",
        },
      } as unknown as Request,
      res as unknown as Response,
      vi.fn(),
    );
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: { moduleCode: "billing" },
        select: expect.objectContaining({
          rolePermissions: {
            where: { roleId: "role-123" },
            select: { roleId: true },
          },
        }),
      }),
    );
    expect(mocks.count).toHaveBeenCalledWith({
      where: { moduleCode: "billing" },
    });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: [
        { key: "billing.view", moduleCode: "billing", roleAllowed: true },
        { key: "billing.update", moduleCode: "billing", roleAllowed: false },
      ],
      meta: { page: 1, size: 20, total: 60 },
    });
  });
});

it("accepts the reported request with an empty roleId", async () => {
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  type Layer = {
    route?: {
      path: string;
      stack: {
        handle: (req: Request, res: Response, next: NextFunction) => unknown;
      }[];
    };
  };
  const handler = (router.stack as Layer[])
    .find((layer) => layer.route?.path === "/page")
    ?.route?.stack.at(-1)?.handle;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler!(
    {
      query: { page: "0", size: "20", moduleCode: "order", roleId: "" },
    } as unknown as Request,
    res as unknown as Response,
    vi.fn(),
  );
  expect(mocks.findMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      skip: 0,
      take: 20,
      where: { moduleCode: "order" },
    }),
  );
  expect(res.status).toHaveBeenCalledWith(200);
});
it("reports malformed query parameters as a 400 validation error", async () => {
  type Layer = {
    route?: {
      path: string;
      stack: {
        handle: (req: Request, res: Response, next: NextFunction) => unknown;
      }[];
    };
  };
  const handler = (router.stack as Layer[])
    .find((layer) => layer.route?.path === "/page")
    ?.route?.stack.at(-1)?.handle;
  await expect(
    handler!(
      { query: { size: "all" } } as unknown as Request,
      {} as Response,
      vi.fn(),
    ),
  ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
});
