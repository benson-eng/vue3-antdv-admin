import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/suspension.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 *
 * server: accountSystem
 * - getPunishDetail
 * - updatePunishDetail (punishAction: add | update | remove)
 */

export enum EPunishStatus {
  SUSPEND = 'suspend',
  MUTE = 'mute',
  BAN_GIFT = 'ban_gift',
}

export interface UserPunishDetailItem {
  id: number | string;
  memberID: string;
  masterAgent?: string;
  accountID?: string;
  nickName?: string;
  punishReason?: string;
  punishStatus: EPunishStatus | string;
  punishTime?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface GetPunishDetailParams {
  masterAgent: string;
  memberID?: string;
}

export const getPunishDetail = (params: GetPunishDetailParams) =>
  request<UserPunishDetailItem[]>({
    url: '/AdminSystem/api/action/getPunishDetail',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'getPunishDetail',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface AddPunishParams {
  masterAgent: string;
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  punishReason?: string;
  punishStatus: EPunishStatus;
  punishTime?: string;
}

export const addPunish = (params: AddPunishParams) =>
  request({
    url: '/AdminSystem/api/action/updatePunishDetail',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'updatePunishDetail',
      query: JSON.stringify({
        ...params,
        punishAction: 'add',
      }),
    },
    timeout: 0,
  });

export interface UpdatePunishParams {
  id: number;
  punishReason?: string;
  punishStatus: EPunishStatus;
  punishTime?: string;
}

export const updatePunish = (params: UpdatePunishParams) =>
  request({
    url: '/AdminSystem/api/action/updatePunishDetail',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'updatePunishDetail',
      query: JSON.stringify({
        ...params,
        punishAction: 'update',
      }),
    },
    timeout: 0,
  });

export interface DeletePunishParams {
  masterAgent: string;
  id: number | string;
}

export const deletePunish = (params: DeletePunishParams) =>
  request({
    url: '/AdminSystem/api/action/updatePunishDetail',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'updatePunishDetail',
      query: JSON.stringify({
        ...params,
        punishAction: 'remove',
      }),
    },
    timeout: 0,
  });


