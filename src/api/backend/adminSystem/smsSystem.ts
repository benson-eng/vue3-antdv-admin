import { request } from '@/utils/request';

/**
 * =========================================
 * Vue2 舊 API（保留原行為 /AdminSystem/api/action/*）
 * 對齊來源：admin-web/src/api/smsSystem.ts
 * =========================================
 */

export enum MitakeStatusCodeForPlatform {
  sendIng = 0, // 傳送中
  arrived = 1, // 已送達
  IncorrectContent = 2, // 內容有錯誤
  IncorrectPhoneNumber = 3, // 門號有錯誤
  SMServiceDeactivated = 4, // 簡訊已停用(用戶有向電信業者申請拒收廣告簡訊)
  DeliveryTimedOut = 5, // 逾時無送達
}

export enum BoStatusCodeForPlatform {
  sendIng = 0, // 傳送中
  arrived = 1, // 已送達
  phoneIsClose = 2, // 電信端回覆因受話方手機關機/訊號不良/簡訊功能異常等原因,該訊息無法送達受話方手機
  netWorkIsError = 3, // 電信端回覆因網路系統/基地台設備異常等原因,該訊息無法送達受話方手機
  phoneNumberIsStop = 4, // 電信端回覆因受話方手機門號為空號或停用中,該訊息無法送達受話方手機
  phoneSpecificationsDoNotMatch = 5, // 電信端回覆因受話方手機規格不符(山寨機或海外機),該訊息無法送達受話方手機
  phoneIsError = 6, // 電信端回覆因受話方手機設備問題/手機出現未預期錯誤等原因,該訊息無法送達受話方手機
  SMSsystemError = 7, // 電信端回覆因系統傳送時發生非預期錯誤,該訊息無法送達受話方手機
  OtherError = 8, // 其他錯誤
}

export enum SMProviderName {
  None = '',
  Mitake = 'Mitake',
  BO = 'BO',
  SmsCloudSend = 'SmsCloudSend',
}

export interface SMSRecordItem {
  messageID: string;
  memberID: string;
  nickName?: string;
  provider: string;
  message: string;
  statusCode: number;
  messageSendTime: string;
}

export interface SMQueryStatusParams {
  masterAgent: string;
  memberID?: string;
  date: [Date, Date];
  providers: string[];
}

export interface SMQueryStatusResult {
  data: SMSRecordItem[];
}

/**
 * 對齊 Vue2：smQueryStatus -> /AdminSystem/api/action/smQueryStatus
 */
export const smQueryStatus = (params: SMQueryStatusParams) =>
  request<SMQueryStatusResult>({
    url: '/AdminSystem/api/action/smQueryStatus',
    method: 'post',
    data: {
      server: 'smsSystem',
      actionName: 'smQueryStatus',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface SetSMSServiceCostParams {
  settings: {
    masterAgent: string;
    providers: string;
    serviceCost: string;
  }[];
}

/**
 * 對齊 Vue2：setSMSServiceCost -> /AdminSystem/api/action/setSMSServiceCost
 */
export const setSMSServiceCost = (params: SetSMSServiceCostParams) =>
  request({
    url: '/AdminSystem/api/action/setSMSServiceCost',
    method: 'post',
    data: {
      server: 'smsSystem',
      actionName: 'setSMSServiceCost',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface GetSMSServiceCostParams {
  masterAgent: string;
  providers?: string[];
}

/**
 * 對齊 Vue2：getSMSServiceCost -> /AdminSystem/api/action/getSMSServiceCost
 */
export const getSMSServiceCost = (params: GetSMSServiceCostParams) =>
  request({
    url: '/AdminSystem/api/action/getSMSServiceCost',
    method: 'post',
    data: {
      server: 'smsSystem',
      actionName: 'getSMSServiceCost',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface DeleteSMSServiceCostParams {
  ids: string[];
}

/**
 * 對齊 Vue2：deleteSMSServiceCost -> /AdminSystem/api/action/deleteSMSServiceCost
 */
export const deleteSMSServiceCost = (params: DeleteSMSServiceCostParams) =>
  request({
    url: '/AdminSystem/api/action/deleteSMSServiceCost',
    method: 'post',
    data: {
      server: 'smsSystem',
      actionName: 'deleteSMSServiceCost',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
