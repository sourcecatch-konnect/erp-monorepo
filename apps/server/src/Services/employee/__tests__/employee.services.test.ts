import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../../generated/prisma/index.js";

const db = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
}));
vi.mock("../../../../prisma/prisma.js", () => ({ db }));
vi.mock("../../../auth/permission-cache.js", () => ({
  invalidateUser: vi.fn(),
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  recordAuditEntry: vi.fn(),
}));
import {
  deleteEmployeeService,
  listEmployeesPageService,
  updateEmployeeService,
  updateEmployeeStatusService,
} from "../employee.services.js";
import { invalidateUser } from "../../../auth/permission-cache.js";
import { recordAuditEntry } from "../../../modules/audit/audit.service.js";

const ravi = {
  firstName: "Ravi",
  middleName: null,
  lastName: "Kumar",
  email: "ravi@example.com",
  status: true,
  role: { name: "Operations", isSystem: false },
};
const admin = { ...ravi, role: { name: "Admin", isSystem: true } };

beforeEach(() => {
  vi.clearAllMocks();
  // Two history columns, as read from the Postgres catalog.
  db.$queryRaw.mockResolvedValue([
    { table: '"Order"', column: '"approvedById"' },
    { table: '"AuditLog"', column: '"actorId"' },
  ]);
  db.$queryRawUnsafe.mockResolvedValue([{ used: false }]);
  db.user.count.mockResolvedValue(1);
  db.user.update.mockImplementation(async ({ data }) => ({ ...ravi, ...data }));
});

describe("deleting a user", () => {
  it("refuses to delete your own account", async () => {
    await expect(deleteEmployeeService("me", "me")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it("refuses when anything in the system points at them, including SET NULL columns", async () => {
    db.user.findUnique.mockResolvedValue(ravi);
    db.$queryRawUnsafe.mockResolvedValue([{ used: true }]);
    await expect(deleteEmployeeService("u1", "me")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Deactivate them instead"),
    });
    const [sql, id] = db.$queryRawUnsafe.mock.calls[0]!;
    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM "Order" WHERE "approvedById" = $1)',
    );
    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM "AuditLog" WHERE "actorId" = $1)',
    );
    expect(id).toBe("u1");
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete the only active admin", async () => {
    db.user.findUnique.mockResolvedValue(admin);
    db.user.count.mockResolvedValue(0);
    await expect(deleteEmployeeService("u1", "me")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("only active admin"),
    });
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused account, drops its cached access and audits it", async () => {
    db.user.findUnique.mockResolvedValue(ravi);
    await expect(deleteEmployeeService("u1", "me")).resolves.toEqual({
      id: "u1",
    });
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(invalidateUser).toHaveBeenCalledWith("u1");
    expect(recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.delete",
        actor: { id: "me" },
        before: {
          name: "Ravi Kumar",
          email: "ravi@example.com",
          roleName: "Operations",
        },
      }),
    );
  });

  it("still refuses if a record appears between the check and the delete", async () => {
    db.user.findUnique.mockResolvedValue(ravi);
    db.user.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("FK", {
        code: "P2003",
        clientVersion: "test",
      }),
    );
    await expect(deleteEmployeeService("u1", "me")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(invalidateUser).not.toHaveBeenCalled();
  });
});

describe("activating and deactivating", () => {
  it("refuses to deactivate your own account", async () => {
    await expect(
      updateEmployeeStatusService("me", false, "me"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the only active admin", async () => {
    db.user.findUnique.mockResolvedValue(admin);
    db.user.count.mockResolvedValue(0);
    await expect(
      updateEmployeeStatusService("u1", false, "me"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("locks them out on their next request and audits the change", async () => {
    db.user.findUnique.mockResolvedValue(ravi);
    await updateEmployeeStatusService("u1", false, "me");
    expect(invalidateUser).toHaveBeenCalledWith("u1");
    expect(recordAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.status.update",
        before: { status: true },
        after: { status: false, name: "Ravi Kumar" },
      }),
    );
  });

  it("doesn't audit a no-op", async () => {
    db.user.findUnique.mockResolvedValue(ravi);
    await updateEmployeeStatusService("u1", true, "me");
    expect(recordAuditEntry).not.toHaveBeenCalled();
  });
});

describe("editing a user", () => {
  it("refuses to move the only active admin to another role", async () => {
    db.user.findUnique.mockResolvedValue({
      companyId: "c1",
      branchId: "b1",
      roleId: "admin-role",
      status: true,
      role: { isSystem: true },
    });
    const role = { findUnique: vi.fn().mockResolvedValue({ isSystem: false }) };
    Object.assign(db, { role });
    db.user.count.mockResolvedValue(0);
    await expect(
      updateEmployeeService("u1", { roleId: "ops-role" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe("user list pages", () => {
  it("fetches one database page, every search word matching a name, email or username", async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(42);
    const result = await listEmployeesPageService({
      page: 2,
      size: 20,
      search: "ravi kum",
    });
    const call = db.user.findMany.mock.calls[0]![0];
    expect(call).toMatchObject({ skip: 40, take: 20 });
    expect(call.where.AND).toHaveLength(2);
    expect(call.where.AND[1].OR).toContainEqual({
      lastName: { contains: "kum", mode: "insensitive" },
    });
    expect(call.select).not.toHaveProperty("password");
    expect(result.total).toBe(42);
  });
});
