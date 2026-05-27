import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
} from "../masters/_shared/master-api";
import type {
  AuditLogEntry,
  BranchOption,
  PermissionDefDto,
  RoleDetail,
  RoleSummary,
  UserAccessDetail,
  UserSummary,
} from "./types";

export const rbacApi = {
  // Catalog
  permissions: async (): Promise<PermissionDefDto[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<PermissionDefDto[]>>("/admin/permissions")
    ),

  // Roles
  listRoles: async (): Promise<RoleSummary[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<RoleSummary[]>>("/admin/roles")
    ),
  getRole: async (id: string): Promise<RoleDetail> =>
    unwrapApiResponse(
      await api.get<ApiResponse<RoleDetail>>(`/admin/roles/${id}`)
    ),
  createRole: async (name: string): Promise<RoleSummary> =>
    unwrapApiResponse(
      await api.post<ApiResponse<RoleSummary>>("/admin/roles", { name })
    ),
  renameRole: async (id: string, name: string): Promise<RoleSummary> =>
    unwrapApiResponse(
      await api.patch<ApiResponse<RoleSummary>>(`/admin/roles/${id}`, { name })
    ),
  deleteRole: async (id: string): Promise<{ id: string }> =>
    unwrapApiResponse(
      await api.delete<ApiResponse<{ id: string }>>(`/admin/roles/${id}`)
    ),
  copyRole: async (id: string, name: string): Promise<RoleSummary> =>
    unwrapApiResponse(
      await api.post<ApiResponse<RoleSummary>>(`/admin/roles/${id}/copy`, {
        name,
      })
    ),
  setRolePermissions: async (
    id: string,
    permissionKeys: string[]
  ): Promise<{ permissionKeys: string[] }> =>
    unwrapApiResponse(
      await api.put<ApiResponse<{ permissionKeys: string[] }>>(
        `/admin/roles/${id}/permissions`,
        { permissionKeys }
      )
    ),

  // Users
  listUsers: async (): Promise<UserSummary[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<UserSummary[]>>("/admin/users")
    ),
  getUserAccess: async (id: string): Promise<UserAccessDetail> =>
    unwrapApiResponse(
      await api.get<ApiResponse<UserAccessDetail>>(
        `/admin/users/${id}/access`
      )
    ),
  updateUserAccess: async (
    id: string,
    body: {
      roleId?: string;
      branchScope?: "ALL" | "ASSIGNED";
      branchIds?: string[];
      overrides?: { key: string; effect: "GRANT" | "DENY" }[];
    }
  ): Promise<UserSummary> =>
    unwrapApiResponse(
      await api.patch<ApiResponse<UserSummary>>(
        `/admin/users/${id}/access`,
        body
      )
    ),

  // Helpers
  branches: async (): Promise<BranchOption[]> =>
    unwrapApiResponse(
      await api.get<ApiResponse<BranchOption[]>>("/admin/branches")
    ),

  // Audit log
  auditLog: async (params: {
    entity?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    page?: number;
    size?: number;
  }) => {
    const res = await api.get<ApiResponse<AuditLogEntry[]>>(
      "/admin/audit-log",
      { params }
    );
    const list = unwrapListResponse(res);
    return {
      items: list.data,
      total: list.meta?.total ?? 0,
      page: list.meta?.page ?? 1,
      size: list.meta?.size ?? 50,
    };
  },
};
