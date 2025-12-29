import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/guildServer.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface ILevelSetting {
  id?: number;
  masterAgent: string;
  level: string;
  levelName: string;
  maxCounts: number;
  guildAccumulationFund: string | null;
  betFee: string;
  topUpFee: string;
  gameWinLoseFee: string;
}

export interface GuildCreateSettingResult {
  createNeedCostCoins: string;
  user: string;
}

export interface GuildLevelsSettingItem {
  id: number;
  level: number;
  levelName: string;
  maxCounts: number;
  guildAccumulationFund: number | null;
  betFee: number;
  topUpFee: number;
  gameWinLoseFee: number;
}

export const queryGuildCreateSetting = (params: { masterAgent: string }) =>
  request<{ result: GuildCreateSettingResult }>({
    url: '/AdminSystem/api/action/queryGuildCreateSetting',
    method: 'post',
    data: {
      server: 'guildServer',
      actionName: 'queryGuildCreateSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setGuildCreateSetting = (params: {
  masterAgent: string;
  user: string;
  createNeedCostCoins: string;
}) =>
  request<unknown>({
    url: '/AdminSystem/api/action/setGuildCreateSetting',
    method: 'post',
    data: {
      server: 'guildServer',
      actionName: 'setGuildCreateSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const queryGuildLevelsSetting = (params: {
  masterAgent: string;
  level?: string;
}) =>
  request<{ result: GuildLevelsSettingItem[] }>({
    url: '/AdminSystem/api/action/queryGuildLevelsSetting',
    method: 'post',
    data: {
      server: 'guildServer',
      actionName: 'queryGuildLevelsSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setGuildLevelsSetting = (params: { settings: ILevelSetting[] }) =>
  request<unknown>({
    url: '/AdminSystem/api/action/setGuildLevelsSetting',
    method: 'post',
    data: {
      server: 'guildServer',
      actionName: 'setGuildLevelsSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const deleteGuildLevelsSetting = (params: { ids: number[] }) =>
  request<unknown>({
    url: '/AdminSystem/api/action/deleteGuildLevelsSetting',
    method: 'post',
    data: {
      server: 'guildServer',
      actionName: 'deleteGuildLevelsSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

