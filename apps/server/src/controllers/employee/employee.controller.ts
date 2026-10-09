import { Request, Response } from "express";
import {
  createEmployeeSchema,
  employeePageQuerySchema,
  resetEmployeePasswordSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from "@skerp/validators";
import { ValidationError } from "../../lib/error.js";
import { sendOk } from "../../modules/_shared/response.js";
import {
  createEmployeeService,
  deleteEmployeeService,
  getEmployeeService,
  listEmployeesPageService,
  listEmployeesService,
  resetEmployeePasswordService,
  updateEmployeeService,
  updateEmployeeStatusService,
} from "../../Services/employee/employee.services.js";
import { sendEmployeeCredentialsEmail } from "../../Services/email/email.services.js";

const loginUrl = () =>
  `${process.env.WEB_URL || "http://localhost:3001"}/login`;

export const createEmployeeController = async (req: Request, res: Response) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await createEmployeeService(parsed.data);

  const emailSent = await sendEmployeeCredentialsEmail({
    to: parsed.data.email,
    name: `${parsed.data.firstName} ${parsed.data.lastName}`,
    loginEmail: parsed.data.email,
    password: parsed.data.password,
    loginUrl: loginUrl(),
  });

  return sendOk(res, { employee, emailSent }, undefined, 201);
};

export const listEmployeesController = async (_req: Request, res: Response) => {
  return sendOk(res, await listEmployeesService());
};

export const listEmployeesPageController = async (
  req: Request,
  res: Response,
) => {
  const parsed = employeePageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.flatten().fieldErrors,
      "Check the search and page and try again.",
    );
  }
  const { items, total } = await listEmployeesPageService(parsed.data);
  return sendOk(res, items, {
    total,
    page: parsed.data.page,
    size: parsed.data.size,
  });
};

export const getEmployeeController = async (req: Request, res: Response) => {
  return sendOk(res, await getEmployeeService(req.params.id as string));
};

export const updateEmployeeController = async (req: Request, res: Response) => {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await updateEmployeeService(
    req.params.id as string,
    parsed.data,
  );
  return sendOk(res, employee);
};

export const resetEmployeePasswordController = async (
  req: Request,
  res: Response,
) => {
  const parsed = resetEmployeePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await resetEmployeePasswordService(
    req.params.id as string,
    parsed.data.password,
  );

  const emailSent = await sendEmployeeCredentialsEmail({
    to: employee.email,
    name: `${employee.firstName} ${employee.lastName}`,
    loginEmail: employee.email,
    password: parsed.data.password,
    loginUrl: loginUrl(),
  });

  return sendOk(res, { employee, emailSent });
};

export const updateEmployeeStatusController = async (
  req: Request,
  res: Response,
) => {
  const parsed = updateEmployeeStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await updateEmployeeStatusService(
    req.params.id as string,
    parsed.data.status,
    req.ctx!.userId,
  );
  return sendOk(res, employee);
};

export const deleteEmployeeController = async (req: Request, res: Response) => {
  return sendOk(
    res,
    await deleteEmployeeService(req.params.id as string, req.ctx!.userId),
  );
};
