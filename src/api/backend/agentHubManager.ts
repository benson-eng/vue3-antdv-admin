import { request } from '@/utils/request';

/**
 * =========================================
 * Agent Hub Manager API
 * 來源：admin-web/src/api/agentHubManager.ts（Vue2）
 * =========================================
 */

export interface GetStationMastersParams {
  name?: string; // masterAgent
}

export interface StationMasterItem {
  name: string;
  value?: string;
  [key: string]: any;
}

export interface GetStationMastersResponse {
  result: boolean;
  value?: StationMasterItem[];
}

/**
 * 取得站台主清單
 * 後端：POST /AdminSystem/api/action/getStationMasters
 */
export const getStationMasters = (params: GetStationMastersParams = {}) =>
  request<GetStationMastersResponse>({
    url: '/AdminSystem/api/action/getStationMasters',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'getStationMasters',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface QueryStationMasterParams {
  name: string; // masterAgent
}

export interface QueryStationMasterResponse {
  result: boolean;
  value?: StationMasterItem;
}

/**
 * 查詢站台主
 * 後端：POST /AdminSystem/api/action/queryStationMaster
 */
export const queryStationMaster = (params: QueryStationMasterParams) =>
  request<QueryStationMasterResponse>({
    url: '/AdminSystem/api/action/queryStationMaster',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'queryStationMaster',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface QueryAgentParams {
  stationMasterName: string;
  name: string; // agent name
}

export interface QueryAgentResponse {
  result: boolean;
  value?: StationMasterItem;
}

/**
 * 查詢代理
 * 後端：POST /AdminSystem/api/action/queryAgent
 */
export const queryAgent = (params: QueryAgentParams) =>
  request<QueryAgentResponse>({
    url: '/AdminSystem/api/action/queryAgent',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'queryAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

