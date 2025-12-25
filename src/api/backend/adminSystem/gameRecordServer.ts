import { request } from '@/utils/request';

/**
 * AdminSystem / gameRecordReader
 * 來源：admin-web/src/api/gameRecordServer.ts（Vue2）
 */

export interface IGrandPrizeRecordsColumn {
  id: number;
  memberID: string;
  lobbyID: string;
  lobbyName?: string;
  masterAgent: string;
  gameID: string;
  totalBet: number;
  totalWin: number;
  odds: number;
  seatID: number;
  playDateTime: Date;
  isFavorite: boolean;
  createdAt: Date;
}

export interface IQueryGrandPrizeRecordParams {
  masterAgent: string;
  memberID?: string;
  gameID?: string;
  seatID?: string;
  date?: [Date, Date];
  page: number;
  limit: number;
}

export interface IQueryGrandPrizeRecordResponse {
  data: {
    items: IGrandPrizeRecordsColumn[];
    total?: number;
  };
}

/**
 * 查詢大獎紀錄
 */
export const queryGrandPrizeRecord = (params: IQueryGrandPrizeRecordParams) =>
  request<IQueryGrandPrizeRecordResponse>({
    url: '/AdminSystem/api/action/queryGrandPrizeRecord',
    method: 'post',
    data: {
      server: 'gameRecordReader',
      actionName: 'queryGrandPrizeRecord',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export default {
  queryGrandPrizeRecord,
};

