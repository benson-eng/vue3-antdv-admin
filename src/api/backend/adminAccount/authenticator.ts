import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊頁面：admin-web/src/views/adminAccount/Authenticator.vue
 * Vue2 舊 API：admin-web/src/api/admin.ts
 * =========================================
 */

export type AdminAccountAuthenticatorItem = Record<string, any> & {
  id: number;
  account: string;
  backendKey?: string;
  /** Vue2 回傳可能是 Authenticator（大寫 A），這裡保留兩種用法 */
  Authenticator?: boolean;
  authenticator?: boolean;
  hierarchyLevel?: number;
  masterAgent?: string;
  parentAgentHierarchy?: string | number;
  isMasterAccount?: boolean;
};

export const getAllAccount = () =>
  request<AdminAccountAuthenticatorItem[]>({
    url: '/AdminSystem/api/getAllAccount',
    method: 'post',
    timeout: 0,
  });

export const bulkUpdateBackendKeyAndAuthenticator = (data: {
  settings: {
    id: number;
    account: string;
    backendKey?: string;
    authenticator?: boolean;
  }[];
}) =>
  request<any>({
    url: '/AdminSystem/api/bulkUpdateBackendKeyAndAuthenticator',
    method: 'post',
    data,
    timeout: 0,
  });

export default {
  getAllAccount,
  bulkUpdateBackendKeyAndAuthenticator,
};


