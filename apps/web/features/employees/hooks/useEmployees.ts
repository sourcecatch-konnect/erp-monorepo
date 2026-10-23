"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { EmployeePageQuery } from "@skerp/validators";
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listBranches,
  listCompanies,
  listEmployeesPage,
  listRoles,
  resetEmployeePassword,
  setEmployeeStatus,
  updateEmployee,
} from "../services/employee.service";
import type { Employee } from "../types";

/** Everything lives under ["employees"], so one invalidation refreshes pages and details. */
export const employeeKeys = {
  all: ["employees"] as const,
  page: (params: EmployeePageQuery) => ["employees", "page", params] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
};

export const useEmployeesPage = (params: EmployeePageQuery) =>
  useQuery({
    queryKey: employeeKeys.page(params),
    queryFn: ({ signal }) => listEmployeesPage(params, signal),
    // Keeps the footer's total steady while the next page loads; the rows
    // still switch to skeletons until the database returns them.
    placeholderData: keepPreviousData,
  });

export const useEmployee = (id: string | undefined) =>
  useQuery({
    queryKey: employeeKeys.detail(id ?? ""),
    queryFn: () => getEmployee(id!),
    enabled: Boolean(id),
  });

export const useCompanies = () =>
  useQuery({ queryKey: ["companies"], queryFn: listCompanies });

export const useBranches = (companyId?: string) =>
  useQuery({
    queryKey: ["branches", companyId ?? null],
    queryFn: () => listBranches(companyId),
    enabled: Boolean(companyId),
  });

export const useRoles = () =>
  useQuery({ queryKey: ["roles"], queryFn: listRoles });

/**
 * Store the fresh record for the open dialog (no refetch needed) and refresh
 * the list pages.
 */
const useSyncEmployee = () => {
  const qc = useQueryClient();
  return (employee?: Employee) => {
    if (employee) qc.setQueryData(employeeKeys.detail(employee.id), employee);
    void qc.invalidateQueries({ queryKey: [...employeeKeys.all, "page"] });
  };
};

export const useCreateEmployee = () => {
  const sync = useSyncEmployee();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: (result) => sync(result.employee),
  });
};

export const useResetEmployeePassword = () => {
  const sync = useSyncEmployee();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      resetEmployeePassword(id, password),
    onSuccess: (result) => sync(result.employee),
  });
};

export const useUpdateEmployee = () => {
  const sync = useSyncEmployee();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateEmployee>[1];
    }) => updateEmployee(id, data),
    onSuccess: (employee) => sync(employee),
  });
};

export const useSetEmployeeStatus = () => {
  const sync = useSyncEmployee();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: boolean }) =>
      setEmployeeStatus(id, status),
    onSuccess: (employee) => sync(employee),
  });
};

export const useDeleteEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: ({ id }) => {
      qc.removeQueries({ queryKey: employeeKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: [...employeeKeys.all, "page"] });
    },
  });
};
