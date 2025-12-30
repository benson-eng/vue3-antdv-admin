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

/**
 * =========================
 * 道具標籤管理（ItemTag）
 * 對齊 Vue2：admin-web/src/api/treasureChestSystem.ts
 * =========================
 */

export type ItemTypes =
  | 'renameCard'
  | 'badge'
  | 'mount'
  | 'freeScratchCard'
  | 'eventItem'
  | 'entityItem'
  | 'personalFrame'
  | 'treasureChest'
  | 'gift'
  | 'monthlyCard'
  | 'gachapon'
  | 'teamBadge'
  | 'certificate'
  | 'coupon'
  | 'dailyRewardPass';

export interface ItemTag {
  id: number;
  tag: string;
  masterAgent: string;
  order: number;
  itemType: ItemTypes;
  enabled: boolean;
}

/**
 * 查詢道具標籤列表
 * - Vue2：itemTagList -> /AdminSystem/api/action/itemTagList
 * - 實際回傳格式：直接回傳 ItemTag[] 陣列，但 Vue2 的 request 會包裝為 { data: ItemTag[] }
 * - Vue3 的 request 對於 AdminSystem API 返回 response，所以需要從 response.data 獲取
 */
export const itemTagList = (params: { masterAgent: string }) =>
  request<ItemTag[]>({
    url: '/AdminSystem/api/action/itemTagList',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'itemTagList',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 新增道具標籤
 * - Vue2：addItemTag -> /AdminSystem/api/action/addItemTag
 */
export const addItemTag = (params: {
  masterAgent: string;
  tag: string;
  order?: number;
  itemType: string;
}) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/addItemTag',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'addItemTag',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 更新道具標籤
 * - Vue2：updateItemTag -> /AdminSystem/api/action/updateItemTag
 */
export const updateItemTag = (params: {
  tagID: number;
  masterAgent: string;
  tag?: string;
  order?: number;
  itemType?: string;
  enabled?: boolean;
}) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/updateItemTag',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'updateItemTag',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 刪除道具標籤
 * - Vue2：removeItemTag -> /AdminSystem/api/action/removeItemTag
 */
export const removeItemTag = (params: {
  tagID: number;
  masterAgent: string;
}) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/removeItemTag',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'removeItemTag',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 批量更新道具標籤順序
 * - Vue2：bulkUpdateItemTagOrder -> /AdminSystem/api/action/bulkUpdateItemTagOrder
 */
export const bulkUpdateItemTagOrder = (params: {
  updateTags: { tagID: number; masterAgent: string; order: number }[];
}) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/bulkUpdateItemTagOrder',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'bulkUpdateItemTagOrder',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * =========================
 * 隊伍徽章管理（TeamBadge）
 * 對齊 Vue2：admin-web/src/api/treasureChestSystem.ts
 * =========================
 */

export interface TeamBadgeItem extends TreasureItem {
  itemType: 'teamBadge';
  teamName: string;
  teamIcon: string;
  tag?: string | null;
}

/**
 * 新增隊伍徽章
 * - Vue2：addTeamBadge -> /AdminSystem/api/upload/addTeamBadge
 */
export const addTeamBadge = (params: {
  itemName: string;
  itemType: string;
  masterAgent: string;
  iconFile?: File;
  tagID?: number | null;
  teamName: string;
  teamIcon?: File;
}) => {
  const formData = new FormData();
  formData.append('server', 'treasureChestSystem');
  formData.append('actionName', 'addTeamBadge');
  
  // 對齊 Vue2 的 jsonToFormData 行為
  formData.append('query[itemName]', params.itemName);
  formData.append('query[itemType]', params.itemType);
  formData.append('query[masterAgent]', params.masterAgent);
  formData.append('query[teamName]', params.teamName);
  
  if (params.tagID !== null && params.tagID !== undefined) {
    formData.append('query[tagID]', params.tagID.toString());
  }
  
  if (params.iconFile) {
    formData.append('query[iconFile]', params.iconFile);
  }
  
  if (params.teamIcon) {
    formData.append('query[teamIcon]', params.teamIcon);
  }

  return request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/upload/addTeamBadge',
    method: 'post',
    data: formData,
    timeout: 0,
  });
};

/**
 * 更新隊伍徽章
 * - Vue2：updateTeamBadge -> /AdminSystem/api/upload/updateTeamBadge
 */
export const updateTeamBadge = (params: {
  treasureItemID?: string;
  itemName: string;
  itemType: string;
  masterAgent: string;
  iconFile?: File;
  tagID: number | null;
  teamName: string;
  teamIcon?: File;
}) => {
  const formData = new FormData();
  formData.append('server', 'treasureChestSystem');
  formData.append('actionName', 'updateTeamBadge');
  
  // 對齊 Vue2 的 jsonToFormData 行為（includeNullValues: true）
  if (params.treasureItemID) {
    formData.append('query[treasureItemID]', params.treasureItemID);
  }
  formData.append('query[itemName]', params.itemName);
  formData.append('query[itemType]', params.itemType);
  formData.append('query[masterAgent]', params.masterAgent);
  formData.append('query[teamName]', params.teamName);
  
  // 對齊 Vue2：tagID 為 null 時也要包含（includeNullValues: true）
  if (params.tagID === null || params.tagID === undefined) {
    formData.append('query[tagID]', '');
  } else {
    formData.append('query[tagID]', params.tagID.toString());
  }
  
  if (params.iconFile) {
    formData.append('query[iconFile]', params.iconFile);
  }
  
  if (params.teamIcon) {
    formData.append('query[teamIcon]', params.teamIcon);
  }

  return request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/upload/updateTeamBadge',
    method: 'post',
    data: formData,
    timeout: 0,
  });
};

