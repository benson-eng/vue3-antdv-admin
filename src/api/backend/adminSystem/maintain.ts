import { request } from '@/utils/request';

export interface GlobalMaintainStatus {
  isMaintained: boolean;
  expectedMaintenanceEndTime?: string | number | null;
}

export const getGlobalMaintainStatus = () =>
  request<GlobalMaintainStatus>({
    url: '/AdminSystem/api/getGlobalMaintainStatus',
    method: 'post',
    timeout: 0,
  });

export default {
  getGlobalMaintainStatus,
};



