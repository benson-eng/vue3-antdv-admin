import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface QueryTransactionMemberSettingsParams {
  masterAgent: string;
}

export interface TransactionMemberSettingItem {
  id?: string | number;
  memberID: string;
  /**
   * 0 ~ 1（小數）
   * UI 以 % 呈現（0~100）
   */
  serviceTariff: number;
}

export interface SetTransactionMemberSettingParams {
  masterAgent: string;
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  /**
   * 0 ~ 1（小數）
   */
  serviceTariff: number;
}

export interface RemoveTransactionMemberSettingParams {
  masterAgent: string;
  memberID: string;
}

export const queryTransactionMemberSettings = (params: QueryTransactionMemberSettingsParams) =>
  request<TransactionMemberSettingItem[]>({
    url: '/AdminSystem/api/action/queryTransactionMemberSettings',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'queryTransactionMemberSettings',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setTransactionMemberSetting = (params: SetTransactionMemberSettingParams) =>
  request({
    url: '/AdminSystem/api/action/setTransactionMemberSetting',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'setTransactionMemberSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const removeTransactionMemberSetting = (params: RemoveTransactionMemberSettingParams) =>
  request({
    url: '/AdminSystem/api/action/removeTransactionMemberSetting',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'removeTransactionMemberSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

