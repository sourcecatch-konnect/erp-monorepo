/** An employee user as returned by the server. */
export type Employee = {
  id: string;
  userName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  companyId: string;
  branchId: string;
  roleId: string;
  status: boolean;
  mobile: string | null;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  role: { id: string; name: string };
  branch: { id: string; name: string };
  company: { id: string; name: string };
};

/** What `GET /employees/page` returns per row — just what the table shows. */
export type EmployeeListRow = Pick<
  Employee,
  "id" | "firstName" | "middleName" | "lastName" | "email" | "status" | "role"
> & { branch: { id: string; name: string } };

/** Which user the detail dialog shows, and whether it opens straight into editing. */
export type EmployeeDialogTarget = { id: string; mode: "view" | "edit" };

export type CreateEmployeeInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  companyId: string;
  branchId: string;
  roleId: string;
};

export type UpdateEmployeeInput = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
  mobile?: string | null;
  companyId?: string;
  branchId?: string;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
};

export type Company = { id: string; name: string };
export type Branch = { id: string; name: string; companyId: string };
export type RoleOption = { id: string; name: string; isSystem: boolean };

/** Server response for create / password-reset. */
export type EmployeeMutationResult = {
  employee: Employee;
  emailSent: boolean;
};

/** Drives the credentials dialog after a create or reset. */
export type EmployeeCredentials = {
  name: string;
  email: string;
  password: string;
  emailSent: boolean;
};
