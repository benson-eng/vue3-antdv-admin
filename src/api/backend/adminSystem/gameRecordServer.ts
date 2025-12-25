import { request } from '@/utils/request';

/**
 * AdminSystem / gameRecordReader
 * 來源：admin-web/src/api/gameRecordServer.ts（Vue2）
 */

export interface IGameRecord {
  id: number;
  roundID: string;
  memberID: string;
  agentID: string;
  gameID: string;
  seatID: number;
  roundCount: number;
  totalBet: string;
  totalWin: string;
  winLost: string;
  beforeBalance: string;
  afterBalance: string;
  transactionID: string;
  winType: string;
  debug: boolean;
  gameInfo: string;
  playDateTime: Date;
  currencyType: string;
  gameType: string;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
  creditRate?: number | string;
  gameLobby?: {
    name: string | { default?: string; tw?: string };
    lobbyID: string;
  };
  scratchCardInfo?: {
    scratchCardID: string;
  };
  lobbyName?: string;
  lobbyID?: string;
  scratchCardID?: string;
  playback?: string;
}

export interface IGrandPrizeRecordsColumn {
  id: number;
  memberID: string;
  lobbyID: string;
  lobbyName?: string;
  masterAgent: string;
  gameID: string;
  totalBet: number;
  totalWin: number;
  odds: number;
  seatID: number;
  playDateTime: Date;
  isFavorite: boolean;
  createdAt: Date;
}

export interface IQueryGameRecordParams {
  agentID?: string;
  memberID?: string;
  account?: string;
  accountID?: string;
  gameID?: string;
  winType?: string;
  roundID?: string;
  date?: [Date, Date];
  page?: number;
  limit?: number;
  isShowDebug?: boolean;
}

export interface IQueryGameRecordResponse {
  data: {
    items: IGameRecord[];
    total: number;
  };
}

export interface IQueryGrandPrizeRecordParams {
  masterAgent: string;
  memberID?: string;
  gameID?: string;
  seatID?: string;
  date?: [Date, Date];
  page: number;
  limit: number;
}

export interface IQueryGrandPrizeRecordResponse {
  data: {
    items: IGrandPrizeRecordsColumn[];
    total?: number;
  };
}

export interface IGetPlaybackParams {
  roundID: string;
}

export interface IGetPlaybackResponse {
  data: any;
}

export interface IQueryGameAwardParams {
  agentID?: string;
  memberID?: string;
  account?: string;
  accountID?: string;
  gameID?: string;
  gameType?: string;
  winType?: string[];
  date?: [Date, Date];
  page?: number;
  limit?: number;
}

export interface IQueryGameAwardResponse {
  data: {
    items: IGameRecord[];
    total: number;
  };
}

/**
 * 查詢遊戲紀錄
 */
export const getGameRecord = (params: IQueryGameRecordParams) =>
  request<IQueryGameRecordResponse>({
    url: '/AdminSystem/api/action/queryGameRecord',
    method: 'post',
    data: {
      server: 'gameRecordReader',
      actionName: 'queryGameRecord',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 查詢遊戲彩金紀錄
 */
export const queryGameAward = (params: IQueryGameAwardParams) =>
  request<IQueryGameAwardResponse>({
    url: '/AdminSystem/api/action/queryGameAward',
    method: 'post',
    data: {
      server: 'gameRecordReader',
      actionName: 'queryGameAward',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 獲取遊戲回放
 */
export const getPlayback = (params: IGetPlaybackParams) =>
  request<IGetPlaybackResponse>({
    url: '/AdminSystem/api/action/getPlayback',
    method: 'post',
    data: {
      server: 'gameRecordReader',
      actionName: 'getPlayback',
      query: JSON.stringify(params),
    },
    timeout: 30 * 1000,
  });

/**
 * 查詢大獎紀錄
 */
export const queryGrandPrizeRecord = (params: IQueryGrandPrizeRecordParams) =>
  request<IQueryGrandPrizeRecordResponse>({
    url: '/AdminSystem/api/action/queryGrandPrizeRecord',
    method: 'post',
    data: {
      server: 'gameRecordReader',
      actionName: 'queryGrandPrizeRecord',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  getGameRecord,
  getPlayback,
  queryGrandPrizeRecord,
  queryGameAward,
};

