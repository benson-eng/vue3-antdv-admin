import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/marketingEvent.ts（節選）
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export enum EEventType {
  ACCUMULATION = 'accumulation',
  REDEEM = 'redeem',
  RANKING = 'ranking',
  SLOT_GAME = 'slotGame',
  GACHAPON_GAME = 'gachaponGame',
  MAHJONG_BINGO_RACE = 'mahjongBingoRace',
  DAILY_DRAW = 'dailyDraw',
  DAILY_SIGN_IN_GAME = 'dailySignInGame',
}

export interface MarketingEventBase {
  eventID: string;
  eventName: string;
  masterAgent: string;
  eventType?: EEventType | string;
  awardItem?: string;
  extra?: any;
  [k: string]: any;
}

export const queryEventList = (params: { masterAgent: string; eventType?: EEventType }) =>
  request<MarketingEventBase[]>({
    url: '/AdminSystem/api/action/queryEventList',
    method: 'post',
    data: {
      server: 'marketingEventSystem',
      actionName: 'queryEventList',
      query: JSON.stringify(Object.assign({ isSorted: false }, params)),
    },
    timeout: 0,
  });

export enum EAwardType {
  Currency = 0,
  ScratchCard = 1,
  Treasures = 2,
  Token = 3,
}

export interface DailySignInActivitySetting {
  activityID: number;
  masterAgent: string;
  startDateTime: string;
  endDateTime: string;
  status?: string;
  [k: string]: any;
}

export interface DailySignInRewardRecordItem {
  id?: number;
  startDate?: string;
  endDate?: string;
  rewardData: Array<{
    type: EAwardType;
    currencyType?: string;
    balance?: number;
    treasureItemID?: string;
    tokenID?: number;
    amount?: number;
    [k: string]: any;
  }>;
  vipLevel?: number;
  [k: string]: any;
}

export const queryDailySignInActivitySetting = (params: {
  masterAgent: string;
  status: string;
}) =>
  request<DailySignInActivitySetting[]>({
    url: '/AdminSystem/api/action/queryDailySignInActivitySetting',
    method: 'post',
    data: {
      server: 'marketingEventSystem',
      actionName: 'queryDailySignInActivitySetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const queryDailySignInRewardRecord = (params: {
  masterAgent: string;
  activityID: number;
  memberID: string;
}) =>
  request<DailySignInRewardRecordItem[]>({
    url: '/AdminSystem/api/action/queryDailySignInRewardRecord',
    method: 'post',
    data: {
      server: 'marketingEventSystem',
      actionName: 'queryDailySignInRewardRecord',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  EEventType,
  queryEventList,
  EAwardType,
  queryDailySignInActivitySetting,
  queryDailySignInRewardRecord,
};




