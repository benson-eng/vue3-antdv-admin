import { request } from '@/utils/request';
import type { IVueResponse } from '@/api/types';

export interface AdminAccountItem {
  id: number;
  account: string;
}

export const getMasterAgentList = () =>
  request<AdminAccountItem[]>({
    url: '/AdminSystem/api/getMasterAgentListByAccount',
    method: 'post',
    data: {},
  });

/**
 * 變更後台帳號密碼（需要舊密碼驗證）
 * 後端：POST /AdminSystem/api/changeAdminAccountPassword
 */
export const changeAdminAccountPassword = (data: { account: string; password: string; newPassword: string }) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/changeAdminAccountPassword',
    method: 'post',
    data,
    timeout: 0,
  });

