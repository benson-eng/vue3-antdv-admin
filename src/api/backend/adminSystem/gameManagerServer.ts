import { request } from '@/utils/request';

/**
 * AdminSystem / gameManager
 * 來源：admin-web/src/api/gameManagerServer.ts（Vue2）
 */

export type GameInfo = {
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
};

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

export default {
  isExternalGame,
  globalGameList,
};
