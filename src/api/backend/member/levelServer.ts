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
 * =========================================================
 * Vue2：admin-web/src/api/levelServer.ts - levelExtraSetting
 * =========================================================
 */

export interface ListLevelExtraSettingByMasterAgentParams {
  masterAgent: string;
}

/**
 * 遊戲大廳設定（levelExtraSetting/listByMasterAgent）
 */
export interface LevelExtraSettingItem {
  id: number;
  masterAgent?: string;
  gameID: string;
  levelLock: number;
  vipLock?: number;
  levelUp: 0 | 1;
  prizeItems: 0 | 1;
  tag: 0 | 1 | 2;
  sort: number;
  clientSwitch: boolean;
  [k: string]: any;
}

export interface CreateLevelExtraSettingParams {
  masterAgent: string;
  gameIDs: string[];
}

export interface UpdateLevelExtraSettingRow {
  id: number;
  gameID: string;
  levelUp: 0 | 1;
  levelLock: number;
  vipLock?: number;
  prizeItems: 0 | 1;
  tag: 0 | 1 | 2;
  sort: number;
  clientSwitch: boolean;
}

export interface UpdateLevelExtraSettingParams {
  masterAgent: string;
  gameIDs: UpdateLevelExtraSettingRow[];
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

/**
 * 取得遊戲大廳設定（對齊 Vue2：levelExtraSetting/listByMasterAgent）
 */
export const listLevelExtraSettingByMasterAgent = (params: ListLevelExtraSettingByMasterAgentParams) =>
  request<LevelExtraSettingItem[]>({
    url: '/AdminSystem/api/action/levelExtraSetting',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'levelExtraSetting/listByMasterAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 新增遊戲大廳設定（缺少的 gameID 由後端補預設值；對齊 Vue2：levelExtraSetting/create）
 */
export const createLevelExtraSetting = (params: CreateLevelExtraSettingParams) =>
  request({
    url: '/AdminSystem/api/action/levelExtraSetting',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'levelExtraSetting/create',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 更新遊戲大廳設定（對齊 Vue2：levelExtraSetting/update）
 */
export const updateLevelExtraSetting = (params: UpdateLevelExtraSettingParams) =>
  request({
    url: '/AdminSystem/api/action/levelExtraSetting',
    method: 'post',
    data: {
      server: 'levelServer',
      actionName: 'levelExtraSetting/update',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

