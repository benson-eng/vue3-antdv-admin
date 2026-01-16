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

/**
 * =========================================
 * OTP SMS Template API (Member/Account System)
 * 對齊 Vue2：admin-web/src/api/member.ts
 * =========================================
 */

export enum OTPTemplateTypeMember {
  CHANGE_PASSWORD = 'ChangePassword',
}

export interface QueryOTPSmsTemplatesMemberParams {
  masterAgent: string;
  type: OTPTemplateTypeMember | string;
}

export interface OTPSmsTemplateItemMember {
  masterAgent: string;
  type: string;
  template: string;
}

export interface QueryOTPSmsTemplatesMemberResult {
  data: OTPSmsTemplateItemMember[];
}

/**
 * 對齊 Vue2：admin-web/src/api/member.ts -> queryOTPSmsTemplates
 */
export const queryOTPSmsTemplatesMember = (params: QueryOTPSmsTemplatesMemberParams) =>
  request<QueryOTPSmsTemplatesMemberResult>({
    url: '/AdminSystem/api/action/queryOTPSmsTemplates',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'queryOTPSmsTemplates',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface SetOTPSmsTemplateMemberParams {
  masterAgent: string;
  type: OTPTemplateTypeMember | string;
  template: string;
}

/**
 * 對齊 Vue2：admin-web/src/api/member.ts -> setOTPSmsTemplate
 */
export const setOTPSmsTemplateMember = (params: SetOTPSmsTemplateMemberParams) =>
  request({
    url: '/AdminSystem/api/action/setOTPSmsTemplate',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'setOTPSmsTemplate',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * =========================================
 * Member Account API (對齊 Vue2 admin-web/src/api/member.ts)
 * =========================================
 */

export interface IAccountInfo {
  account: string;
  prefix: string;
  nickName: string;
  agentID: string;
  activationDate?: {
    startTime: Date | string;
    dueTime: Date | string;
  };
  registerTime?: Date | string;
  lastLoginTime?: Date | string;
  lastLoginIP?: string;
  accountStatus: number;
  tags?: string;
  accountID: string;
  phoneNumber?: string;
  authProvider?: string;
  email?: string;
  vip?: number;
  vipName?: string;
  lastMonthVip?: number | null;
  memberID?: string;
  accountStatusSwitch?: boolean;
  suspension?: string;
  guildName?: string;
  lastLoginDevice?: string;
}

export interface IQueryAccountParams {
  page?: number;
  limit?: number;
  agentID: string;
  account?: string;
  nickName?: string;
  tags?: string;
  isPersonalInfo?: boolean;
  phoneNumber?: number | string;
  searchTime?: {
    startTime?: Date;
    dueTime?: Date;
  };
}

export interface IQueryAccountResult {
  data: {
    result: IAccountInfo[];
    count: number;
  };
}

/**
 * 對齊 Vue2：getMemberAccount -> /AdminSystem/api/action/queryAccountAction
 */
export const getMemberAccount = (params: IQueryAccountParams) => {
  const query = { ...params };
  if (query.searchTime?.dueTime) {
    const dueTime = new Date(query.searchTime.dueTime);
    dueTime.setHours(23, 59, 59, 999);
    query.searchTime.dueTime = dueTime;
  }
  return request<IQueryAccountResult>({
    url: '/AdminSystem/api/action/queryAccountAction',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'queryAccountAction',
      query: JSON.stringify(query),
    },
    timeout: 0,
  });
};

export interface ICreateAccountParams {
  account: string;
  nickName: string;
  password: string;
  agentID: string;
  accountActivationDate?: {
    startTime?: Date;
    dueTime?: Date;
  };
  tags?: string;
  infos?: any;
}

export interface IVueResponse {
  error?: {
    code?: string | number;
    message?: string;
  };
  data?: any;
}

/**
 * 對齊 Vue2：createMemberAccount -> /AdminSystem/api/action/registerAccountAction
 */
export const createMemberAccount = (params: ICreateAccountParams) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/action/registerAccountAction',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'registerAccountAction',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface IEditAccountParams {
  memberID: string;
  newPassword?: string;
  newNickname?: string;
  newAccountStatus?: number;
  newActivationDate?: {
    startTime?: Date | string;
    dueTime?: Date | string;
  };
  newTags?: string;
}

/**
 * 對齊 Vue2：updateMemberAccount -> /AdminSystem/api/action/editAccountAction
 */
export const updateMemberAccount = (params: IEditAccountParams) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/action/editAccountAction',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'editAccountAction',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface IUnbindPhoneNumberParams {
  memberID: string;
}

/**
 * 對齊 Vue2：unbindPhoneNumber -> /AdminSystem/api/action/unbindPhoneNumber
 */
export const unbindPhoneNumber = (params: IUnbindPhoneNumberParams) =>
  request<IVueResponse>({
    url: '/AdminSystem/api/action/unbindPhoneNumber',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'unbindPhoneNumber',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 對齊 Vue2：queryAccountBaseInfo 用於根據 accountID 查詢 memberID
 * Vue2 使用 IDs 參數，但後端實際接收 accounts
 */
export interface IQueryAccountBaseInfoByIDsParams {
  masterAgent: string;
  IDs?: string[];
  accounts?: string[];
}

export interface IQueryAccountBaseInfoByIDsResult {
  data: AccountBaseInfoItem[];
}

export const queryAccountBaseInfoByIDs = (params: IQueryAccountBaseInfoByIDsParams) => {
  // 對齊 Vue2：如果提供 IDs，轉換為 accounts
  const queryParams = {
    masterAgent: params.masterAgent,
    accounts: params.accounts || params.IDs || [],
  };
  return request<IQueryAccountBaseInfoByIDsResult>({
    url: '/AdminSystem/api/action/queryAccountBaseInfo',
    method: 'post',
    data: {
      server: 'accountSystem',
      actionName: 'queryAccountBaseInfo',
      query: JSON.stringify(queryParams),
    },
    timeout: 0,
  });
};
