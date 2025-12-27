import { request } from '@/utils/request';

/**
 * =========================================
 * Financial System API
 * 來源：admin-web/src/api/financialSystem.ts（Vue2）
 * =========================================
 */

export interface FinancialReportsParams {
  startSearchTime: Date;
  endSearchTime: Date;
  level: string;
  to: string;
  masterAgent?: string;
  magent?: string;
}

export interface FinancialReportsResponse {
  data?: any[];
  result?: boolean;
  value?: any[];
}

/**
 * 取得財務報表資料
 * 後端：POST /AdminSystem/api/action/financialReports
 */
export const financialSystemGetData = (params: FinancialReportsParams) =>
  request<FinancialReportsResponse>({
    url: '/AdminSystem/api/action/financialReports',
    method: 'post',
    data: {
      server: 'financialSystem',
      actionName: 'financialReports',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

export interface OperatingReportsParams {
  startSearchTime: Date;
  endSearchTime: Date;
  masterAgent: string;
  agent?: string;
}

export const operatingReports = (params: OperatingReportsParams) =>
  request<any>({
    url: '/AdminSystem/api/action/operatingReports',
    method: 'post',
    data: {
      server: 'financialSystem',
      actionName: 'operatingReports',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

