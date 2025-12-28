import { request } from '@/utils/request';

/**
 * 對齊 Vue2：admin-web/src/api/treasureChestSystem.ts（節選）
 * AdminSystem Action Gateway: /AdminSystem/api/action/*
 */

export type TreasureItemType = string;

export interface TreasureItem {
  treasureItemID: string;
  itemName: string;
  iconUrl: string;
  enabled: number | boolean;
  /** treasureCard 相關欄位（不同平台回傳可能略有差異，先保留為可選） */
  game?: string;
  cardItem?: string;
  bet?: number;
  creditRate?: string;
  [k: string]: any;
}

export interface TreasureItemListRow {
  type: TreasureItemType;
  items: TreasureItem[];
}

export interface TreasureItemListResult {
  data: {
    rows: TreasureItemListRow[];
  };
}

export const treasureItemList = (params: { masterAgent: string; itemType?: string }) =>
  request<TreasureItemListResult>({
    url: '/AdminSystem/api/action/treasureItemList',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'treasureItemList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface TreasureCardInfo {
  id: number;
  masterAgent: string;
  cardName: string;
  cardIcon: string;
  cardItem: string;
  game: string;
  [k: string]: any;
}

export const queryTreasureCardInfos = (params: { masterAgent: string }) =>
  request<TreasureCardInfo[]>({
    url: '/AdminSystem/api/action/queryTreasureCardInfos',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'queryTreasureCardInfos',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface AddTreasureCardParams {
  masterAgent: string;
  game: string;
  cardItem: string;
  bet: number;
  creditRate?: string;
}

/**
 * 建立虛寶卡（若不存在）
 *
 * 注意：不同環境回傳資料結構可能不同，因此先以 unknown 接住，
 * 實際使用時建議以 `treasureItemList` 重新查回新建立的 treasureItemID。
 */
export const addTreasureCard = (params: AddTreasureCardParams) =>
  request<unknown>({
    url: '/AdminSystem/api/action/addTreasureCard',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'addTreasureCard',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * =========================
 * 玩家背包 / 穿戴（給比賽排行榜黑名單用）
 * 對齊 Vue2：admin-web/src/api/treasureChestSystem.ts（節選）
 * =========================
 */

export interface PlayerPackItem {
  treasureItemID: string;
  enabled?: boolean;
  validFrom?: string | Date;
  validUntil?: string | Date;
  useState?: number;
  itemType?: string;
  itemName?: string;
  bet?: number;
  sourceType?: string;
  [k: string]: any;
}

export interface PlayerPackV2Row {
  type: string;
  items: PlayerPackItem[];
}

export const getPlayerPackV2 = (params: { memberID: string; itemType?: string }) =>
  request<PlayerPackV2Row[]>({
    url: '/AdminSystem/api/action/playerPackV2',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'playerPackV2',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const equipItem = (params: { memberID: string; treasureItemID: string; playerPackID?: string }) =>
  request({
    url: '/AdminSystem/api/action/equipItem',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'equipItem',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const unequipItem = (params: { memberID: string; treasureItemID: string; playerPackID?: string }) =>
  request({
    url: '/AdminSystem/api/action/unequipItem',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'unequipItem',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * =========================
 * 圖片管理（信件圖片等）
 * 對齊 Vue2：admin-web/src/api/treasureChestSystem.ts
 * =========================
 */

export enum ImageType {
  MAIL = 'mail',
  MISSION = 'mission',
  AD = 'ad',
  EVENT = 'event',
  GACHPON = 'gachpon',
  DAILYDRAW = 'dailyDraw',
  PAYMENT = 'payment',
  GAME = 'game',
}

export interface IconItem {
  id: number;
  masterAgent: string;
  name: string;
  url: string;
  type: string;
  filename: string;
  gameID: string | null;
  [k: string]: any;
}

export interface QueryIconResult {
  data: {
    result: IconItem[];
  };
}

/**
 * 查詢圖片列表
 * - Vue2：queryIcon -> /AdminSystem/api/action/queryIcon
 */
export const queryIcon = (params: { masterAgent: string; type?: string }) =>
  request<QueryIconResult>({
    url: '/AdminSystem/api/action/queryIcon',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'queryIcon',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 新增圖片
 * - Vue2：addIcon -> /AdminSystem/api/upload/addIcon
 */
export const addIcon = (params: {
  masterAgent: string;
  name: string;
  type: string;
  gameID?: string;
  imageFile: File;
}) => {
  const formData = new FormData();
  formData.append('server', 'treasureChestSystem');
  formData.append('actionName', 'addIcon');
  
  // 對齊 Vue2 的 jsonToFormData 行為：
  // jsonToFormData 會將 query 對象中的所有字段展開為 query[key] 格式
  // 包括 File 類型的字段也會展開為 query[imageFile]
  formData.append('query[masterAgent]', params.masterAgent);
  formData.append('query[name]', params.name);
  formData.append('query[type]', params.type);
  formData.append('query[imageFile]', params.imageFile);
  // 如果 gameID 存在，才添加（對齊 Vue2：undefined 時不包含）
  if (params.gameID !== undefined) {
    formData.append('query[gameID]', params.gameID);
  }

  return request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/upload/addIcon',
    method: 'post',
    data: formData,
    timeout: 0,
  });
};

/**
 * 刪除圖片
 * - Vue2：removeIcon -> /AdminSystem/api/action/removeIcon
 */
export const removeIcon = (params: { masterAgent: string; id: number[] }) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/removeIcon',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'removeIcon',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });



