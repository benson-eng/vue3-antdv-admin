import { request } from '@/utils/request';

/**
 * AdminSystem / tokenServer（Vue2 admin-web/src/api/tokenServer.ts 遷移）
 *
 * - 查詢/刪除：/AdminSystem/api/action/*
 * - 新增/更新（含圖片上傳）：/AdminSystem/api/upload/*
 */

export enum TokenType {
  GACHAPON_TICKET = 1, // 轉蛋券
  GOLDEN_TICKET = 2, // 黃金券
}

export type TokenItem = {
  id: number;
  name: string;
  type: TokenType;
  masterAgent: string;
  iconUrl: string;
  transactionLimit?: number;
};

export const queryTokens = (params: { masterAgent: string; type?: TokenType }) =>
  request<TokenItem[]>({
    url: '/AdminSystem/api/action/queryTokens',
    method: 'post',
    data: {
      server: 'tokenServer',
      actionName: 'queryTokens',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

const buildTokenUploadFormData = (
  actionName: 'createToken' | 'updateToken',
  query: Record<string, any>,
) => {
  const formData = new FormData();
  formData.append('server', 'tokenServer');
  formData.append('actionName', actionName);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const formKey = `query[${key}]`;
    if (value instanceof File) {
      formData.append(formKey, value);
      return;
    }
    formData.append(formKey, String(value));
  });

  return formData;
};

export const createToken = (params: {
  masterAgent: string;
  type: TokenType;
  name: string;
  iconFile?: File;
  transactionLimit?: number;
}) =>
  request<any>({
    url: '/AdminSystem/api/upload/createToken',
    method: 'post',
    data: buildTokenUploadFormData('createToken', params),
    requestType: 'form',
    timeout: 0,
  });

export const updateToken = (params: {
  id: number;
  masterAgent: string;
  name: string;
  iconFile?: File;
  transactionLimit?: number;
}) =>
  request<any>({
    url: '/AdminSystem/api/upload/updateToken',
    method: 'post',
    data: buildTokenUploadFormData('updateToken', params),
    requestType: 'form',
    timeout: 0,
  });

export const removeToken = (params: { masterAgent: string; id: number }) =>
  request<any>({
    url: '/AdminSystem/api/action/removeToken',
    method: 'post',
    data: {
      server: 'tokenServer',
      actionName: 'removeToken',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  queryTokens,
  createToken,
  updateToken,
  removeToken,
};


