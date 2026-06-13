import { api } from "@/lib/api";
import type {
  Branch,
  Company,
  CreateEmployeeInput,
  Employee,
  EmployeeMutationResult,
  UpdateEmployeeInput,
} from "../types";

type ApiSuccess<T> = {
  success: boolean;
  data: T;
};

export const listEmployees = async (): Promise<Employee[]> => {
  const res = await api.get<ApiSuccess<Employee[]>>("/employees");
  return res.data.data;
};

export const createEmployee = async (
  input: CreateEmployeeInput
): Promise<EmployeeMutationResult> => {
  const res = await api.post<ApiSuccess<EmployeeMutationResult>>(
    "/employees",
    input
  );
  return res.data.data;
};

export const resetEmployeePassword = async (
  id: string,
  password: string
): Promise<EmployeeMutationResult> => {
  const res = await api.patch<ApiSuccess<EmployeeMutationResult>>(
    `/employees/${id}/password`,
    { password }
  );
  return res.data.data;
};

export const updateEmployee = async (
  id: string,
  input: UpdateEmployeeInput
): Promise<Employee> => {
  const res = await api.patch<ApiSuccess<Employee>>(
    `/employees/${id}`,
    input
  );
  return res.data.data;
};

export const setEmployeeStatus = async (
  id: string,
  status: boolean
): Promise<Employee> => {
  const res = await api.patch<ApiSuccess<Employee>>(
    `/employees/${id}/status`,
    { status }
  );
  return res.data.data;
};

export const listCompanies = async (): Promise<Company[]> => {
  const res = await api.get<ApiSuccess<Company[]>>("/companies");
  return res.data.data;
};

export const listBranches = async (
  companyId?: string
): Promise<Branch[]> => {
  const res = await api.get<ApiSuccess<Branch[]>>("/branches", {
    params: companyId ? { companyId } : undefined,
  });
  return res.data.data;
};
