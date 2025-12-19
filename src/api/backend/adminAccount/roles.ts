import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem）
 * 對應來源：admin-web/src/api/roles.ts
 *
 * 注意：
 * - 目標專案的 request 對 /AdminSystem/ 走「IVueResponse」格式
 * - 這裡直接回傳 IVueResponse.data（payload），避免 request overload 型別不一致
 * =========================================
 */

export type PermissionListPayload = {
  roles: Record<string, string[]>;
};

export type RolesListPayload = {
  roles: any[];
};

export type DeleteRolePayload = {
  status: boolean;
};

/** /AdminSystem/api/permissionList */
export const getRouteRoles = () =>
  request<PermissionListPayload>({
    url: '/AdminSystem/api/permissionList',
    method: 'post',
  });

/** /AdminSystem/api/rolesList */
export const getlocalRoles = (data: any = {}) =>
  request<RolesListPayload>({
    url: '/AdminSystem/api/rolesList',
    method: 'post',
    data,
  });

/** /AdminSystem/api/deleteRole */
export const deletelocalRoles = (data: any) =>
  request<DeleteRolePayload>({
    url: '/AdminSystem/api/deleteRole',
    method: 'post',
    data,
  });

/** /AdminSystem/api/createRoles */
export const createlocalRole = (data: any) =>
  request<any>({
    url: '/AdminSystem/api/createRoles',
    method: 'post',
    data,
  });

/** /AdminSystem/api/updateRoles */
export const updatelocalRole = (data: any) =>
  request<any>({
    url: '/AdminSystem/api/updateRoles',
    method: 'post',
    data,
  });

export default {
  getRouteRoles,
  getlocalRoles,
  deletelocalRoles,
  createlocalRole,
  updatelocalRole,
};

