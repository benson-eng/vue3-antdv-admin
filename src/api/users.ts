// 登入相關 API 調用
// 從 Vue 2 + Element UI 專案整合，已轉換為 Vue 3 格式
// 適配現有專案的 request 函數

import type { IVueResponse } from '@/api/types';
import { resolveAdminSystemPath } from '@/utils/mockSwitch';
import { request } from '@/utils/request';

/**
 * 登入 API
 */
export const loginLocal = (data: { account: string; password: string }) =>
  request<IVueResponse>({
    url: resolveAdminSystemPath('/AdminSystem/api/login'),
    method: 'post',
    data,
  });

/**
 * 取得使用者資訊 API
 */
export const getUserInfoLocal = (data: { token: string }) =>
  request<IVueResponse>({
    url: resolveAdminSystemPath('/AdminSystem/api/getUserInfo'),
    method: 'post',
    data,
  });

/**
 * 登出 API
 */
export const logoutLocal = (data: any = {}) =>
  request<IVueResponse>({
    url: resolveAdminSystemPath('/AdminSystem/api/logout'),
    method: 'post',
    data,
  });

/**
 * 取得 BackendKey（Authenticator驗證）
 */
export const getBackendKey = async (data: {
  id: number;
}) => {
  return request<IVueResponse>({
    url: resolveAdminSystemPath('/AdminSystem/api/getBackendKey'),
    method: 'post',
    data,
    timeout: 0,
  });
};
