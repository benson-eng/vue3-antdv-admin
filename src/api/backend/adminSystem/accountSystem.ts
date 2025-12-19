import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem/api/action/*）
 * 對齊來源：admin-web/src/api/account.ts + admin-web/src/api/member.ts
 * =========================================
 */

export interface FuzzyQueryUserParams {
  masterAgent: string;
  agentID?: string;
  queryText: string;
  limit?: number;
  lastAccountID?: string;
}

export interface FuzzyQueryUserItem {
  id: string;
  account: string;
  accountID: string;
  nickName: string;
  agentID: string;
}

/**
 * 對齊 Vue2：getFuzzyQueryUser -> /AdminSystem/api/action/fuzzyQueryUser
 */
export const fuzzyQueryUser = (params: FuzzyQueryUserParams) =>
  request<FuzzyQueryUserItem[]>({
    url: '/AdminSystem/api/action/fuzzyQueryUser',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'fuzzyQueryUser',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export type DateType = 'createdAt' | 'lastLoginTime';

export interface QueryAccountPersonalInfoParams {
  page?: number;
  limit?: number;
  agentID: string;
  account?: string;
  nickName?: string;
  dateType: DateType;
  searchTime: {
    startTime: Date;
    dueTime: Date;
  };
}

export interface AccountPersonalInfoItem {
  account: string;
  prefix: string;
  nickName: string;
  agentID: string;
  activationDate?: {
    startTime: Date;
    dueTime: Date;
  };
  registerTime?: string;
  lastLoginTime?: string;
  lastLoginIP?: string;
  accountStatus?: number;
  tags?: string;
  accountID?: string;
  email?: string;
  phoneNumber?: string;
  authProvider?: string;
}

export interface QueryAccountPersonalInfoResult {
  result: AccountPersonalInfoItem[];
  count: number;
}

/**
 * 對齊 Vue2：getMemberAccountPersonalInfo -> /AdminSystem/api/action/queryAccountPersonalInfo
 */
export const queryAccountPersonalInfo = (params: QueryAccountPersonalInfoParams) =>
  request<QueryAccountPersonalInfoResult>({
    url: '/AdminSystem/api/action/queryAccountPersonalInfo',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'queryAccountPersonalInfo',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
