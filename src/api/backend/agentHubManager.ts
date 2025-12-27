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

export interface ISettings {
  stationMasterName: string;
  name: string;
  type: string;
  subType: string;
  description: string;
  percentage: number;
  agentName?: string;
}

export interface EditAgentSettingsParams {
  settings: ISettings[];
}

export interface EditAgentSettingsResponse {
  result: boolean;
}

/**
 * 編輯代理設定
 * 後端：POST /AdminSystem/api/action/editAgentSettings
 */
export const editAgentSettings = (params: EditAgentSettingsParams) =>
  request<EditAgentSettingsResponse>({
    url: '/AdminSystem/api/action/editAgentSettings',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'editAgentSettings',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface DeleteAgentParams {
  stationMasterName: string;
  name: string;
}

export interface DeleteAgentResponse {
  result: boolean;
}

/**
 * 刪除代理
 * 後端：POST /AdminSystem/api/action/deleteAgent
 */
export const deleteAgent = (params: DeleteAgentParams) =>
  request<DeleteAgentResponse>({
    url: '/AdminSystem/api/action/deleteAgent',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'deleteAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface SetDefaultAgentParams {
  stationMasterName: string;
  name: string;
}

export interface SetDefaultAgentResponse {
  result: boolean;
}

/**
 * 設定預設代理
 * 後端：POST /AdminSystem/api/action/setDefaultAgent
 */
export const setDefaultAgent = (params: SetDefaultAgentParams) =>
  request<SetDefaultAgentResponse>({
    url: '/AdminSystem/api/action/setDefaultAgent',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'setDefaultAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface EnableAgentParams {
  stationMasterName: string;
  name: string;
  enable: boolean;
}

export interface EnableAgentResponse {
  result: boolean;
}

/**
 * 啟用/停用代理
 * 後端：POST /AdminSystem/api/action/enableAgent
 */
export const enableAgent = (params: EnableAgentParams) =>
  request<EnableAgentResponse>({
    url: '/AdminSystem/api/action/enableAgent',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'enableAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface QueryShortUrlsParams {
  agentId?: number;
  unionId?: number;
  includeDisabled: boolean;
}

export interface ShortUrlItem {
  id: number;
  shortUrl: string;
  title: string;
  enabled: boolean;
  clickCount: number;
}

export interface QueryShortUrlsResponse {
  result: boolean;
  value?: ShortUrlItem[];
}

/**
 * 查詢短網址
 * 後端：POST /AdminSystem/api/action/queryShortUrls
 */
export const queryShortUrls = (params: QueryShortUrlsParams) =>
  request<QueryShortUrlsResponse>({
    url: '/AdminSystem/api/action/queryShortUrls',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'queryShortUrls',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface CreateShortUrlParams {
  agentId?: number;
  unionId?: number;
  title: string;
  targetUrl: string;
  disableOthers?: boolean;
}

export interface CreateShortUrlResponse {
  result: boolean;
  value?: ShortUrlItem;
}

/**
 * 建立短網址
 * 後端：POST /AdminSystem/api/action/createShortUrl
 */
export const createShortUrl = (params: CreateShortUrlParams) =>
  request<CreateShortUrlResponse>({
    url: '/AdminSystem/api/action/createShortUrl',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'createShortUrl',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface ToggleShortUrlStatusParams {
  id: number;
  enabled: boolean;
}

export interface ToggleShortUrlStatusResponse {
  result: boolean;
}

/**
 * 切換短網址狀態
 * 後端：POST /AdminSystem/api/action/toggleShortUrlStatus
 */
export const toggleShortUrlStatus = (params: ToggleShortUrlStatusParams) =>
  request<ToggleShortUrlStatusResponse>({
    url: '/AdminSystem/api/action/toggleShortUrlStatus',
    method: 'post',
    data: {
      server: 'agentHubManager',
      actionName: 'toggleShortUrlStatus',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

