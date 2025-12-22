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

export interface ListLevelSettingByMasterAgentParams {
  masterAgent: string;
}

export interface LevelSettingTreasureCardInfo {
  treasureID: string;
  cardName: string;
  cardIcon: string;
  bet: number;
  creditRate: string;
  amount: number;
  /**
   * -1 表示即時啟用；其他值表示幾日後啟用
   */
  startDate: number;
  /**
   * 幾日後過期
   */
  endDate: number;
}

export interface LevelSettingItem {
  id?: number;
  masterAgent: string;
  level: number;
  prizeMoney: number;
  prizeVp: number;
  maxBet: number;
  levelUpNeedPoint: string;
  treasureCardInfos: LevelSettingTreasureCardInfo[];
}

export interface BulkCreateLevelSettingParams {
  settings: LevelSettingItem[];
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

/**
 * 遊戲等級獎勵設定 - 查詢（對齊 Vue2：levelSetting/listByMasterAgent）
 */
export const listByMasterAgent = (params: ListLevelSettingByMasterAgentParams) =>
  request<LevelSettingItem[]>({
    url: '/AdminSystem/api/action/levelSetting-listByMasterAgent',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'levelSetting/listByMasterAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 遊戲等級獎勵設定 - 批次覆蓋儲存（對齊 Vue2：levelSetting/bulkCreate）
 */
export const bulkCreate = (params: BulkCreateLevelSettingParams) =>
  request({
    url: '/AdminSystem/api/action/levelSetting-bulkCreate',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'levelSetting/bulkCreate',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
