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

export default {
  forceBingo,
  getConfigItem,
};
