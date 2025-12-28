import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export interface QueryTransactionMemberSettingsParams {
  masterAgent: string;
}

export interface TransactionMemberSettingItem {
  id?: string | number;
  memberID: string;
  /**
   * 0 ~ 1（小數）
   * UI 以 % 呈現（0~100）
   */
  serviceTariff: number;
}

export interface SetTransactionMemberSettingParams {
  masterAgent: string;
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
  /**
   * 0 ~ 1（小數）
   */
  serviceTariff: number;
}

export interface RemoveTransactionMemberSettingParams {
  masterAgent: string;
  memberID: string;
}

export const queryTransactionMemberSettings = (params: QueryTransactionMemberSettingsParams) =>
  request<TransactionMemberSettingItem[]>({
    url: '/AdminSystem/api/action/queryTransactionMemberSettings',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'queryTransactionMemberSettings',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setTransactionMemberSetting = (params: SetTransactionMemberSettingParams) =>
  request({
    url: '/AdminSystem/api/action/setTransactionMemberSetting',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'setTransactionMemberSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const removeTransactionMemberSetting = (params: RemoveTransactionMemberSettingParams) =>
  request({
    url: '/AdminSystem/api/action/removeTransactionMemberSetting',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'removeTransactionMemberSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export enum OrderState {
  SUCCESS = 'Success',
  WAIT_RECEIVER_AGREE = 'WaitReceiverAgree',
  WAIT_REMITTER_CONFIRM = 'WaitRemitterConfirm',
  RECOVER = 'Recover',
  EXPIRED = 'Expired',
  CANCEL = 'Cancel',
  ABORTED = 'Aborted',
}

export interface QueryTransactionOrdersParams {
  masterAgent: string;
  remitter?: string;
  receiver?: string;
  searchType: 'coin' | 'item';
}

export interface TransactionOrderItem {
  id: string;
  remitter: string;
  receiver: string;
  remitterNickname?: string;
  receiverNickname?: string;
  remitterVip?: string;
  receiverVip?: string;
  remitterNicknameWhenTransaction?: string | null;
  receiverNicknameWhenTransaction?: string | null;
  currencyType?: string;
  itemType?: string;
  cardName?: string;
  remittances: number;
  serviceFee: number;
  state: OrderState;
  transferAt?: string;
  receivedAt?: string;
  expireTime?: string;
  canceledAt?: string | null;
  recoveredAt?: string | null;
  createdAt?: string;
  searchType?: 'coin' | 'item';
  showType?: string;
  showItemName?: string;
  newCanecelAt?: string | null;
}

export interface QueryTransactionOrdersResult {
  data: {
    orders: TransactionOrderItem[];
  };
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> getTransactionOrders
 */
export const getTransactionOrders = (params: QueryTransactionOrdersParams) =>
  request<QueryTransactionOrdersResult>({
    url: '/AdminSystem/api/action/queryTransactionOrders',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'queryTransactionOrders',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface AbortTransactionParams {
  masterAgent: string;
  orderID: string;
  searchType: 'coin' | 'item';
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> abortTransaction
 */
export const abortTransaction = (params: AbortTransactionParams) =>
  request({
    url: '/AdminSystem/api/action/abortTransaction',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'abortTransaction',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface ValidFrozenStatementItem {
  id: string;
  memberID: string;
  source: string;
  frozenBalance: number;
  frozenAt: string;
  unfrozenAt?: string | null;
  targetAccumulatedBet?: number | null;
  isEnabled?: boolean;
}

export interface GetValidFrozenStatementsParams {
  memberID: string;
}

export interface GetValidFrozenStatementsResult {
  data: ValidFrozenStatementItem[];
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> getValidFrozenStatements
 */
export const getValidFrozenStatements = (params: GetValidFrozenStatementsParams) =>
  request<GetValidFrozenStatementsResult>({
    url: '/AdminSystem/api/action/getValidFrozenStatements',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'getValidFrozenStatements',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface RemoveValidFrozenStatementParams {
  memberID: string;
  statementID: string;
}

export interface RemoveValidFrozenStatementResult {
  result: boolean;
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> removeValidFrozenStatement
 */
export const removeValidFrozenStatement = (params: RemoveValidFrozenStatementParams) =>
  request<RemoveValidFrozenStatementResult>({
    url: '/AdminSystem/api/action/removeValidFrozenStatement',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'removeValidFrozenStatement',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface SafetyBoxOrderItem {
  id: string;
  nickName?: string;
  currencyType: string;
  remittances: number;
  serviceFee: number;
  state: 'Success' | 'Fail';
  transferAt: string;
}

export interface GetSafetyBoxOrderParams {
  memberID: string;
  searchTime?: {
    startTime: Date | string;
    endTime: Date | string;
  };
}

export interface GetSafetyBoxOrderResult {
  data: {
    orders: SafetyBoxOrderItem[];
  };
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> getSafetyBoxOrder
 */
export const getSafetyBoxOrder = (params: GetSafetyBoxOrderParams) =>
  request<GetSafetyBoxOrderResult>({
    url: '/AdminSystem/api/action/getSafetyBoxOrder',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'getSafetyBoxOrder',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * =========================================
 * OTP SMS Template API
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts
 * =========================================
 */

export enum OTPTemplateType {
  BIND_PHONE = 'BindPhone',
  SET_TRANSACTION_PASSWORD = 'SetTransactionPassword',
  TRANSACTION_PASSWORD = 'TransactionPassword',
}

export interface QueryOTPSmsTemplatesParams {
  masterAgent: string;
  type: OTPTemplateType | string;
}

export interface OTPSmsTemplateItem {
  masterAgent: string;
  type: string;
  template: string;
}

export interface QueryOTPSmsTemplatesResult {
  data: OTPSmsTemplateItem[];
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> queryOTPSmsTemplates
 */
export const queryOTPSmsTemplates = (params: QueryOTPSmsTemplatesParams) =>
  request<QueryOTPSmsTemplatesResult>({
    url: '/AdminSystem/api/action/queryOTPSmsTemplates',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'queryOTPSmsTemplates',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface SetOTPSmsTemplateParams {
  masterAgent: string;
  type: OTPTemplateType | string;
  template: string;
}

/**
 * 對齊 Vue2：admin-web/src/api/transactionSystem.ts -> setOTPSmsTemplate
 */
export const setOTPSmsTemplate = (params: SetOTPSmsTemplateParams) =>
  request({
    url: '/AdminSystem/api/action/setOTPSmsTemplate',
    method: 'post',
    data: {
      server: 'transactionSystem',
      actionName: 'setOTPSmsTemplate',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