/**
 * 禁用道具
 * - Vue2：disableTreasureItem -> /AdminSystem/api/action/disableTreasureItem
 */
export const disableTreasureItem = (params: {
  treasureItemID: string;
  masterAgent: string;
}) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/disableTreasureItem',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'disableTreasureItem',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 更新道具（通用）
 * - Vue2：updateTreasureItem -> /AdminSystem/api/upload/updateTreasureItem
 */
export const updateTreasureItem = (params: {
  treasureItemID: string;
  masterAgent: string;
  itemName?: string;
  description?: string;
  enabled?: boolean;
  iconFile?: File;
  activeTimeSec?: number;
  tagID?: number;
  isShow?: boolean;
}) => {
  const formData = new FormData();
  formData.append('server', 'treasureChestSystem');
  formData.append('actionName', 'updateTreasureItem');
  
  formData.append('query[treasureItemID]', params.treasureItemID);
  formData.append('query[masterAgent]', params.masterAgent);
  
  if (params.itemName !== undefined) {
    formData.append('query[itemName]', params.itemName);
  }
  if (params.description !== undefined) {
    formData.append('query[description]', params.description);
  }
  if (params.enabled !== undefined) {
    formData.append('query[enabled]', params.enabled.toString());
  }
  if (params.activeTimeSec !== undefined) {
    formData.append('query[activeTimeSec]', params.activeTimeSec.toString());
  }
  if (params.tagID !== undefined) {
    formData.append('query[tagID]', params.tagID.toString());
  }
  if (params.isShow !== undefined) {
    formData.append('query[isShow]', params.isShow.toString());
  }
  
  if (params.iconFile) {
    formData.append('query[iconFile]', params.iconFile);
  }

  return request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/upload/updateTreasureItem',
    method: 'post',
    data: formData,
    timeout: 0,
  });
};

/**
 * =========================
 * 成就任務條件類型
 * 對齊 Vue2：admin-web/src/api/treasureChestSystem.ts
 * =========================
 */
export enum AchievementTaskCondType {
  GameTotalBet = 'GameTotalBet',
  GameTotalWin = 'GameTotalWin',
  GameWinOdds = 'GameWinOdds',
  RegisterDays = 'RegisterDays',
}

export interface AchievementTaskCond {
  type: AchievementTaskCondType;
  value: number;
}

/**
 * 新增寶箱道具
 * - Vue2：addTreasureItem -> /AdminSystem/api/upload/addTreasureItem
 */
export const addTreasureItem = (params: {
  itemName: string;
  itemType: string;
  masterAgent: string;
  iconFile: File;
  price?: number;
  description?: string;
  tagID?: number;
  activeTimeSec?: number;
  currencyType: string;
  uniqueness: number;
}) => {
  const formData = new FormData();
  formData.append('server', 'treasureChestSystem');
  formData.append('actionName', 'addTreasureItem');

  formData.append('query[itemName]', params.itemName);
  formData.append('query[itemType]', params.itemType);
  formData.append('query[masterAgent]', params.masterAgent);
  formData.append('query[iconFile]', params.iconFile);
  formData.append('query[currencyType]', params.currencyType);
  formData.append('query[uniqueness]', params.uniqueness.toString());

  if (params.price !== undefined) {
    formData.append('query[price]', params.price.toString());
  }
  if (params.description !== undefined) {
    formData.append('query[description]', params.description);
  }
  if (params.tagID !== undefined) {
    formData.append('query[tagID]', params.tagID.toString());
  }
  if (params.activeTimeSec !== undefined) {
    formData.append('query[activeTimeSec]', params.activeTimeSec.toString());
  }

  return request<{ data: { result: boolean; treasureItemID?: string } }>({
    url: '/AdminSystem/api/upload/addTreasureItem',
    method: 'post',
    data: formData,
    requestType: 'form',
    timeout: 0,
  });
};

/**
 * 新增任務項目
 * - Vue2：addTaskItem -> /AdminSystem/api/action/addTaskItem
 */
export const addTaskItem = (params: {
  masterAgent: string;
  treasureItemID: string;
  condition: AchievementTaskCond;
  odds?: number;
}) =>
  request<{ data: { result: boolean } }>({
    url: '/AdminSystem/api/action/addTaskItem',
    method: 'post',
    data: {
      server: 'treasureChestSystem',
      actionName: 'addTaskItem',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });



