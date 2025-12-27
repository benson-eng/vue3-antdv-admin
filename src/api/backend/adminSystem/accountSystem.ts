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

export interface LogoutAction4PlatformParams {
  /**
   * `${account}@${agentID}`
   */
  memberID: string;
}

/**
 * 對齊 Vue2：admin-web/src/api/member.ts -> /AdminSystem/api/action/logoutAction4Platform
 */
export const logoutAction4Platform = (params: LogoutAction4PlatformParams) =>
  request({
    url: '/AdminSystem/api/action/logoutAction4Platform',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'logoutAction4Platform',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface CheckNicknameParams {
  masterAgent: string;
  nickname: string;
}

export interface CheckNicknameResult {
  /**
   * true: 可用
   * false: 已存在 / 不可用
   */
  result: boolean;
}

/**
 * 對齊 Vue2：admin-web/src/api/account.ts -> /AdminSystem/api/action/checkNickname
 */
export const checkNickname = (params: CheckNicknameParams) =>
  request<CheckNicknameResult>({
    url: '/AdminSystem/api/action/checkNickname',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'checkNickname',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface ChangeNicknameParams {
  memberID: string;
  nickname: string;
  isForce?: boolean;
}

/**
 * 對齊 Vue2：admin-web/src/api/account.ts -> /AdminSystem/api/action/changeNickname
 */
export const changeNickname = (params: ChangeNicknameParams) =>
  request({
    url: '/AdminSystem/api/action/changeNickname',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'changeNickname',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface QueryAccountsNickNameParams {
  memberIDs: string[];
}

export interface QueryAccountsNickNameItem {
  memberID: string;
  accountID: string;
  nickName: string;
}

export interface QueryAccountsNickNameResult {
  data: {
    result: QueryAccountsNickNameItem[];
  };
}

/**
 * 對齊 Vue2：admin-web/src/api/member.ts -> /AdminSystem/api/action/queryAccountsNickName
 */
export const queryAccountsNickName = (params: QueryAccountsNickNameParams) =>
  request<QueryAccountsNickNameResult>({
    url: '/AdminSystem/api/action/queryAccountsNickName',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'queryAccountsNickName',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface QueryAccountBaseInfoParams {
  masterAgent: string;
  accounts: string[];
}

export interface AccountBaseInfoItem {
  id: string;
  account: string;
  nickName: string;
  agentID: string;
  tags?: string;
}

export interface QueryAccountBaseInfoResult {
  data: AccountBaseInfoItem[];
}

/**
 * 對齊 Vue2：admin-web/src/api/member.ts -> queryAccountBaseInfo
 */
export const queryAccountBaseInfo = (params: QueryAccountBaseInfoParams) =>
  request<QueryAccountBaseInfoResult>({
    url: '/AdminSystem/api/action/queryAccountBaseInfo',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'queryAccountBaseInfo',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });




