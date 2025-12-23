import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/cashierManager.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface GetPlatformAccountParams {
  memberID: string;
  platform?: string;
}

export interface PlatformAccountItem {
  platform: string;
  account: string;
}

export const getPlatformAccount = (params: GetPlatformAccountParams) =>
  request<PlatformAccountItem[]>({
    url: '/AdminSystem/api/action/getPlatformAccount',
    method: 'post',
    data: {
      server: 'cashierManager',
      actionName: 'getPlatformAccount',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  getPlatformAccount,
};

