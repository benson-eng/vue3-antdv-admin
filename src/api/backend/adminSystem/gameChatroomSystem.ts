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

