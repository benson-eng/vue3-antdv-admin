import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/activitySystem.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export enum IdentityType {
  NORMAL = 1, // 普通玩家
  FRAUDULENT_OR_REFUND = 2, // 退刷 or 退款
  LOW_CREDIBILITY = 3, // 低信譽（懲罰商家）
  NEWBIE = 4, // 新手
  FIXED = 5, // 被固定活躍值
}

export interface QueryMemberIdentitiesParams {
  masterAgent: string;
}

export interface MemberIdentityItem {
  id?: string | number;
  memberID: string;
  identity: IdentityType | number;
}

export interface SetMemberIdentityParams {
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  type: IdentityType;
}

export interface RemoveMemberIdentityParams {
  memberID: string;
  identity: number;
}

export interface GetMemberActivityParams {
  memberID: string;
}

export interface GetMemberActivityResult {
  memberID: string;
  activity?: number;
  identity: IdentityType | number;
}

export interface QueryFixedMemberActivitiesParams {
  masterAgent: string;
}

export interface FixedMemberActivityItem {
  id?: string | number;
  memberID: string;
  activity: number;
}

export interface FixMemberActivityParams {
  memberID: string;
  activity: number;
}

export interface CancelFixedMemberActivityParams {
  memberID: string;
}

export const queryMemberIdentities = (params: QueryMemberIdentitiesParams) =>
  request<MemberIdentityItem[]>({
    url: '/AdminSystem/api/action/queryMemberIdentities',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'queryMemberIdentities',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setMemberIdentity = (params: SetMemberIdentityParams) =>
  request({
    url: '/AdminSystem/api/action/setMemberIdentity',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'setMemberIdentity',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const removeMemberIdentity = (params: RemoveMemberIdentityParams) =>
  request({
    url: '/AdminSystem/api/action/removeMemberIdentity',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'removeMemberIdentity',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const getMemberActivity = (params: GetMemberActivityParams) =>
  request<GetMemberActivityResult>({
    url: '/AdminSystem/api/action/getMemberActivity',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'getMemberActivity',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const queryFixedMemberActivities = (params: QueryFixedMemberActivitiesParams) =>
  request<FixedMemberActivityItem[]>({
    url: '/AdminSystem/api/action/queryFixedMemberActivities',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'queryFixedMemberActivities',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const fixMemberActivity = (params: FixMemberActivityParams) =>
  request({
    url: '/AdminSystem/api/action/fixMemberActivity',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'fixMemberActivity',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const cancelFixedMemberActivity = (params: CancelFixedMemberActivityParams) =>
  request({
    url: '/AdminSystem/api/action/cancelFixedMemberActivity',
    method: 'post',
    data: {
      server: 'activitySystem',
      actionName: 'cancelFixedMemberActivity',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  queryMemberIdentities,
  setMemberIdentity,
  removeMemberIdentity,
  getMemberActivity,
  queryFixedMemberActivities,
  fixMemberActivity,
  cancelFixedMemberActivity,
};
