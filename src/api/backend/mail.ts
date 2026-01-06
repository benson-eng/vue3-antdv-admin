import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/mail.ts（節選）
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export enum EMailActionTypes {
  DO_NOTHING = 0,
  EXCHANGE = 1,
  OPEN_INTERNAL_WINDOW = 2,
  REDIRECT = 3,
  REDIRECT_URL = 4,
}

export enum EMailExchangeContentTypes {
  BALANCE = 1,
  ITEM = 2,
  TOKEN = 4,
}

export enum EMailDisplays {
  COMMON = 1,
  SOLID = 2,
}

export enum EMailTypes {
  MAIL = 1,
  GLOBAL_MAIL = 2,
}

export enum EMailStatus {
  DISABLE = 0,
  ENABLED = 1,
  READ = 2,
  REMOVE = 3,
  EXPIRED = 4,
  EXCEEDED_QUOTA = 5,
}

export interface MailBalanceExchangeContent {
  contentType: EMailExchangeContentTypes.BALANCE;
  currency: string;
  balance: number;
  isFreeBalance?: boolean;
}

export interface MailTokenExchangeContent {
  contentType: EMailExchangeContentTypes.TOKEN;
  tokenID: string;
  amount: number;
}

export interface MailItemExchangeContent {
  contentType: EMailExchangeContentTypes.ITEM;
  treasureItemID: string;
  amount: number;
  expiredInMS?: number;
  availableInMS?: number;
  vip?: number;
}

export type MailExchangeContent = MailBalanceExchangeContent | MailItemExchangeContent | MailTokenExchangeContent;

interface ExchangeMailAction {
  type: EMailActionTypes.EXCHANGE;
  contents: MailExchangeContent[];
}

interface OpenWindowMailAction {
  type: EMailActionTypes.OPEN_INTERNAL_WINDOW;
  text: string;
}

export interface DoNothingMailAction {
  type: EMailActionTypes.DO_NOTHING;
}

export interface IRedirectMailAction {
  type: EMailActionTypes.REDIRECT;
  location: string;
}

export interface IRedirectUrlAction {
  type: EMailActionTypes.REDIRECT_URL;
  url: string;
}

export type MailAction = ExchangeMailAction | OpenWindowMailAction | DoNothingMailAction | IRedirectMailAction | IRedirectUrlAction;

export interface MemberMailRecord {
  id?: string;
  iconUrl?: string;
  title: string;
  content?: string;
  mailAction: MailAction | string[];
  arrivalTime?: string | Date;
  sender?: string;
  Nickname?: string;
  status: EMailStatus;
  [key: string]: any;
}

export interface QueryMemberMailRecordsParams {
  masterAgent: string;
  memberID: string;
  mailID?: string;
  mailTitle?: string;
  mailStatus?: EMailStatus;
  arrivalTime?: {
    startTime: Date | string;
    endTime: Date | string;
  };
}

/**
 * 查詢會員郵件記錄
 */
export const queryMemberMailRecords = async (params: QueryMemberMailRecordsParams) => {
  return request<MemberMailRecord[]>({
    url: '/AdminSystem/api/action/queryMemberMailRecords',
    method: 'post',
    data: {
      server: 'mailSystem',
      actionName: 'queryMemberMailRecords',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
};

