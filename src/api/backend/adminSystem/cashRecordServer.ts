import { request } from '@/utils/request';

/**
 * AdminSystem / cashServer
 * 來源：admin-web/src/api/cashRecordServer.ts（Vue2）
 */

export interface ICashRecord {
  remitno: string;
  memberID: string;
  deposit: number;
  withdrawal: number;
  afterBalance: number;
  beforeBalance: number;
  type: string;
  subType: string;
  note: string;
  currency: string;
  transactionTime: Date;
  agentID: string;
  source: string;
  sourceStatus: string;
}

export interface IStaticsCashRecord {
  memberID: string;
  deposit: number;
  withdrawal: number;
  currency: string;
}

export interface IQueryCashRecordParams {
  page: number;
  limit: number;
  note?: string;
  agentID?: string;
  account?: string;
  accountID?: string;
  date?: [Date, Date];
  type?: string;
  subType?: string;
  source?: string;
  sourceStatus?: string;
  remitno?: string;
  currency?: string;
  memberID?: string;
}

export interface IQueryCashRecordResponse {
  data: {
    items: ICashRecord[];
    total: number;
  };
}

/**
 * 查詢金錢紀錄
 */
export const queryCashRecord = (params: IQueryCashRecordParams) =>
  request<IQueryCashRecordResponse>({
    url: '/AdminSystem/api/action/queryCashRecord',
    method: 'post',
    data: {
      server: 'cashServer',
      actionName: 'queryCashRecord',
      query: JSON.stringify(params),
    },
    timeout: 30 * 1000,
  });

export interface IQueryStaticsCashRecordParams {
  [key: string]: any;
}

export interface IQueryStaticsCashRecordResponse {
  data: {
    items: IStaticsCashRecord[];
    total: number;
  };
}

/**
 * 查詢統計金錢紀錄
 */
export const queryStaticsCashRecord = (params: IQueryStaticsCashRecordParams) =>
  request<IQueryStaticsCashRecordResponse>({
    url: '/AdminSystem/api/action/queryStaticsCashRecord',
    method: 'post',
    data: {
      server: 'cashServer',
      actionName: 'queryStaticsCashRecord',
      query: JSON.stringify(params),
    },
    timeout: 30 * 1000,
  });

export interface IGetBalanceRes {
  data: Array<{
    balance: string;
    currencyType: string;
  }>;
}

export interface IQueryBalanceParams {
  [key: string]: any;
}

/**
 * 查詢餘額
 */
export const queryBalance = (params: IQueryBalanceParams) =>
  request<IGetBalanceRes>({
    url: '/AdminSystem/api/action/queryBalance',
    method: 'post',
    data: {
      server: 'cashServer',
      actionName: 'queryBalance',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface IQueryAccumulationRes {
  data: Array<{
    memberID: string;
    balance: number;
    accumulationDeposit: string;
    accumulationWithdrawal: string;
    currencyType: string;
  }>;
}

export interface IQueryAccumulationParams {
  [key: string]: any;
}

/**
 * 查詢累積資料
 */
export const queryAccumulation = (params: IQueryAccumulationParams) =>
  request<IQueryAccumulationRes>({
    url: '/AdminSystem/api/action/queryAccumulation',
    method: 'post',
    data: {
      server: 'cashServer',
      actionName: 'queryAccumulation',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface IQueryAllUserCurrenciesParams {
  agentID: string;
  currencyType: string;
}

export interface IQueryAllUserCurrenciesRes {
  data: Array<{
    memberID: string;
    currency: string;
    balance: number;
  }>;
}

/**
 * 查詢所有用戶幣別
 */
export const queryAllUserCurrencies = (params: IQueryAllUserCurrenciesParams) =>
  request<IQueryAllUserCurrenciesRes>({
    url: '/AdminSystem/api/action/queryAllUserCurrencies',
    method: 'post',
    data: {
      server: 'cashServer',
      actionName: 'queryAllUserCurrencies',
      query: JSON.stringify(params),
    },
  });

export interface IMemberWalletsParams {
  memberID: string;
}

/**
 * 查詢會員多幣別錢包
 */
export const memberWallets = (params: IMemberWalletsParams) =>
  request({
    url: '/AdminSystem/api/action/memberWallets',
    method: 'post',
    data: {
      server: 'cashServer',
      actionName: 'memberWallets',
      query: JSON.stringify(params),
    },
  });

export default {
  queryCashRecord,
  queryStaticsCashRecord,
  queryBalance,
  queryAccumulation,
  queryAllUserCurrencies,
  memberWallets,
};

