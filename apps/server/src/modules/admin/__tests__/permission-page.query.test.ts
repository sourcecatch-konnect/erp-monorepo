import { describe, expect, it } from "vitest";
import { permissionPageQuerySchema } from "@skerp/validators";
import { permissionPageOptions } from "../permission-page.query.js";

describe("permission database pages", () => {
  it("defaults to a bounded first page and advances the database offset", () => {
    expect(
      permissionPageOptions(permissionPageQuerySchema.parse({})),
    ).toMatchObject({ skip: 0, take: 20 });
    expect(
      permissionPageOptions(
        permissionPageQuerySchema.parse({ page: "2", size: "20" }),
      ),
    ).toMatchObject({ skip: 40, take: 20 });
  });
  it("treats blank role and category query values as omitted", () => {
    const query = permissionPageQuerySchema.parse({
      roleId: "",
      moduleCode: "  ",
      page: "0",
      size: "20",
    });
    expect(query.roleId).toBeUndefined();
    expect(query.moduleCode).toBeUndefined();
    expect(permissionPageOptions(query)).toMatchObject({
      where: {},
      skip: 0,
      take: 20,
    });
  });
  it("rejects unbounded or invalid page requests", () => {
    for (const query of [
      { size: 0 },
      { size: 51 },
      { page: -1 },
      { page: 1.5 },
      { size: "all" },
    ])
      expect(permissionPageQuerySchema.safeParse(query).success).toBe(false);
  });
  it("applies category filtering before pagination", () => {
    expect(
      permissionPageOptions(
        permissionPageQuerySchema.parse({ moduleCode: "billing" }),
      ).where,
    ).toEqual({ moduleCode: "billing" });
    expect(
      permissionPageOptions(
        permissionPageQuerySchema.parse({ moduleCode: "masters" }),
      ).where,
    ).toEqual({ moduleCode: { startsWith: "masters." } });
  });
  it("searches readable multiword action names across the entire catalog", () => {
    const { where } = permissionPageOptions(
      permissionPageQuerySchema.parse({
        search: "APPROVE payments",
        moduleCode: "accounts",
      }),
    );
    expect(where).toMatchObject({
      moduleCode: "accounts",
      OR: [
        {
          key: {
            in: expect.arrayContaining([
              "accounts.payment.approve",
              "receipt.approve",
            ]),
          },
        },
        expect.anything(),
      ],
    });
    expect(where.OR?.[0]).not.toMatchObject({
      key: { in: expect.arrayContaining(["accounts.payment.view"]) },
    });
  });
  it("matches category names and master upload labels", () => {
    const { where } = permissionPageOptions(
      permissionPageQuerySchema.parse({ search: "upload customer" }),
    );
    expect(where.OR?.[0]).toMatchObject({
      key: { in: ["masters.customer.bulk_import"] },
    });
    const category = permissionPageOptions(
      permissionPageQuerySchema.parse({ search: "administration" }),
    );
    expect(category.where.OR?.[0]).toMatchObject({
      key: {
        in: expect.arrayContaining([
          "admin.rbac.manage",
          "admin.audit_log.view",
        ]),
      },
    });
  });
});
