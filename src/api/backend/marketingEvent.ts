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

export default {
  EEventType,
  queryEventList,
};



