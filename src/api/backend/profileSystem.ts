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



