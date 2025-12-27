import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/redemption-order.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export enum RewardType {
  BALANCE = 1,
  TREASURE_ITEM = 2,
}

export interface BalanceReward {
  type: RewardType.BALANCE;
  currencyType: string;
  balance: number;
}

export interface TreasureItemReward {
  type: RewardType.TREASURE_ITEM;
  treasureItemID: string;
  itemName: string;
  iconUrl: string;
  amount: number;
}

export type Reward = BalanceReward | TreasureItemReward;

export enum OrderStatus {
  PROCESSING = 'PROCESSING',
  AVAILABLE = 'AVAILABLE',
}

export interface RedemptionOrder {
  id: number;
  masterAgent: string;
  name: string;
  rewards: Reward[];
  codeCount: number;
  codePrefix: string;
  createdAt: Date;
  status: OrderStatus;
  enabled: boolean;
  updatedAt?: Date;
  removedAt?: Date;
  type?: number; // 1: 一碼一次, 2: 一碼多次
}

export interface RedemptionRecord {
  id: number;
  orderID: number;
  masterAgent: string;
  memberID: string;
  redemptionCode: string;
  redeemedTime: Date;
  createdAt: Date;
  order: RedemptionOrder;
  Nickname?: string;
  type?: string;
  orderName?: string;
  rewards?: string[];
}

export enum CodeState {
  AVAILABLE = 'AVAILABLE',
  REMOVED = 'REMOVED',
  USED = 'USED',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface QueryRedemptionRecordsParams {
  masterAgent: string;
  memberID: string;
}

export interface QueryRedemptionRecordsResult {
  records: RedemptionRecord[];
}

export const queryRedemptionRecords = (params: QueryRedemptionRecordsParams) =>
  request<QueryRedemptionRecordsResult>({
    url: '/AdminSystem/api/action/queryRedemptionRecords',
    method: 'post',
    data: {
      server: 'redemptionSystem',
      actionName: 'queryRedemptionRecords',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface ValidateRedemptionCodeParams {
  redemptionCode: string;
}

export interface ValidateRedemptionCodeResult {
  state: CodeState;
}

export const validateRedemptionCode = (params: ValidateRedemptionCodeParams) =>
  request<ValidateRedemptionCodeResult>({
    url: '/AdminSystem/api/action/validateRedemptionCode',
    method: 'post',
    data: {
      server: 'redemptionSystem',
      actionName: 'validateRedemptionCode',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

