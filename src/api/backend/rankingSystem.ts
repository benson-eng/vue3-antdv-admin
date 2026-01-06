import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/rankingSystem.ts（節選）
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface AddRaceRankBlackParams {
  masterAgent: string;
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  eventID: string;
  note: string;
}

export interface BooleanResult {
  result: boolean;
}

export interface RaceRankBlackQueryParams {
  masterAgent: string;
  eventID: string;
}

export interface RaceRankBlackItem {
  eventID: string;
  memberID: string;
  note?: any;
  [k: string]: any;
}

export interface RaceRankUnBlackParams {
  masterAgent: string;
  memberID: string;
  eventID: string;
}

export interface RaceRankSettlementQueryParams {
  masterAgent: string;
  eventID: string;
}

// 比賽排行榜黑名單新增
export const addRaceRankBlack = (params: AddRaceRankBlackParams) =>
  request<BooleanResult>({
    url: '/AdminSystem/api/action/raceRankBlack',
    method: 'post',
    data: {
      server: 'rankingSystem',
      actionName: 'raceRankBlack',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// 比賽排行榜黑名單列表查詢
export const raceRankBlackQuery = (params: RaceRankBlackQueryParams) =>
  request<RaceRankBlackItem[]>({
    url: '/AdminSystem/api/action/raceRankBlackQuery',
    method: 'post',
    data: {
      server: 'rankingSystem',
      actionName: 'raceRankBlackQuery',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// 比賽排行榜解除黑名單
export const raceRankUnBlack = (params: RaceRankUnBlackParams) =>
  request<BooleanResult>({
    url: '/AdminSystem/api/action/raceRankUnBlack',
    method: 'post',
    data: {
      server: 'rankingSystem',
      actionName: 'raceRankUnBlack',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// 比賽排行榜是否已結算查詢
export const raceRankSettlementQuery = (params: RaceRankSettlementQueryParams) =>
  request<BooleanResult>({
    url: '/AdminSystem/api/action/raceRankSettlementQuery',
    method: 'post',
    data: {
      server: 'rankingSystem',
      actionName: 'raceRankSettlementQuery',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  addRaceRankBlack,
  raceRankBlackQuery,
  raceRankUnBlack,
  raceRankSettlementQuery,
};




