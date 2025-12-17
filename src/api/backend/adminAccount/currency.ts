import { request } from '@/utils/request';

const adminAccountCurrencyApi = {
  list: '/api/adminAccount/currency',
  create: '/api/adminAccount/currency',
  update: '/api/adminAccount/currency',
  delete: '/api/adminAccount/currency',
};

export interface CurrencyItem {
  id: number;
  account: string;
  currencyName: string;
  currencyCode: string;
  status: number;
  orderNo: number;
  createdAt: string;
}

export interface CurrencyListResponse {
  items: CurrencyItem[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export const listCurrency = (params?: Record<string, unknown>) =>
  request<CurrencyListResponse>({
    url: adminAccountCurrencyApi.list,
    method: 'get',
    params,
  });

export const createCurrency = (data: Partial<CurrencyItem>) =>
  request({
    url: adminAccountCurrencyApi.create,
    method: 'post',
    data,
  });

export const updateCurrency = (id: number, data: Partial<CurrencyItem>) =>
  request({
    url: `${adminAccountCurrencyApi.update}/${id}`,
    method: 'put',
    data,
  });

export const deleteCurrency = (id: number) =>
  request({
    url: `${adminAccountCurrencyApi.delete}/${id}`,
    method: 'delete',
  });

export default {
  list: listCurrency,
  create: createCurrency,
  update: updateCurrency,
  delete: deleteCurrency,
};

