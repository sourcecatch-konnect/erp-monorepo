import { Router } from "express";
import { ZodType, ZodTypeDef } from "zod";
import { PermissionAction } from "@skerp/types";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { getParamId } from "./param.js";
import { parseListQuery } from "./list.query.js";
import { requirePermission } from "./permission.middleware.js";
import { sendOk } from "./response.js";

type PrismaDelegate = {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args?: unknown): Promise<unknown | null>;
  count(args?: unknown): Promise<number>;
  create(args?: unknown): Promise<unknown>;
  update(args?: unknown): Promise<unknown>;
  delete(args?: unknown): Promise<unknown>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
};

type CrudAction = Exclude<PermissionAction, "view"> | "view";

type CrudOptions<Create, Update> = {
  model: PrismaDelegate;
  createSchema: ZodType<Create, ZodTypeDef, unknown>;
  updateSchema: ZodType<Update, ZodTypeDef, unknown>;
  permissionKey: string;

  listOptions?: {
    searchableFields?: string[];
    defaultInclude?: Record<string, unknown>;
    defaultOrderBy?: object;
    softDelete?: boolean;

    blockDeleteIfExists?: {
      model: any;
      label: string;
      where: (id: string) => object;
      select?: Record<string, boolean>;
      getName?: (row: any) => string;
    }[];
  };

  hooks?: {
    beforeCreate?: (data: Create) => Promise<Create>;
    beforeUpdate?: (data: Update, row: unknown) => Promise<Update>;

    beforeDelete?: (id: string) => Promise<void>;
  };
};

const actionPermission = (action: CrudAction): PermissionAction =>
  action === "view" ? "view" : action;

const buildWhere = (
  search: string | undefined,
  searchableFields: string[] | undefined,
  filter: Record<string, string>,
  softDelete?: boolean,
) => {
  return {
    ...(softDelete ? { deletedAt: null } : {}),
    ...filter,
    ...(search && searchableFields?.length
      ? {
          OR: searchableFields.map((field) => ({
            [field]: {
              contains: search,
              mode: "insensitive",
            },
          })),
        }
      : {}),
  };
};

const parseIds = (body: unknown) => {
  if (
    !body ||
    typeof body !== "object" ||
    !("ids" in body) ||
    !Array.isArray(body.ids) ||
    !body.ids.every((id) => typeof id === "string" && id)
  ) {
    throw new BadRequestError("ids must be a non-empty string array");
  }

  return body.ids;
};

const toCsv = (rows: unknown[]) => {
  if (!rows.length) {
    return "";
  }

  const keys = Object.keys(rows[0] as Record<string, unknown>);
  const escape = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  return [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((key) => escape((row as Record<string, unknown>)[key]))
        .join(","),
    ),
  ].join("\n");
};

