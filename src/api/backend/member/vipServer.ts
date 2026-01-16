import { request } from '@/utils/request';

/**
 * AdminSystem / vipServer（Vue2 admin-web/src/api/vipServer.ts 遷移）
 *
 * - 查詢/刪除：/AdminSystem/api/action/*
 * - 新增/更新（含檔案上傳）：/AdminSystem/api/upload/*
 *
 * 注意：此 Server 的 actionName 仍保留 `vipSetting/listByMasterAgent` 這種帶 `/` 的命名，
 * 因此 URL 需使用 `actionName.replace('/', '-')` 對齊 Vue2。
 */

export interface VipExtraSetting {
  id?: number;
  vipSettingId?: number;
  name: string;
  type: string;
  value: string | number;
}

export interface VipSetting {
  id: number;
  masterAgent: string;
  lastMonthVip: number | null;
  vipLevel: number;
  levelUpNeedPoint: number;
  name: string;
  icon: string;
  extraSettings: VipExtraSetting[];
}

export type VipSettingWithFile = VipSetting & {
  iconRaw?: File | null;
};

export interface FixedVipMemberInfo {
  id?: number;
  masterAgent: string;
  memberID: string;
  vip: number;
}

const server = 'vipServer';

const buildActionUrl = (actionName: string) => `/AdminSystem/api/action/${actionName.replace('/', '-')}`;
const buildUploadUrl = (actionName: string) => `/AdminSystem/api/upload/${actionName.replace('/', '-')}`;

export const listByMasterAgent = (params: { masterAgent: string }) =>
  request<VipSetting[]>({
    url: buildActionUrl('vipSetting/listByMasterAgent'),
    method: 'post',
    data: {
      server,
      actionName: 'vipSetting/listByMasterAgent',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

const buildUploadFormData = (actionName: string, query: Record<string, any>) => {
  const formData = new FormData();
  formData.append('server', server);
  formData.append('actionName', actionName);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    const formKey = `query[${key}]`;
    if (value instanceof File) {
      formData.append(formKey, value);
      return;
    }
    formData.append(formKey, String(value));
  });

  return formData;
};

export const createVipSetting = (params: VipSettingWithFile) => {
  const query: Record<string, any> = {
    ...params,
    // 後端需要字串（對齊 Vue2）
    extraSettings: JSON.stringify(params.extraSettings ?? []),
  };
  return request<any>({
    url: buildUploadUrl('vipSetting/create'),
    method: 'post',
    data: buildUploadFormData('vipSetting/create', query),
    requestType: 'form',
    timeout: 0,
  });
};

export const updateVipSetting = (params: VipSettingWithFile) => {
  const query: Record<string, any> = {
    ...params,
    extraSettings: JSON.stringify(params.extraSettings ?? []),
  };
  return request<any>({
    url: buildUploadUrl('vipSetting/update'),
    method: 'post',
    data: buildUploadFormData('vipSetting/update', query),
    requestType: 'form',
    timeout: 0,
  });
};

export const deleteVipSetting = (params: { id: number }) =>
  request<any>({
    url: buildActionUrl('vipSetting/delete'),
    method: 'post',
    data: {
      server,
      actionName: 'vipSetting/delete',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const createVipExtraSetting = (params: { vipSettingId: number; name: string; type: string; value: string | number }) =>
  request<any>({
    url: buildActionUrl('vipExtraSetting/create'),
    method: 'post',
    data: {
      server,
      actionName: 'vipExtraSetting/create',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const updateVipExtraSetting = (params: { id: number; vipSettingId: number; name: string; type: string; value: string | number }) =>
  request<any>({
    url: buildActionUrl('vipExtraSetting/update'),
    method: 'post',
    data: {
      server,
      actionName: 'vipExtraSetting/update',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const getFixedVipMemberList = (params: { masterAgent: string }) =>
  request<FixedVipMemberInfo[]>({
    url: buildActionUrl('fixedVipMember/list'),
    method: 'post',
    data: {
      server,
      actionName: 'fixedVipMember/list',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setFixedVipMember = (params: { masterAgent: string; memberID: string; vip: number }) =>
  request<FixedVipMemberInfo>({
    url: buildActionUrl('fixedVipMember/set'),
    method: 'post',
    data: {
      server,
      actionName: 'fixedVipMember/set',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const removeFixedVipMember = (params: { memberID: string }) =>
  request<{ result: boolean }>({
    url: buildActionUrl('fixedVipMember/remove'),
    method: 'post',
    data: {
      server,
      actionName: 'fixedVipMember/remove',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface IMemberVipInfo {
  memberID: string;
  vip: number;
  vipName: string;
  lastMonthVip: number | null;
}

export interface IGetMembersVipResult {
  data: IMemberVipInfo[];
}

/**
 * 對齊 Vue2：getMembersVip -> /AdminSystem/api/action/memberVip-getByMemberIDList
 */
export const getMembersVip = (params: { memberID: string | string[] }) =>
  request<IGetMembersVipResult>({
    url: '/AdminSystem/api/action/memberVip-getByMemberIDList',
    method: 'post',
    data: {
      server,
      actionName: 'memberVip/getByMemberIDList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  listByMasterAgent,
  createVipSetting,
  updateVipSetting,
  deleteVipSetting,
  createVipExtraSetting,
  updateVipExtraSetting,
  getFixedVipMemberList,
  setFixedVipMember,
  removeFixedVipMember,
  getMembersVip,
};





