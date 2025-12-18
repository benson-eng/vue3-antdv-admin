import { request } from '@/utils/request';

export interface AdminAccountItem {
  id: number;
  account: string;
}

export const getMasterAgentList = () =>
  request<AdminAccountItem[]>({
    url: '/AdminSystem/api/getMasterAgentListByAccount',
    method: 'post',
    data: {},
  });

