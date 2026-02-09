import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/lobbyGameServer.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface LobbyGameInfo {
  ID: number;
  lobbyGameID: string;
  gameName: string;
  descript: string;
}

export interface LobbyGameListResult {
  data: LobbyGameInfo[];
}

export const getLobbyGameList = (): Promise<LobbyGameListResult> =>
  request<LobbyGameListResult>({
    url: '/AdminSystem/api/action/gameList',
    method: 'post',
    data: {
      server: 'lobbyGameServer01',
      actionName: 'gameList',
    },
  });
