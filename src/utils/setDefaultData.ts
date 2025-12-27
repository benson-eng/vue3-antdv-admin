import type { ISettings } from '@/api/backend/agentHubManager';

/**
 * 取得預設分成設定
 * @param stationMasterName 站台主名稱
 * @param use 使用類型：'station' | 'family'
 * @param agentName 代理名稱（可選）
 * @returns 預設設定陣列
 */
export function getDefDistAcctSettings(
  stationMasterName: string,
  use: 'station' | 'family',
  agentName?: string,
): ISettings[] {
  const re: ISettings[] = [
    {
      stationMasterName,
      name: 'Purchase',
      type: 'Purchase',
      subType: 'Purchase',
      description: '儲值預設分成比例',
      percentage: 0.15, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'ServiceFee',
      type: 'ServiceFee',
      subType: 'ServiceFee',
      description: '手續費預設分成比例',
      percentage: 0.5, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'SMSServiceCost',
      type: 'SMSServiceCost',
      subType: 'SMSServiceCost',
      description: '服務簡訊費成本預設分成比例',
      percentage: 0.1, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'PurchaseServiceCost',
      type: 'PurchaseServiceCost',
      subType: 'PurchaseServiceCost',
      description: '服務金流手續費成本預設分成比例',
      percentage: 0.3, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'Bonus',
      type: 'Bonus',
      subType: 'Bonus',
      description: '紅利預設分成比例',
      percentage: 0.5, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'GameWinLose',
      type: 'GameWinLose',
      subType: 'GameWinLose',
      description: '遊戲輸贏預設分成比例',
      percentage: 0.15, // ex: 10% => 0.1
      agentName,
    },
  ];
  if (use === 'station') {
    // 預備環境客製使用
  }
  else if (use === 'family') {
    // 預備環境客製使用
  }
  return re;
}

