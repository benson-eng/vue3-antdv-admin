import { request } from '@/utils/request';

/**
 * AdminSystem / gameManager
 * 來源：admin-web/src/api/gameManagerServer.ts（Vue2）
 */

export interface GameInfo {
  gameID: string;
  gameName: string;
  gameType?: string;
  isExternalGame?: boolean;
  race?: boolean;
  language?: {
    tw?: string;
    cn?: string;
    en?: string;
    vi?: string;
    [k: string]: any;
  };
  gameData?: Record<string, any>;
  [k: string]: any;
}

export const isExternalGame = (gameID: string): boolean => Number(gameID) > 10000;

export const globalGameList = () =>
  request<GameInfo[]>({
    url: '/AdminSystem/api/action/globalGameList',
    method: 'post',
    data: {
      server: 'gameManager',
      actionName: 'globalGameList',
      query: JSON.stringify({ includeExternalGame: true }),
    },
    timeout: 0,
  });

export const gameList = (params: { masterAgent: string; agent?: string }) =>
  request<GameInfo[]>({
    url: '/AdminSystem/api/action/gameList',
    method: 'post',
    data: {
      server: 'gameManager',
      actionName: 'gameList',
      query: JSON.stringify({ ...params, includeExternalGame: true }),
    },
    timeout: 0,
  });

export const getGameIDList = (params: { masterAgent: string /* agent?: string */ }) =>
  request<string[] | null>({
    url: '/AdminSystem/api/action/getGameIDList',
    method: 'post',
    data: {
      server: 'gameManager',
      actionName: 'getGameIDList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setGameIDList = (params: { masterAgent: string; gameIDList: string[] /* agent?: string */ }) =>
  request<boolean>({
    url: '/AdminSystem/api/action/setGameIDList',
    method: 'post',
    data: {
      server: 'gameManager',
      actionName: 'setGameIDList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface IGetGamePlayerListRes {
  data: {
    gamePlayerList?: Record<string, string[]>;
    [masterAgent: string]: {
      gamePlayerList: Record<string, string[]>;
    } | Record<string, string[]> | undefined;
  };
}

export const getGamePlayerList = (params: { masterAgent: string; agent?: string }) =>
  request<IGetGamePlayerListRes>({
    url: '/AdminSystem/api/action/getGamePlayerList',
    method: 'post',
    data: {
      server: 'gameManager',
      actionName: 'getGamePlayerList',
      query: JSON.stringify(params),
    },
  });

export const getGamePlayerLists = (params: { masterAgents: string[]; agent?: string }) =>
  request<IGetGamePlayerListRes>({
    url: '/AdminSystem/api/action/getGamePlayerLists',
    method: 'post',
    data: {
      server: 'gameManager',
      actionName: 'getGamePlayerLists',
      query: JSON.stringify(params),
    },
  });

export default {
  isExternalGame,
  globalGameList,
  gameList,
  getGameIDList,
  setGameIDList,
  getGamePlayerList,
  getGamePlayerLists,
};




