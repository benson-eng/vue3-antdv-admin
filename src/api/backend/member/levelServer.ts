import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/levelServer.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface MemberLevelInfoParams {
  /**
   * `${account}@${agentID}`
   */
  memberID: string[];
}

export interface MemberLevelInfoItem {
  memberID?: string;
  level: number;
}

export interface SetMemberLevelParams {
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  level: number;
}

/**
 * 查詢遊戲等級
 */
export const getMemberLevelInfo = (params: MemberLevelInfoParams) =>
  request<MemberLevelInfoItem[]>({
    // Vue2 既有路徑：/AdminSystem/api/action/memberLevel-getByMemberIDList
    url: '/AdminSystem/api/action/memberLevel-getByMemberIDList',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'memberLevel/getByMemberIDList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 設定會員遊戲等級
 */
export const setMemberLevel = (params: SetMemberLevelParams) =>
  request({
    // Vue2 既有路徑：/AdminSystem/api/action/control-setMemberLevel
    url: '/AdminSystem/api/action/control-setMemberLevel',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'control/setMemberLevel',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
