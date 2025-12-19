import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem）
 * 對應來源：admin-web/src/api/admin.ts + views/adminAccount/agent.vue
 * =========================================
 */

export type AgentRole = {
  id: number;
  key?: string;
  name?: string;
};

export type AgentItem = Record<string, any> & {
  id: number;
  account: string;
  name?: string;
  prefix?: string;
  isEnabled?: boolean;
  isMaintained?: boolean;
  roles?: AgentRole[];
  createDatetime?: string;
  lastLoginDatetime?: string;
  lastLoginIP?: string;

  // 合併自 getAgentApiSettings 的欄位（方便列表/編輯）
  website?: string;
  apiDomain?: string;
  whiteIPList?: string;
  hashKey?: string;
};

export type AgentApiSettings = {
  website?: string;
  apiDomain?: string;
  whiteIPList?: string;
  hashKey?: string;
};

export type AgentApiSettingsItem = {
  account: string;
  apiSettings?: AgentApiSettings;
};

/** 取得指定 MasterAgent 底下的 Agent 清單 */
export const getAgentListByMasterAgent = (data: { masterAgent: string }) =>
  request<AgentItem[]>({
    url: '/AdminSystem/api/getAgentListByMasterAgent',
    method: 'post',
    data,
    timeout: 0,
  });

/** 建立 Agent 後台帳號 */
export const createAgentAccount = (data: {
  account: string;
  password: string;
  name: string;
  prefix: string;
  isEnabled: boolean;
  backendKey?: string;
  roles: number[];
  masterAgentAccount: string;
}) =>
  request<any>({
    url: '/AdminSystem/api/createAgentAccount',
    method: 'post',
    data,
    timeout: 0,
  });

/** 更新 Agent 後台帳號 */
export const updateAgentAccount = (data: {
  id: number;
  account: string;
  name: string;
  prefix: string;
  isEnabled: boolean;
  isMaintained?: boolean;
  roles: number[];
}) =>
  request<any>({
    url: '/AdminSystem/api/updateAgentAccount',
    method: 'post',
    data,
    timeout: 0,
  });

/** 變更 Agent 後台密碼（與 MasterAgent 共用 endpoint） */
export const updateAgentAccountPassword = (data: { account: string; newPassword: string }) =>
  request<any>({
    url: '/AdminSystem/api/changeAdminAccountPassword',
    method: 'post',
    data,
    timeout: 0,
  });

/** 更新指定 Agent 的 ApiSettings */
export const updateAgentApiSettings = (data: {
  agentAccount: string;
  hashKey?: string;
  website?: string;
  apiDomain?: string;
  whiteIPList?: string;
}) =>
  request<any>({
    url: '/AdminSystem/api/updateAgentApiSettings',
    method: 'post',
    data,
    timeout: 0,
  });

/** 取得指定 Agent 的 ApiSettings（支援批次） */
export const getAgentApiSettings = (data: { agentAccounts: string[] }) =>
  request<AgentApiSettingsItem[]>({
    url: '/AdminSystem/api/getAgentApiSettings',
    method: 'post',
    data,
    timeout: 0,
  });

/** 刪除指定 Agent 的 ApiSettings */
export const deleteAgentApiSettings = (data: { agentAccount: string }) =>
  request<any>({
    url: '/AdminSystem/api/deleteAgentApiSettings',
    method: 'post',
    data,
    timeout: 0,
  });

export default {
  getAgentListByMasterAgent,
  createAgentAccount,
  updateAgentAccount,
  updateAgentAccountPassword,
  updateAgentApiSettings,
  getAgentApiSettings,
  deleteAgentApiSettings,
};

