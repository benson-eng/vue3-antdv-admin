// 登入相關 API 調用
// 來源：src/api/users.ts
// 注意：需要適配目標專案的 request 函數

import { vueRequest as request } from "@/utils/vueRequest";

// 登入 API
export const loginLocal = (data: any) =>
  request({
    url: "/AdminSystem/api/login",
    method: "post",
    data
  });

// 取得使用者資訊 API
export const getUserInfoLocal = (data: any) =>
  request({
    url: "/AdminSystem/api/getUserInfo",
    method: "post",
    data
  });

// 登出 API
export const logoutLocal = (data: any) =>
  request({
    url: "/AdminSystem/api/logout",
    method: "post",
    data
  });

// 取得 BackendKey（雙因素驗證）
export const getBackendKey = async(data: {
  input: {
    id: number
  }
}) => {
  return request({
    url: "/AdminSystem/api/getBackendKey",
    method: "post",
    data,
    timeout: 0
  });
};

