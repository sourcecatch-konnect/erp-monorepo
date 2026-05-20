import { Request, Response } from "express";
import {
  createEmployeeSchema,
  resetEmployeePasswordSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from "@skerp/validators";
import { ValidationError } from "../../lib/error.js";
import {
  createEmployeeService,
  getEmployeeService,
  listEmployeesService,
  resetEmployeePasswordService,
  updateEmployeeService,
  updateEmployeeStatusService,
} from "../../Services/employee/employee.services.js";
import { sendEmployeeCredentialsEmail } from "../../Services/email/email.services.js";

const loginUrl = () =>
  `${process.env.EMPLOYEE_WEB_URL || "http://localhost:3002"}/login`;

export const createEmployeeController = async (
  req: Request,
  res: Response
) => {
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

  return res.status(201).json({
    success: true,
    data: { employee, emailSent },
  });
};

export const listEmployeesController = async (
  _req: Request,
  res: Response
) => {
  const employees = await listEmployeesService();
  return res.json({ success: true, data: employees });
};

export const getEmployeeController = async (
  req: Request,
  res: Response
) => {
  const employee = await getEmployeeService(req.params.id as string);
  return res.json({ success: true, data: employee });
};

export const updateEmployeeController = async (
  req: Request,
  res: Response
) => {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await updateEmployeeService(
    req.params.id as string,
    parsed.data
  );
  return res.json({ success: true, data: employee });
};

export const resetEmployeePasswordController = async (
  req: Request,
  res: Response
) => {
  const parsed = resetEmployeePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await resetEmployeePasswordService(
    req.params.id as string,
    parsed.data.password
  );

  const emailSent = await sendEmployeeCredentialsEmail({
    to: employee.email,
    name: `${employee.firstName} ${employee.lastName}`,
    loginEmail: employee.email,
    password: parsed.data.password,
    loginUrl: loginUrl(),
  });

  return res.json({
    success: true,
    data: { employee, emailSent },
  });
};

export const updateEmployeeStatusController = async (
  req: Request,
  res: Response
) => {
  const parsed = updateEmployeeStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const employee = await updateEmployeeStatusService(
    req.params.id as string,
    parsed.data.status
  );
  return res.json({ success: true, data: employee });
};
