import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/gameChatroomSystem.ts
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export enum RoomType {
  LOBBY = 1,
  VIP_LOBBY = 2,
  TEAM_LOBBY = 3,
}

export interface RoomInfo {
  roomID: string | number;
  masterAgent: string;
  owner: string;
  type: RoomType;
  thirdPartyService: string;
  name: string;
  teamID?: string;
  announcement?: string;
}

export interface RoomListResponse {
  data: RoomInfo[];
}

export const queryRooms = (params: { masterAgent: string }) =>
  request<RoomListResponse>({
    url: '/AdminSystem/api/action/queryRooms',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'queryRooms',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface UpdateRoomParams {
  masterAgent: string;
  roomID: string;
  name?: string;
  announcement?: string;
}

export const updateRoom = (params: UpdateRoomParams) =>
  request<RoomInfo>({
    url: '/AdminSystem/api/action/updateRoom',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'updateRoom',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export enum ClientType {
  ANDROID = 1,
  IOS = 2,
  PC = 4,
  WEB = 16,
  REST = 32,
  MAC = 64,
}

export interface TextHistoryMessage {
  memberID: string;
  messageID: string;
  sendTime: Date | string;
  message: string;
  clientType?: ClientType;
  type?: number;
  messageStr?: string;
}

export interface QueryRoomHistoryMessagesResponse {
  data: TextHistoryMessage[];
}

export const queryRoomHistoryMessages = (params: {
  masterAgent: string;
  roomID: string;
  startTime: Date | string;
  limit?: number;
}) =>
  request<QueryRoomHistoryMessagesResponse>({
    url: '/AdminSystem/api/action/queryRoomHistoryMessages',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'queryRoomHistoryMessages',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface BroadcastParams {
  masterAgent: string;
  message: string;
}

export const broadcast = (params: BroadcastParams) =>
  request<{ data: { error?: boolean } }>({
    url: '/AdminSystem/api/action/broadcast',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'broadcast',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface RoomBroadcastParams {
  masterAgent: string;
  roomID: string;
  message: string;
}

export const roomBroadcast = (params: RoomBroadcastParams) =>
  request<{ data: { error?: boolean } }>({
    url: '/AdminSystem/api/action/roomBroadcast',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'roomBroadcast',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface RoomRelationship {
  id: string;
  memberID: string;
  recordID?: string;
  memberID2?: string;
  nickName?: string;
  account?: string;
}

export interface QueryRoomRelationshipsResponse {
  data: {
    relationships: RoomRelationship[];
  };
}

export const queryRoomRelationships = (params: {
  masterAgent: string;
  roomID: string;
}) =>
  request<QueryRoomRelationshipsResponse>({
    url: '/AdminSystem/api/action/queryRoomRelationships',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'queryRoomRelationships',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface TemporaryMuteUserParams {
  memberID: string;
  roomID: string;
  durationSec: number;
}

export const temporaryMuteUser = (params: TemporaryMuteUserParams) =>
  request({
    url: '/AdminSystem/api/action/temporaryMuteUser',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'temporaryMuteUser',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface MuteUserParams {
  memberID: string;
  roomID: string;
}

export const muteUser = (params: MuteUserParams) =>
  request({
    url: '/AdminSystem/api/action/muteUser',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'muteUser',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const unmuteUser = (params: MuteUserParams) =>
  request({
    url: '/AdminSystem/api/action/unmuteUser',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'unmuteUser',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// ============ PrivateTeam APIs ============

export enum PrivateTeamSearchType {
  ALL = 0,
  IS_EXIST = 1,
  IS_NOT_EXIST = 2,
}

export interface PrivateTeamInfo {
  privateTeamID: string;
  name: string;
  memberID: string;
  nickName?: string;
  owner: string;
  ownerName?: string;
  ownerID?: string;
  searchType?: PrivateTeamSearchType;
  teamID?: string;
  type?: number;
}

export interface PrivateTeamQueryParams {
  memberID?: string;
  masterAgent?: string;
  teamName?: string;
  searchType: PrivateTeamSearchType;
}

export interface PrivateTeamQueryResponse {
  data: {
    privateTeam: PrivateTeamInfo[];
  };
}

export const privateTeamQuery = (params: PrivateTeamQueryParams) =>
  request<PrivateTeamQueryResponse>({
    url: '/AdminSystem/api/action/privateTeamQuery',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'privateTeamQuery',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface PrivateTeamKickParams {
  kickerMemberID: string;
  memberIDs: string[];
  teamID: string;
  platformMemberID: string;
}

export const privateTeamKick = (params: PrivateTeamKickParams) =>
  request<{ error?: boolean }>({
    url: '/AdminSystem/api/action/privateTeamKick',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'privateTeamKick',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface PrivateTeamHistoryMessagesParams {
  teamID: string;
  memberID: string;
  searchTimes: [Date | string, Date | string];
  limit?: number;
}

export interface PrivateTeamHistoryMessagesResponse {
  data: TextHistoryMessage[];
}

export const privateTeamHistoryMessages = (params: PrivateTeamHistoryMessagesParams) =>
  request<PrivateTeamHistoryMessagesResponse>({
    url: '/AdminSystem/api/action/privateTeamHistoryMessages',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'privateTeamHistoryMessages',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface PrivateTeamDelParams {
  teamID: string;
  memberID: string;
  platformMemberID: string;
}

export const privateTeamDel = (params: PrivateTeamDelParams) =>
  request<{ error?: boolean }>({
    url: '/AdminSystem/api/action/privateTeamDel',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'privateTeamDel',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// ============ Sticker APIs ============

export interface StickerColumns {
  id: number;
  name: string;
  masterAgent: string;
  url: string;
  md5: string;
  size: number;
  width: number;
  height: number;
  mime: string;
  extension: string;
}

export interface AddStickerParams {
  masterAgent: string;
  name: string;
  imageFile: File;
}

export interface AddStickerResponse {
  data: StickerColumns;
}

export const addSticker = (params: AddStickerParams) => {
  const formData = new FormData();
  formData.append('server', 'gameChatroomSystem');
  formData.append('actionName', 'addSticker');
  
  // 根據 Vue2 的 jsonToFormData 行為：
  // jsonToFormData 會將 query 對象中的所有字段展開為 query[key] 格式
  // 包括 File 類型的字段也會展開為 query[imageFile]
  formData.append('query[masterAgent]', params.masterAgent);
  formData.append('query[name]', params.name);
  formData.append('query[imageFile]', params.imageFile);
  
  return request<AddStickerResponse>({
    url: '/AdminSystem/api/upload/addSticker',
    method: 'post',
    data: formData,
    timeout: 0,
  });
};

export interface UpdateStickerParams {
  id: number;
  masterAgent: string;
  name?: string;
  imageFile?: File;
}

export interface UpdateStickerResponse {
  data: StickerColumns;
}

export const updateSticker = (params: UpdateStickerParams) => {
  const formData = new FormData();
  formData.append('server', 'gameChatroomSystem');
  formData.append('actionName', 'updateSticker');
  formData.append('query[id]', String(params.id));
  formData.append('query[masterAgent]', params.masterAgent);
  
  // 只有當 name 存在時才添加到 query
  if (params.name !== undefined) {
    formData.append('query[name]', params.name);
  }
  
  // imageFile 作為單獨的 FormData 字段（如果存在）
  if (params.imageFile) {
    formData.append('imageFile', params.imageFile);
  }
  
  return request<UpdateStickerResponse>({
    url: '/AdminSystem/api/upload/updateSticker',
    method: 'post',
    data: formData,
    timeout: 0,
  });
};

export interface StickerListParams {
  masterAgent: string;
}

export interface StickerListResponse {
  data?: StickerColumns[];
}

// stickerList API 可能直接返回數組或 { data: [...] } 格式
export const stickerList = (params: StickerListParams) =>
  request<StickerListResponse | StickerColumns[]>({
    url: '/AdminSystem/api/action/stickerList',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'stickerList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface RemoveStickerParams {
  id: number;
  masterAgent: string;
}

export interface RemoveStickerResponse {
  data: { result: boolean };
}

export const removeSticker = (params: RemoveStickerParams) =>
  request<RemoveStickerResponse>({
    url: '/AdminSystem/api/action/removeSticker',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'removeSticker',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// ============ IndecentWords APIs ============

export interface QueryIndecentWordsParams {
  masterAgent: string;
}

export interface QueryIndecentWordsResponse {
  data?: {
    indecentWords: string[];
  };
  indecentWords?: string[];
}

export const queryIndecentWords = (params: QueryIndecentWordsParams) =>
  request<QueryIndecentWordsResponse>({
    url: '/AdminSystem/api/action/queryIndecentWords',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'queryIndecentWords',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface AddIndecentWordsParams {
  masterAgent: string;
  indecentWords: string[];
}

export interface AddIndecentWordsResponse {
  data?: { error?: boolean };
}

export const addIndecentWords = (params: AddIndecentWordsParams) =>
  request<AddIndecentWordsResponse>({
    url: '/AdminSystem/api/action/addIndecentWords',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'addIndecentWords',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface RemoveIndecentWordsParams {
  masterAgent: string;
  indecentWords: string[];
}

export interface RemoveIndecentWordsResponse {
  data?: { error?: boolean };
}

export const removeIndecentWords = (params: RemoveIndecentWordsParams) =>
  request<RemoveIndecentWordsResponse>({
    url: '/AdminSystem/api/action/removeIndecentWords',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'removeIndecentWords',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface UpdateIndecentWordsParams {
  masterAgent: string;
  indecentWords: string[];
}

export interface UpdateIndecentWordsResponse {
  data?: { error?: boolean };
}

export const updateIndecentWords = (params: UpdateIndecentWordsParams) =>
  request<UpdateIndecentWordsResponse>({
    url: '/AdminSystem/api/action/updateIndecentWords',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'updateIndecentWords',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

// ============ PrivateTeamAnnouncementTemplate APIs ============

export interface QueryPrivateTeamTemplatesParams {
  masterAgent: string;
}

export interface PrivateTeamTemplate {
  masterAgent: string;
  template: string;
}

export interface QueryPrivateTeamTemplatesResponse {
  data?: PrivateTeamTemplate[];
}

export const queryPrivateTeamTemplates = (params: QueryPrivateTeamTemplatesParams) =>
  request<QueryPrivateTeamTemplatesResponse>({
    url: '/AdminSystem/api/action/queryPrivateTeamTemplates',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'queryPrivateTeamTemplates',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface SetPrivateTeamAnnouncementTemplateParams {
  masterAgent: string;
  template: string;
}

export interface SetPrivateTeamAnnouncementTemplateResponse {
  data?: { error?: boolean };
}

export const setPrivateTeamAnnouncementTemplate = (params: SetPrivateTeamAnnouncementTemplateParams) =>
  request<SetPrivateTeamAnnouncementTemplateResponse>({
    url: '/AdminSystem/api/action/setPrivateTeamAnnouncementTemplate',
    method: 'post',
    data: {
      server: 'gameChatroomSystem',
      actionName: 'setPrivateTeamAnnouncementTemplate',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

