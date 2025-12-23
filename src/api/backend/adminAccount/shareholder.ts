import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem）
 * 對應來源：admin-web/src/api/admin.ts
 * =========================================
 */

export type ShareholderRole = {
  id: number;
  key?: string;
  name: string;
  description?: string;
  creatorLevel?: number;
  creatorAccount?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type ShareholderItem = {
  id: number;
  account: string;
  name: string;
  isEnabled: boolean;
  isMasterAccount?: boolean;
  roles: ShareholderRole[];
};

export const getShareholderList = (data: Record<string, never> = {}) =>
  request<ShareholderItem[]>({
    url: '/AdminSystem/api/getShareholderList',
    method: 'post',
    data,
    timeout: 0,
  });

export const createShareholderAccount = (data: {
  account: string;
  password: string;
  name: string;
  roles: number[];
  backendKey?: string;
}) =>
  request<any>({
    url: '/AdminSystem/api/createShareholderAccount',
    method: 'post',
    data,
    timeout: 0,
  });

export const updateShareholderAccount = (data: {
  id: number;
  account: string;
  name: string;
  roles: number[];
  isEnabled: boolean;
}) =>
  request<any>({
    url: '/AdminSystem/api/updateShareholderAccount',
    method: 'post',
    data,
    timeout: 0,
  });

export default {
  getShareholderList,
  createShareholderAccount,
  updateShareholderAccount,
};



