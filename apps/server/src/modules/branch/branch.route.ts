import { Router } from "express";
import {
  createBranchSchema,
  updateBranchSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { BadRequestError } from "../../lib/error.js";

const plural = (count: number, singular: string, pluralName?: string) =>
  `${count} ${count === 1 ? singular : pluralName ?? `${singular}s`}`;

const router: Router = createCrudRouter({
  model: db.branch,
  createSchema: createBranchSchema as ZodTypeAny,
  updateSchema: updateBranchSchema as ZodTypeAny,
  permissionKey: "masters.branch",

  hooks: {
    beforeDelete: async (id) => {
      const [
        branch,
        users,
        userBranches,
        warehouses,
        agreements,
        workers,
        fromOrders,
        toOrders,
        originLRs,
        destinationLRs,
        hubLRs,
        railheadLRs,
        attachments,
      ] = await Promise.all([
        db.branch.findUnique({
          where: { id },
          select: {
            isHeadOffice: true,
          },
        }),

        db.user.count({
          where: { branchId: id },
        }),

        db.userBranch.count({
          where: { branchId: id },
        }),

        db.warehouse.count({
          where: { branchId: id },
        }),

        db.agreement.count({
          where: { leadGeneratedByBranchId: id },
        }),

        db.labour.count({
          where: { branchId: id },
        }),

        db.order.count({
          where: { fromBranchId: id },
        }),

        db.order.count({
          where: { toBranchId: id },
        }),

        db.lorryReceipt.count({
          where: { originBranchId: id },
        }),

        db.lorryReceipt.count({
          where: { destinationBranchId: id },
        }),

        db.lorryReceipt.count({
          where: { hubId: id },
        }),

        db.lorryReceipt.count({
          where: { railheadBranchId: id },
        }),

        db.attachment.count({
          where: { branchId: id },
        }),
      ]);

      if (!branch) {
        throw new BadRequestError("Branch not found.");
      }

      if (branch.isHeadOffice) {
        throw new BadRequestError(
          "This branch is marked as Head Office and cannot be deleted."
        );
      }

      const dependencies: string[] = [];

      if (users) dependencies.push(plural(users, "user"));

      if (userBranches) {
        dependencies.push(
          plural(userBranches, "user branch access record")
        );
      }

      if (warehouses) {
        dependencies.push(plural(warehouses, "warehouse"));
      }

      if (agreements) {
        dependencies.push(plural(agreements, "agreement"));
      }

      if (workers) {
        dependencies.push(plural(workers, "worker"));
      }

      if (fromOrders) {
        dependencies.push(`${plural(fromOrders, "order")} as origin`);
      }

      if (toOrders) {
        dependencies.push(`${plural(toOrders, "order")} as destination`);
      }

      if (originLRs) {
        dependencies.push(`${plural(originLRs, "LR")} as origin`);
      }

      if (destinationLRs) {
        dependencies.push(`${plural(destinationLRs, "LR")} as destination`);
      }

      if (hubLRs) {
        dependencies.push(`${plural(hubLRs, "LR")} as hub`);
      }

      if (railheadLRs) {
        dependencies.push(`${plural(railheadLRs, "LR")} as railhead`);
      }

      if (attachments) {
        dependencies.push(plural(attachments, "attachment"));
      }

      if (dependencies.length) {
        throw new BadRequestError(
          `This branch cannot be deleted because it is linked with ${dependencies.join(
            ", "
          )}. Please remove or update those records first.`
        );
      }
    },
  },

  uniqueErrorMessages: {
    branchCode: "This branch code already exists.",
    shortCode: "This short code already exists.",
  },

  listOptions: {
    searchableFields: [
      "branchCode",
      "shortCode",
      "name",
      "address",
      "contactName",
      "contactPhone",
      "email",
      "gstNo",
    ],

    defaultInclude: {
  company: {
    select: {
      id: true,
      name: true,
    },
  },
  city: {
    select: {
      id: true,
      name: true,
    },
  },
},
  },
});

export default router;