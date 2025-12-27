import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/lobbyGameRecordServe.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export enum SpendingType {
  Currency = 'Currency',
  Treasures = 'Treasures',
  Token = 'Token',
}

export type Currency = {
  currencyType: string;
  balance: number;
};

export type TreasureAward = {
  treasureItemID: string;
};

export type Token = {
  tokenID: number;
  amount: number;
};

export type SpendingItem = Currency | TreasureAward | Token;

export interface VipPortalGameRecordColumns {
  id?: number;
  lobbyGameID: string;
  memberID: string;
  vip: number;
  eventID: string;
  spendingType: SpendingType;
  spendingItem: SpendingItem;
  spendingCurrencyType?: string;
  spendingBalance?: number;
  spendingItemID?: string;
  spendingAmount: number;
  spendingItemPackIDs: string[];
  spendingTokenID?: string;
  tenDraws: number;
  gainItem: string;
  gainType: SpendingType;
  gainAward: Currency | TreasureAward;
  gainCurrencyType?: string;
  gainBalance?: number;
  gainItemID?: string;
  gainTokenID?: string;
  gainAmount: number;
  gainDetail: {
    award: any;
    prizeName: string;
    prizeType?: string;
    iconUrl: string;
    description: string;
  };
  debug: boolean;
  roundID: string;
  note?: string;
  playDateTime: Date | string;
  sequence: number;
  masterAgent: string;
  prizeType?: string;
  agentID: string;
}

export interface QueryVipPortalGameRecordParams {
  masterAgent: string;
  agentID?: string;
  memberID?: string;
  eventID?: string;
  spendingItemID?: string;
  spendingCurrencyType?: string;
  spendingBalance?: number;
  gainItemID?: string;
  gainCurrencyType?: string;
  gainBalance?: number;
  vip?: number;
  playDateTime?: { startTime: Date; endTime: Date };
  isMultipleDraw?: boolean;
  spendingTokenID?: string;
  gainTokenID?: string;
}

export interface QueryVipPortalGameRecordResult {
  items: VipPortalGameRecordColumns[];
  count: number;
}

export const queryVipPortalGameRecord = (params: QueryVipPortalGameRecordParams) =>
  request<QueryVipPortalGameRecordResult>({
    url: '/AdminSystem/api/action/queryVipPortalGameRecord',
    method: 'post',
    data: {
      server: 'lobbyGameRecord',
      actionName: 'queryVipPortalGameRecord',
      query: JSON.stringify(params),
    },
  });

