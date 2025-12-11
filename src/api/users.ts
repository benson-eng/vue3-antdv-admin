// 登入相關 API 調用
// 從 Vue 2 + Element UI 專案整合，已轉換為 Vue 3 格式
// 適配現有專案的 request 函數

import { request } from '@/utils/request';
import type { IVueResponse } from '@/api/types';

// 登入 API
export const loginLocal = (data: { account: string; password: string }) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/login',
    method: 'post',
    data,
  });

// 取得使用者資訊 API
export const getUserInfoLocal = (data: { token: string }) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/getUserInfo',
    method: 'post',
    data,
  });

// 登出 API
export const logoutLocal = (data: any = {}) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/logout',
    method: 'post',
    data,
  });

// 取得 BackendKey（雙因素驗證）
export const getBackendKey = async (data: {
  input: {
    id: number;
  };
}) => {
  return request<IVueResponse>({
    url: '/AdminSystem/api/getBackendKey',
    method: 'post',
    data,
    timeout: 0,
  });
};

