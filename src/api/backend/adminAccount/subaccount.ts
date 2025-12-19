import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem）
 * 對應來源：admin-web/src/api/admin.ts + views/adminAccount/subaccount*.vue
 * =========================================
 */

export interface SubaccountRole {
  id: number;
  key?: string;
  name?: string;
}

export type SubaccountItem = Record<string, any> & {
  id: number;
  account: string;
  name?: string;
  prefix?: string;
  isEnabled?: boolean;
  isMaintained?: boolean;
  roles?: SubaccountRole[];
  createDatetime?: string;
  lastLoginDatetime?: string;
  lastLoginIP?: string;
  backendKey?: string;
  allowRedemptionCode?: boolean;
  authenticator?: boolean;
};

export const getAdminSubaccountList = (data: {
  filter?: {
    account?: string;
    masterAgent?: string;
    /** Vue2 subaccountChildren 使用 masterAccount */
    masterAccount?: string;
    startDate?: Date;
    dueDate?: Date;
  };
} = {}) =>
  request<SubaccountItem[]>({
    url: '/AdminSystem/api/getAdminSubaccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const createAdminSubaccount = (data: {
  account: string;
  password: string;
  name: string;
  isEnabled: boolean;
  backendKey?: string;
  authenticator?: boolean;
  roles: number[];
}) =>
  request<any>({
    url: '/AdminSystem/api/createAdminSubaccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const createAdminChildSubaccount = (data: {
  account: string;
  password: string;
  name: string;
  isEnabled: boolean;
  backendKey?: string;
  roles: number[];
  masterAccount: string;
}) =>
  request<any>({
    url: '/AdminSystem/api/createAdminChildSubaccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const updateAdminSubaccount = (data: {
  id: number;
  account: string;
  name: string;
  isEnabled: boolean;
  roles: number[];
  allowRedemptionCode?: boolean;
}) =>
  request<any>({
    url: '/AdminSystem/api/updateAdminSubaccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const updateAdminAccountPassword = (data: { account: string; newPassword: string }) =>
  request<any>({
    url: '/AdminSystem/api/changeAdminAccountPassword',
    method: 'post',
    data,
    timeout: 0,
  });

export default {
  getAdminSubaccountList,
  createAdminSubaccount,
  createAdminChildSubaccount,
  updateAdminSubaccount,
  updateAdminAccountPassword,
};
