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
  createdAt: string;
  updatedAt: string;
  role: { id: string; name: string };
  branch: { id: string; name: string };
  company: { id: string; name: string };
};

export type CreateEmployeeInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  companyId: string;
  branchId: string;
};

export type Company = { id: string; name: string };
export type Branch = { id: string; name: string; companyId: string };

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
