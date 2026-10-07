import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import type { EmployeePageQuery } from "@skerp/validators";
import {
  unwrapApiResponse,
  unwrapListResponse,
} from "../../masters/_shared/master-api";
import type {
  Branch,
  Company,
  CreateEmployeeInput,
  Employee,
  EmployeeListRow,
  EmployeeMutationResult,
  RoleOption,
  UpdateEmployeeInput,
} from "../types";

export const listEmployeesPage = async (
  params: EmployeePageQuery,
  signal?: AbortSignal,
) => {
  const list = unwrapListResponse(
    await api.get<ApiResponse<EmployeeListRow[]>>("/employees/page", {
      params,
      signal,
    }),
  );
  return { items: list.data, total: list.meta?.total ?? 0 };
};

export const getEmployee = async (id: string): Promise<Employee> =>
  unwrapApiResponse(await api.get<ApiResponse<Employee>>(`/employees/${id}`));

export const createEmployee = async (
  input: CreateEmployeeInput,
): Promise<EmployeeMutationResult> =>
  unwrapApiResponse(
    await api.post<ApiResponse<EmployeeMutationResult>>("/employees", input),
  );

export const resetEmployeePassword = async (
  id: string,
  password: string,
): Promise<EmployeeMutationResult> =>
  unwrapApiResponse(
    await api.patch<ApiResponse<EmployeeMutationResult>>(
      `/employees/${id}/password`,
      { password },
    ),
  );

export const updateEmployee = async (
  id: string,
  input: UpdateEmployeeInput,
): Promise<Employee> =>
  unwrapApiResponse(
    await api.patch<ApiResponse<Employee>>(`/employees/${id}`, input),
  );

export const setEmployeeStatus = async (
  id: string,
  status: boolean,
): Promise<Employee> =>
  unwrapApiResponse(
    await api.patch<ApiResponse<Employee>>(`/employees/${id}/status`, {
      status,
    }),
  );

export const deleteEmployee = async (id: string): Promise<{ id: string }> =>
  unwrapApiResponse(
    await api.delete<ApiResponse<{ id: string }>>(`/employees/${id}`),
  );

export const listCompanies = async (): Promise<Company[]> =>
  unwrapApiResponse(await api.get<ApiResponse<Company[]>>("/companies"));

export const listBranches = async (companyId?: string): Promise<Branch[]> =>
  unwrapApiResponse(
    await api.get<ApiResponse<Branch[]>>("/branches", {
      params: companyId ? { companyId } : undefined,
    }),
  );

export const listRoles = async (): Promise<RoleOption[]> =>
  unwrapApiResponse(await api.get<ApiResponse<RoleOption[]>>("/admin/roles"));