export function createCrudRouter<Create, Update>({
  model,
  createSchema,
  updateSchema,
  permissionKey,
  listOptions,
  hooks,
}: CrudOptions<Create, Update>) {
  const router = Router();

  router.use(authMiddleware);

  router.get(
    "/",
    requirePermission(permissionKey, actionPermission("view")),
    async (req, res) => {
      const query = parseListQuery(req);
      const where = buildWhere(
        query.search,
        listOptions?.searchableFields,
        query.filter,
        listOptions?.softDelete,
      );

      const [data, total] = await Promise.all([
        model.findMany({
          where,
          skip: query.page * query.size,
          take: query.size,
          include: listOptions?.defaultInclude,
          orderBy: query.sort
            ? { [query.sort.field]: query.sort.direction }
            : listOptions?.defaultOrderBy,
        }),
        model.count({ where }),
      ]);

      return sendOk(res, data, {
        page: query.page,
        size: query.size,
        total,
      });
    },
  );

  router.get(
    "/search",
    requirePermission(permissionKey, actionPermission("view")),
    async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const where = buildWhere(
        q,
        listOptions?.searchableFields,
        {},
        listOptions?.softDelete,
      );

      const data = await model.findMany({
        where,
        take: 20,
        include: listOptions?.defaultInclude,
        orderBy: listOptions?.defaultOrderBy,
      });

      return sendOk(res, data);
    },
  );

  router.get(
    "/export",
    requirePermission(permissionKey, actionPermission("view")),
    async (req, res) => {
      const query = parseListQuery(req);
      const where = buildWhere(
        query.search,
        listOptions?.searchableFields,
        query.filter,
        listOptions?.softDelete,
      );
      const data = await model.findMany({
        where,
        include: listOptions?.defaultInclude,
        orderBy: query.sort
          ? { [query.sort.field]: query.sort.direction }
          : listOptions?.defaultOrderBy,
      });

      res.header("Content-Type", "text/csv");
      res.attachment("export.csv");
      return res.send(toCsv(data));
    },
  );

  router.get(
    "/:id",
    requirePermission(permissionKey, actionPermission("view")),
    async (req, res) => {
      const row = await model.findUnique({
        where: { id: getParamId(req) },
        include: listOptions?.defaultInclude,
      });

      if (!row) {
        throw new NotFoundError("Resource not found");
      }

      return sendOk(res, row);
    },
  );

  router.post(
    "/",
    requirePermission(permissionKey, actionPermission("create")),
    async (req, res) => {
      const parsed = createSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(parsed.error.flatten().fieldErrors);
      }
      const data = hooks?.beforeCreate
        ? await hooks.beforeCreate(parsed.data)
        : parsed.data;

      const row = await model.create({ data });

      return sendOk(res, row, undefined, 201);
    },
  );

  router.patch(
    "/:id",
    requirePermission(permissionKey, actionPermission("update")),
    async (req, res) => {
      const id = getParamId(req);
      const existing = await model.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundError("Resource not found");
      }

      const parsed = updateSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(parsed.error.flatten().fieldErrors);
      }

      const data = hooks?.beforeUpdate
        ? await hooks.beforeUpdate(parsed.data, existing)
        : parsed.data;

      const row = await model.update({
        where: { id },
        data,
      });

      return sendOk(res, row);
    },
  );
  router.delete(
    "/:id",
    requirePermission(permissionKey, actionPermission("delete")),
    async (req, res) => {
      const id = getParamId(req);
      const existing = await model.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError("Resource not found");
      }
      if (listOptions?.blockDeleteIfExists?.length) {
        const dependencyErrors: string[] = [];

        for (const dep of listOptions.blockDeleteIfExists) {
          const rows = await dep.model.findMany({
            where: dep.where(id),
            select: dep.select ?? {
              id: true,
              name: true,
            },

            take: 5,
          });

          if (rows.length > 0) {
            const names = rows
              .map((row: any) =>
                dep.getName ? dep.getName(row) : row.name || row.code || row.id,
              )
              .join(", ");

            dependencyErrors.push(
              `${dep.label}: ${names}${rows.length === 5 ? " ..." : ""}`,
            );
          }
        }
        if (dependencyErrors.length > 0) {
          throw new BadRequestError(
            `Cannot delete this record because dependent data exists.\n\n${dependencyErrors.join(
              "\n",
            )}`,
          );
        }
      }
      if (hooks?.beforeDelete) {
        await hooks.beforeDelete(id);
      }
      await model.delete({
        where: { id },
      });

      return sendOk(res, {
        success: true,
        message: "Record deleted successfully",
      });
    },
  );

  router.post(
    "/bulk-delete",
    requirePermission(permissionKey, actionPermission("delete")),
    async (req, res) => {
      const ids = parseIds(req.body);

      // 1. Check dependency before deleting
      if (listOptions?.blockDeleteIfExists?.length) {
        const dependencyErrors: string[] = [];

        for (const id of ids) {
          for (const dep of listOptions.blockDeleteIfExists) {
            const rows = await dep.model.findMany({
              where: dep.where(id),
              select: dep.select ?? {
                id: true,
                name: true,
              },
              take: 5,
            });

            if (rows.length > 0) {
              const names = rows
                .map((row: any) =>
                  dep.getName
                    ? dep.getName(row)
                    : row.name || row.code || row.id,
                )
                .join(", ");

              dependencyErrors.push(
                `${dep.label}: ${names}${rows.length === 5 ? " ..." : ""}`,
              );
            }
          }
        }

        if (dependencyErrors.length > 0) {
          throw new BadRequestError(
            `Cannot delete selected records because dependent data exists.\n\n${dependencyErrors.join(
              "\n",
            )}`,
          );
        }
      }

      // 2. Run custom beforeDelete hook if available
      if (hooks?.beforeDelete) {
        for (const id of ids) {
          await hooks.beforeDelete(id);
        }
      }

      // 3. Delete all selected rows
      const result = await model.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      return sendOk(res, {
        success: true,
        deletedCount: result.count,
        message: `${result.count} record(s) deleted successfully`,
      });
    },
  );

  router.post(
    "/bulk-import",
    requirePermission(permissionKey, actionPermission("create")),
    async (req, res) => {
      const rows =
        req.body && typeof req.body === "object" && "rows" in req.body
          ? req.body.rows
          : req.body;

      if (!Array.isArray(rows)) {
        throw new BadRequestError("Bulk import expects an array of rows");
      }

      const errors: { row: number; issues: string[] }[] = [];
      let inserted = 0;

      for (const [index, row] of rows.entries()) {
        const parsed = createSchema.safeParse(row);

        if (!parsed.success) {
          errors.push({
            row: index + 1,
            issues: parsed.error.issues.map((issue) => issue.message),
          });
          continue;
        }

        await model.create({ data: parsed.data });
        inserted += 1;
      }

      return sendOk(res, { inserted, errors });
    },
  );

  return router;
}
