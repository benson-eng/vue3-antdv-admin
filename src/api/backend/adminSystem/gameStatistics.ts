import { request } from '@/utils/request';

/**
 * AdminSystem / gameStatistics
 * 來源：admin-web/src/api/gameStatistics.ts（Vue2）
 */

export interface IGetStatisticsInputs {
  startSearchTime: Date;
  endSearchTime: Date;
  optionValue: string;
  openClose?: string;
  memberID?: string;
  agent?: string;
  agentID?: string;
  masterAgent?: string;
  gameType?: string;
  gameID?: string;
  countType?: string;
  currencyType?: string;
  subGameID?: string;
  shareholder?: string;
}

export interface IGetStatisticsResponse {
  items: Array<{
    totalBet: number;
    totalWinlose: number;
    [key: string]: any;
  }>;
}

export const getStatistics = (params: IGetStatisticsInputs) =>
  request<IGetStatisticsResponse>({
    url: '/AdminSystem/api/action/gameStaticsGetData',
    method: 'post',
    data: {
      server: 'gameStatistics',
      actionName: 'gameStaticsGetData',
      query: JSON.stringify(params),
    },
  });

export default {
  getStatistics,
};

