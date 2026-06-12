"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createEmployee,
  listBranches,
  listCompanies,
  listEmployees,
  resetEmployeePassword,
  setEmployeeStatus,
  updateEmployee,
} from "../services/employee.service";

const EMPLOYEES_KEY = ["employees"] as const;

export const useEmployees = () =>
  useQuery({ queryKey: EMPLOYEES_KEY, queryFn: listEmployees });

export const useCompanies = () =>
  useQuery({ queryKey: ["companies"], queryFn: listCompanies });

export const useBranches = (companyId?: string) =>
  useQuery({
    queryKey: ["branches", companyId ?? null],
    queryFn: () => listBranches(companyId),
    enabled: Boolean(companyId),
  });

export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
};

export const useResetEmployeePassword = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      resetEmployeePassword(id, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
};

export const useUpdateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateEmployee>[1];
    }) => updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
};

export const useSetEmployeeStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: boolean }) =>
      setEmployeeStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
};
