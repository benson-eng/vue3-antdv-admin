import { request } from '@/utils/request';

/**
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 * 對齊來源：admin-web/src/api/profileSystem.ts
 */

export interface DefaultAvatarItem {
  id: number;
  masterAgent: string;
  profileID?: string;
  profileUrl: string;
  isEnabled: boolean;
  createDateTime?: string;
}

export interface GetDefaultAvatarParams {
  masterAgent: string;
  isEnabled?: boolean;
}

/**
 * 取得預設頭像列表
 * - Vue2：getDefaultAvatarAction -> /AdminSystem/api/action/getDefaultAvatar
 */
export const getDefaultAvatar = (params: GetDefaultAvatarParams) =>
  request<DefaultAvatarItem[]>({
    url: '/AdminSystem/api/action/getDefaultAvatar',
    method: 'post',
    data: {
      server: 'profileSystem',
      actionName: 'getDefaultAvatar',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface GetUserProfileParams {
  memberID: string;
}

export interface UserProfileResult {
  profilePictureUrl?: string;
  avatarID?: number;
}

/**
 * 查詢會員頭像資訊
 * - Vue2：getUserProfile -> /AdminSystem/api/action/getUserProfile
 */
export const getUserProfile = (params: GetUserProfileParams) =>
  request<UserProfileResult>({
    url: '/AdminSystem/api/action/getUserProfile',
    method: 'post',
    data: {
      server: 'profileSystem',
      actionName: 'getUserProfile',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface UpdateUserProfileParams {
  memberID: string;
  avatarID: number;
}

/**
 * 更新會員頭像
 * - Vue2：updateUserProfile -> /AdminSystem/api/action/updateUserProfile
 */
export const updateUserProfile = (params: UpdateUserProfileParams) =>
  request<boolean>({
    url: '/AdminSystem/api/action/updateUserProfile',
    method: 'post',
    data: {
      server: 'profileSystem',
      actionName: 'updateUserProfile',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface CreateDefaultAvatarParams {
  masterAgent: string;
  profilePictureFile: File;
  isEnabled: boolean;
}

/**
 * 創建預設頭像
 * - Vue2：createDefaultAvatarAction -> /AdminSystem/api/upload/createDefaultAvatar
 */
export const createDefaultAvatar = (params: CreateDefaultAvatarParams) => {
  const formData = new FormData();
  formData.append('server', 'profileSystem');
  formData.append('actionName', 'createDefaultAvatar');
  
  // 對齊 Vue2 的 jsonToFormData 行為：
  // jsonToFormData 會將 query 對象中的所有字段展開為 query[key] 格式
  // 包括 File 類型的字段也會展開為 query[profilePictureFile]
  formData.append('query[masterAgent]', params.masterAgent);
  formData.append('query[isEnabled]', String(params.isEnabled));
  formData.append('query[profilePictureFile]', params.profilePictureFile);

  return request<any>({
    url: '/AdminSystem/api/upload/createDefaultAvatar',
    method: 'post',
    data: formData,
    requestType: 'form',
    isReturnResult: false, // 需要獲取完整響應以檢查 error 屬性
    timeout: 0,
  });
};

export interface UpdateDefaultAvatarParams {
  masterAgent: string;
  avatarID?: number;
  profilePictureFile?: File;
  isEnabled?: boolean;
  isDeleted?: boolean;
}

/**
 * 更新預設頭像
 * - Vue2：updateDefaultAvatarAction -> /AdminSystem/api/upload/updateDefaultAvatar
 */
export const updateDefaultAvatar = (params: UpdateDefaultAvatarParams) => {
  const formData = new FormData();
  formData.append('server', 'profileSystem');
  formData.append('actionName', 'updateDefaultAvatar');
  
  // 對齊 Vue2 的 jsonToFormData 行為：
  // jsonToFormData 會將 query 對象中的所有字段展開為 query[key] 格式
  formData.append('query[masterAgent]', params.masterAgent);
  if (params.avatarID !== undefined) {
    formData.append('query[avatarID]', String(params.avatarID));
  }
  if (params.profilePictureFile) {
    formData.append('query[profilePictureFile]', params.profilePictureFile);
  }
  if (params.isEnabled !== undefined) {
    formData.append('query[isEnabled]', String(params.isEnabled));
  }
  if (params.isDeleted !== undefined) {
    formData.append('query[isDeleted]', String(params.isDeleted));
  }

  return request<any>({
    url: '/AdminSystem/api/upload/updateDefaultAvatar',
    method: 'post',
    data: formData,
    requestType: 'form',
    isReturnResult: false, // 需要獲取完整響應以檢查 error 屬性
    timeout: 0,
  });
};


