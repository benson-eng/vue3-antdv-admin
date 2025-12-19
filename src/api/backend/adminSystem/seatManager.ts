import { request } from '@/utils/request';

/**
 * AdminSystem / gameSeatManager
 * 來源：admin-web/src/api/seatManager.ts（Vue2）
 */

export type SeatManagerLobbyName = {
  default?: string;
  tw?: string;
  cn?: string;
  en?: string;
  vi?: string;
  [k: string]: any;
};

export type SeatManagerLobby = {
  name: SeatManagerLobbyName | string;
  lobbyInfo?: { description?: string; [k: string]: any };
  vipOnly?: number;
  machinePerLobby: number;
  reservedTime?: Record<string, number>;
  creditRate: number;
  randomSeat?: boolean;
  [k: string]: any;
};

export type SeatManagerSetting = {
  id: string;
  shareholder: string;
  gameID: string;
  name: string;
  machinesPerZone: number;
  lobbyList: SeatManagerLobby[];
  updatedAt?: string;
  [k: string]: any;
};

export type QuerySeatManagerSettingsResult = {
  settings: SeatManagerSetting[];
  meta?: any;
  [k: string]: any;
};

export const querySeatManagerSettings = (data: {
  shareholder?: string;
  page?: number;
  pageSize?: number;
}) =>
  request<QuerySeatManagerSettingsResult>({
    url: '/AdminSystem/api/action/querySeatManagerSettings',
    method: 'post',
    data: {
      server: 'gameSeatManager',
      actionName: 'querySeatManagerSettings',
      query: JSON.stringify(data),
    },
    timeout: 0,
  });

export const createSeatManagerSettings = (data: {
  shareholder: string;
  gameID: string;
  name: string;
  lobbyList: SeatManagerLobby[];
  defaultReservationTtl?: number;
  machinesPerZone: number;
}) =>
  request<any>({
    url: '/AdminSystem/api/action/createSeatManagerSettings',
    method: 'post',
    data: {
      server: 'gameSeatManager',
      actionName: 'createSeatManagerSettings',
      query: JSON.stringify(data),
    },
    timeout: 0,
  });

export const updateSeatManagerSettings = (data: {
  id?: string;
  shareholder: string;
  gameID: string;
  name: string;
  lobbyList: SeatManagerLobby[];
  defaultReservationTtl?: number;
  machinesPerZone: number;
}) =>
  request<any>({
    url: '/AdminSystem/api/action/updateSeatManagerSettings',
    method: 'post',
    data: {
      server: 'gameSeatManager',
      actionName: 'updateSeatManagerSettings',
      query: JSON.stringify(data),
    },
    timeout: 0,
  });

export const deleteSeatManagerSettings = (data: { id: string; shareholder: string }) =>
  request<any>({
    url: '/AdminSystem/api/action/deleteSeatManagerSettings',
    method: 'post',
    data: {
      server: 'gameSeatManager',
      actionName: 'deleteSeatManagerSettings',
      query: JSON.stringify(data),
    },
    timeout: 0,
  });

export default {
  querySeatManagerSettings,
  createSeatManagerSettings,
  updateSeatManagerSettings,
  deleteSeatManagerSettings,
};

