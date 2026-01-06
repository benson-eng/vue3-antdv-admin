import { request } from '@/utils/request';

/**
 * =========================================
 * Game Mission System API
 * 對齊來源：admin-web/src/api/task.ts
 * =========================================
 */

const server = 'gameMissionSystem';

export interface SetMissionSettingParams {
  masterAgent: string;
  settings: any[];
}

/**
 * 批量設定任務設定
 * 對齊 Vue2：setMissionSetting -> gameMissionSystem/bulkSetMissionSettings
 */
export const setMissionSetting = async (params: SetMissionSettingParams) =>
  request({
    url: '/AdminSystem/api/action/bulkSetMissionSettings',
    method: 'post',
    data: {
      server,
      actionName: 'bulkSetMissionSettings',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });


