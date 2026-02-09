import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem）
 * 對應來源：admin-web/src/api/admin.ts + adminAccount/masterAgent.vue
 * =========================================
 */

export interface MasterAgentRole {
  id: number;
  key?: string;
  name?: string;
}

export interface MasterAgentCurrency {
  currencyIndex?: number;
  currencyName?: string;
  currencyCode?: string;
}

export type MasterAgentItem = Record<string, any> & {
  id: number;
  account: string;
  name?: string;
  isEnabled?: boolean;
  isMaintained?: boolean;
  roles?: MasterAgentRole[];
  website?: string;
  apiDomain?: string;
  whiteIPList?: string;
  cdnList?: string;
  proxyList?: string;
  currencies?: MasterAgentCurrency[];
  createDatetime?: string;
  lastLoginDatetime?: string;
  lastLoginIP?: string;
  internalSettings?: string;
  remoteConfigURLs?: string;
  shareholder?: any;
};

/**
 * 取得總代理清單（完整資料）
 * 後端：POST /AdminSystem/api/getMasterAgentListByAccount
 */
export const getMasterAgentAccountList = (data: { website?: string } = {}) =>
  request<MasterAgentItem[]>({
    url: '/AdminSystem/api/getMasterAgentListByAccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const createMasterAgentAccount = (data: Record<string, any>) =>
  request<any>({
    url: '/AdminSystem/api/createMasterAgentAccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const updateMasterAgentAccount = (data: Record<string, any>) =>
  request<any>({
    url: '/AdminSystem/api/updateMasterAgentAccount',
    method: 'post',
    data,
    timeout: 0,
  });

/**
 * 變更總代理後台密碼
 * 後端：POST /AdminSystem/api/changeAdminAccountPassword
 */
export const updateMasterAgentAccountPassword = (data: { account: string; newPassword: string }) =>
  request<any>({
    url: '/AdminSystem/api/changeAdminAccountPassword',
    method: 'post',
    data,
    timeout: 0,
  });

/** 更新總代的股東歸屬 */
export const updateMasterAgentShareholder = (data: { masterAgentAccount: string; shareholderAccount: string }) =>
  request<any>({
    url: '/AdminSystem/api/updateMasterAgentShareholder',
    method: 'post',
    data,
    timeout: 0,
  });

/** 移除總代理的股東層級歸屬，重新指向 CG 層級 */
export const removeMasterAgentFromShareholder = (data: { masterAgentAccount: string }) =>
  request<any>({
    url: '/AdminSystem/api/removeMasterAgentFromShareholder',
    method: 'post',
    data,
    timeout: 0,
  });

/**
 * 取得所有網站列表
 * 來源：admin-web/src/api/admin.ts getAllWebsite
 * 從 getMasterAgentAccountList 的完整資料中提取 website 欄位
 */
export const getAllWebsite = async (): Promise<string[]> => {
  const response = await getMasterAgentAccountList();
  const masterAgentList = response || [];
  /**
   * 過濾掉 undefined/null
   */
  const allWebsite = masterAgentList
    .map(masterAgentInfo => masterAgentInfo.website)
    .filter((website): website is string => !!website);
  return allWebsite;
};

export default {
  getMasterAgentAccountList,
  createMasterAgentAccount,
  updateMasterAgentAccount,
  updateMasterAgentAccountPassword,
  updateMasterAgentShareholder,
  removeMasterAgentFromShareholder,
  getAllWebsite,
};
