import { request } from '@/utils/request';

/**
 * =========================================
 * API Path 定義（新制，未來可切 RESTful）
 * =========================================
 */
const adminAccountCurrencyApi = {
  list: '/api/adminAccount/currency',
  create: '/api/adminAccount/currency',
  update: '/api/adminAccount/currency',
  delete: '/api/adminAccount/currency',
} as const;
void adminAccountCurrencyApi;

/**
 * =========================================
 * 資料型別定義
 * =========================================
 */
export interface CurrencyItem {
  id: number;
  currencyIndex: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CurrencyListResponse {
  items: CurrencyItem[];
  meta: {
    totalItems: number;
  };
}

/**
 * Vue2 舊 API 使用的 payload
 */
export interface ICurrencyPayload {
  adminAccountId: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  currencyIndex?: number;
}

/**
 * =========================================
 * 【主要使用】列表 API（轉換後統一格式）
 * 對應後端：POST /AdminSystem/api/getCurrencyType
 * =========================================
 */
export const listCurrency = async (
  params?: { masterAgent?: string }
): Promise<CurrencyListResponse> => {
  const res = await request<any>({
    url: '/AdminSystem/api/getCurrencyType',
    method: 'post',
    data: params,
  });

  /**
   * 實際後端回傳格式：
   * {
   *   data: [{
   *     list: CurrencyItem[],
   *     count: number,
   *     masterAgent,
   *     masterAgentId
   *   }]
   * }
   */
  
  const raw = res?.[0];

  const items =
    raw?.list?.map((item: CurrencyItem) => ({
      ...item,
      masterAgent: raw.masterAgent,
      adminAccountId:raw.masterAgentId
    })) ?? [];

  return {
    items,
    meta: {
      totalItems: raw?.count ?? 0,
    },
  } as CurrencyListResponse;
};

/**
 * =========================================
 * Vue2 舊 API（保留，不動）
 * =========================================
 */

// 原：getCurrencyType
export const getCurrencyType = (data: { masterAgent?: string }) =>
  request({
    url: '/AdminSystem/api/getCurrencyType',
    method: 'post',
    data,
  });

// 原：createCurrencyType
export const createCurrencyType = (data: ICurrencyPayload) =>
  request({
    url: '/AdminSystem/api/createCurrencyType',
    method: 'post',
    data,
  });

// 原：updateCurrencyType
export const updateCurrencyType = (data: {
  id: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
}) =>
  request({
    url: '/AdminSystem/api/updateCurrencyType',
    method: 'post',
    data,
  });

// 原：deleteCurrencyType
export const deleteCurrencyType = (data: {
  id: number;
  masterAgent: string;
}) =>
  request({
    url: '/AdminSystem/api/deleteCurrencyType',
    method: 'post',
    data,
  });

/**
 * =========================================
 * 新制 API（Vue3 / 新頁面建議使用）
 * ⚠️ 目前後端尚未實作時請勿啟用
 * =========================================
 */

// export const createCurrency = (data: Partial<CurrencyItem>) =>
//   request({
//     url: adminAccountCurrencyApi.create,
//     method: 'post',
//     data,
//   });

// export const updateCurrency = (id: number, data: Partial<CurrencyItem>) =>
//   request({
//     url: `${adminAccountCurrencyApi.update}/${id}`,
//     method: 'put',
//     data,
//   });

// export const deleteCurrency = (id: number) =>
//   request({
//     url: `${adminAccountCurrencyApi.delete}/${id}`,
//     method: 'delete',
//   });

/**
 * =========================================
 * Default export（給 service / composable 用）
 * =========================================
 */
export default {
  list: listCurrency,

  // Vue2 舊 API
  getCurrencyType,
  createCurrencyType,
  updateCurrencyType,
  deleteCurrencyType,
};
