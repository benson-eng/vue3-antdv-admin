import { request } from '@/utils/request';

export interface ProxyChannelItem {
  channelName: string;
  isEnabled: boolean;
  [key: string]: any;
}

export const queryProxyChannelAction = (params: { masterAgent: string; channelName?: string }) =>
  request<ProxyChannelItem[]>({
    url: '/AdminSystem/api/action/queryProxyChannelAction',
    method: 'post',
    data: {
      server: 'billBoardSystem',
      actionName: 'queryProxyChannelAction',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export const editProxyChannelAction = (params: {
  masterAgent: string;
  agentConfigs?: { channelName: string; isEnabled: boolean }[];
}) =>
  request<any>({
    url: '/AdminSystem/api/action/editProxyChannelAction',
    method: 'post',
    data: {
      server: 'billBoardSystem',
      actionName: 'editProxyChannelAction',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  queryProxyChannelAction,
  editProxyChannelAction,
};




