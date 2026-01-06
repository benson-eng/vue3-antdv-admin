import { request } from '@/utils/request';

/**
 * Vue2 對應：admin-web/src/api/JPServer.ts
 * 僅先遷移 agentSettings 用到的 jpServer002 設定讀寫
 */

export const getConfig2SettingAction = (params: { currencyType: string; masterAgent: string; items: string[] }) =>
  request<unknown[]>({
    url: '/AdminSystem/api/action/getConfigSetting',
    method: 'post',
    data: {
      server: 'jpServer002',
      actionName: 'getConfigSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const setConfig2Setting = (params: { currencyType: string; masterAgent: string; items: any[] }) =>
  request<any>({
    url: '/AdminSystem/api/action/setConfigSetting',
    method: 'post',
    data: {
      server: 'jpServer002',
      actionName: 'setConfigSetting',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  getConfig2SettingAction,
  setConfig2Setting,
};





