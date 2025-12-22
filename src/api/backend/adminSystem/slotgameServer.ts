import { request } from '@/utils/request';

/**
 * AdminSystem / slotgameServer
 * 來源：admin-web/src/api/slotgameServer.ts（Vue2）
 *
 * 本檔目前僅先移植 giveAway 頁面會用到的功能：
 * - getConfigItem(forceBingoList)
 * - forceBingo
 */

export interface GameSettingItem {
  name: string;
  type: 'checkBox' | 'range' | 'list';
  value: Array<number | string>;
}

export interface ForceBingoPayload {
  forceType?: string;
  debugStrip?: number[];
}

export interface GetConfigSettingResponse {
  items: Array<number | number[]>;
  gameID: string;
  updatedAt?: string;
}

export const forceBingo = (gameID: string, memberID: string, forceBingoPayload: ForceBingoPayload) =>
  request({
    url: '/AdminSystem/api/action/forceBingo',
    method: 'post',
    data: {
      server: gameID,
      actionName: 'forceBingo',
      query: JSON.stringify({
        gameID,
        memberID,
        forceBingo: forceBingoPayload,
      }),
    },
    timeout: 0,
  });

export const getConfigItem = (gameID: string, currencyType: string, item: string) =>
  request<GameSettingItem[]>({
    url: '/AdminSystem/api/action/getConfigItem',
    method: 'post',
    data: {
      server: gameID,
      actionName: 'getConfigItem',
      query: JSON.stringify({
        // 對齊 Vue2：後端會需要 userID（沿用 9999）
        userID: '9999',
        currencyType,
        item,
      }),
    },
    timeout: 60 * 1000,
  });

/**
 * 對齊 Vue2：admin-web/src/api/slotgameServer.ts -> getConfigSetting
 * 用於讀取遊戲規格設定（rtp/maxBet/betLimit...）
 */
export const getConfigSetting = (gameID: string, masterAgent: string, currencyType: string, items: string[]) =>
  request<GetConfigSettingResponse>({
    url: '/AdminSystem/api/action/getConfigSetting',
    method: 'post',
    data: {
      server: gameID,
      actionName: 'getConfigSetting',
      query: JSON.stringify({
        // 對齊 Vue2：後端會需要 userID（沿用 9999）
        userID: '9999',
        gameID,
        masterAgent,
        currencyType,
        items,
      }),
    },
    timeout: 0,
  });

export interface SetConfigSettingResponse {
  items: string[];
  success: boolean[];
  updatedAt: string;
}

/**
 * 對齊 Vue2：admin-web/src/api/slotgameServer.ts -> setConfigSetting
 * 用於寫入遊戲規格設定（支援 updatedAt 樂觀鎖）
 */
export const setConfigSetting = (
  gameID: string,
  masterAgent: string,
  currencyType: string,
  items: string[],
  data: Array<string | number | string[] | number[] | boolean | null>,
  updatedAt?: Date | string,
) =>
  request<SetConfigSettingResponse>({
    url: '/AdminSystem/api/action/setConfigSetting',
    method: 'post',
    data: {
      server: gameID,
      actionName: 'setConfigSetting',
      query: JSON.stringify({
        // 對齊 Vue2：後端會需要 userID（沿用 9999）
        userID: '9999',
        masterAgent,
        currencyType,
        items,
        data,
        updatedAt,
      }),
    },
    timeout: 0,
  });

export default {
  forceBingo,
  getConfigItem,
  getConfigSetting,
  setConfigSetting,
};

