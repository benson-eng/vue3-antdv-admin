import type { MasterAgentItem } from './masterAgent';
import type { IVueResponse } from '@/api/types';
import { request } from '@/utils/request';

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

/**
 * 取得所有網站列表
 * 來源：admin-web/src/api/admin.ts getAllWebsite
 * 從 getMasterAgentList 的完整資料中提取 website 欄位
 */
export const getAllWebsite = async (): Promise<string[]> => {
  const response = await getMasterAgentList();
  const masterAgentList = response as unknown as MasterAgentItem[];
  const allWebsite = masterAgentList
    .map((masterAgentInfo) => masterAgentInfo.website)
    .filter((website): website is string => !!website); // 過濾掉 undefined/null
  return allWebsite;
};
