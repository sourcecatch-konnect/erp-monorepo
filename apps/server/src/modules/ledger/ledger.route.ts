import { Router } from "express";

import { ledgerQuerySchema } from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";
import { ValidationError } from "../../lib/error.js";
import {
  ledgerForAccount,
  ledgerForCreditor,
  ledgerForCustomer,
  ledgerForExpenseCategory,
} from "./ledger.service.js";

const router: Router = Router();
router.use(authMiddleware);

const parseRange = (query: unknown) => {
  const parsed = ledgerQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
};

// Bank / Cash ledger — same read, the account's own `type` says which report it is.
router.get("/cash-accounts/:id", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const view = await ledgerForAccount(id, parseRange(req.query));
  return sendOk(res, view);
});

// Debtor (Customer) ledger.
router.get("/customers/:id", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const view = await ledgerForCustomer(id, parseRange(req.query));
  return sendOk(res, view);
});

// Creditor ledger.
router.get("/creditors/:id", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const id = getParamId(req);
  const view = await ledgerForCreditor(id, parseRange(req.query));
  return sendOk(res, view);
});

// Expense ledger — flat, category-scoped, not tied to one party.
router.get("/expenses", can(PERMS.LEDGER.VIEW), async (req, res) => {
  const view = await ledgerForExpenseCategory(parseRange(req.query));
  return sendOk(res, view);
});

export default router;
