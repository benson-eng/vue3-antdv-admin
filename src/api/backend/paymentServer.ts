import { request } from '@/utils/request';

/**
 * =========================================
 * Payment Server API
 * 對齊來源：admin-web/src/api/paymentServerAppItem.ts
 * =========================================
 */

const server = 'paymentServer';

export interface PaymentServiceCostItem {
  paymentType: string;
  paymentTypeName: string;
}

export interface PaymentServiceCostItemResponse {
  data: PaymentServiceCostItem[];
}

export interface PaymentServiceCostSetting {
  id?: number;
  masterAgent: string;
  paymentType: string;
  paymentTypeName: string;
  serviceCost: number | string;
}

export interface SetPaymentServiceCostParams {
  settings: PaymentServiceCostSetting[];
}

/**
 * 取得支付服務成本項目列表
 * 對齊 Vue2：getPaymentServiceCostItems -> paymentServer/getPaymentServiceCostItems
 */
export const getPaymentServiceCostItems = async (params: {} = {}) =>
  request<PaymentServiceCostItemResponse>({
    url: '/AdminSystem/api/action/getPaymentServiceCostItems',
    method: 'post',
    data: {
      server,
      actionName: 'getPaymentServiceCostItems',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });

/**
 * 設定支付服務成本
 * 對齊 Vue2：setPaymentServiceCost -> paymentServer/setPaymentServiceCost
 */
export const setPaymentServiceCost = (params: SetPaymentServiceCostParams) =>
  request({
    url: '/AdminSystem/api/action/setPaymentServiceCost',
    method: 'post',
    data: {
      server,
      actionName: 'setPaymentServiceCost',
      query: JSON.stringify(params),
    },
    timeout: 0,
  });
