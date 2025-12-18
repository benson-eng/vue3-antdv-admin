import { delay, http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker/locale/zh_CN';
import { serverApi, resultPageSuccess, resultSuccess, getQuery } from './_util';

interface CurrencyItem {
  id: number;
  account?: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol?: string;
  status: number;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
  masterAgent?: string;
}

const currencyList: CurrencyItem[] = Array.from({ length: 8 }).map((_, index) => ({
  id: index + 1,
  account: `salesacc${index + 1}`,
  currencyName: ['CNY', 'USD', 'EUR', 'JPY', 'KRW'][index % 5],
  currencyCode: ['CNY', 'USD', 'EUR', 'JPY', 'KRW'][index % 5],
  status: index % 2,
  orderNo: index + 1,
  createdAt: faker.date.past({ years: 2 }).toISOString(),
  updatedAt: faker.date.recent({ days: 30 }).toISOString(),
}));

export default [
  http.get(serverApi('/adminAccount/currency'), async ({ request }) => {
    await delay(200);
    const query = getQuery(request);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    return HttpResponse.json(resultPageSuccess(page, pageSize, currencyList));
  }),

  // POST handler 處理所有 POST 請求：getCurrencyType, createCurrencyType, updateCurrencyType, deleteCurrencyType
  http.post(serverApi('/adminAccount/currency'), async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as
      | { masterAgent?: string }
      | Partial<typeof currencyList[number]>
      | { currencyName: string; currencySymbol: string; masterAgent?: string }
      | { id: number; currencyName: string; currencySymbol: string }
      | { id: number; masterAgent: string };
    
    // 判斷操作類型
    // 1. getCurrencyType: 只有 masterAgent，查詢列表
    if ('masterAgent' in body && !('currencyName' in body) && !('id' in body)) {
      const query = getQuery(request);
      let filteredList = currencyList;
      if (body.masterAgent) {
        filteredList = currencyList.filter((item) => item.account === body.masterAgent);
      }
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 10;
      return HttpResponse.json(resultPageSuccess(page, pageSize, filteredList));
    }
    // 2. updateCurrencyType: 有 id, currencyName, currencySymbol
    else if ('id' in body && 'currencyName' in body && 'currencySymbol' in body && !('masterAgent' in body)) {
      const updateBody = body as { id: number; currencyName: string; currencySymbol: string };
      const idx = currencyList.findIndex((item) => item.id === updateBody.id);
      if (idx === -1) {
        return HttpResponse.json({ code: 404, message: '資料不存在' }, { status: 404 });
      }
      currencyList[idx] = {
        ...currencyList[idx],
        currencyName: updateBody.currencyName,
        currencySymbol: updateBody.currencySymbol,
        updatedAt: new Date().toISOString(),
      };
      return HttpResponse.json(resultSuccess(currencyList[idx], { message: '更新成功' }));
    }
    // 3. deleteCurrencyType: 有 id 和 masterAgent
    else if ('id' in body && 'masterAgent' in body && !('currencyName' in body)) {
      const deleteBody = body as { id: number; masterAgent: string };
      const idx = currencyList.findIndex((item) => item.id === deleteBody.id);
      if (idx === -1) {
        return HttpResponse.json({ code: 404, message: '資料不存在' }, { status: 404 });
      }
      currencyList.splice(idx, 1);
      return HttpResponse.json(resultSuccess(null, { message: '刪除成功' }));
    }
    // 4. createCurrency 或 createCurrencyType: 新增資料
    else {
      const nextId = currencyList.length + 1;
      const newCurrency: CurrencyItem = {
        id: nextId,
        account: 'account' in body ? (body.account ?? `salesacc${nextId}`) : `salesacc${nextId}`,
        currencyName: 'currencyName' in body ? (body.currencyName ?? 'UNKNOWN') : 'UNKNOWN',
        currencyCode: 'currencyCode' in body ? (body.currencyCode ?? 'UNK') : 'UNK',
        currencySymbol: 'currencySymbol' in body ? body.currencySymbol : undefined,
        status: 'status' in body ? (body.status ?? 1) : 1,
        orderNo: 'orderNo' in body ? (body.orderNo ?? nextId) : nextId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      currencyList.push(newCurrency);
      return HttpResponse.json(resultSuccess(newCurrency, { message: '新增成功' }));
    }
  }),

  // PUT handler 處理 updateCurrency (RESTful API)
  http.put(serverApi('/adminAccount/currency/:id'), async ({ params, request }) => {
    await delay(200);
    const { id } = params;
    const body = (await request.json()) as Partial<typeof currencyList[number]>;
    const idx = currencyList.findIndex((item) => item.id === Number(id));
    if (idx === -1) {
      return HttpResponse.json({ code: 404, message: '資料不存在' }, { status: 404 });
    }
    currencyList[idx] = {
      ...currencyList[idx],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(resultSuccess(currencyList[idx], { message: '更新成功' }));
  }),

  // DELETE handler 處理 deleteCurrency (RESTful API)
  http.delete(serverApi('/adminAccount/currency/:id'), async ({ params }) => {
    await delay(200);
    const { id } = params;
    const idx = currencyList.findIndex((item) => item.id === Number(id));
    if (idx === -1) {
      return HttpResponse.json({ code: 404, message: '資料不存在' }, { status: 404 });
    }
    currencyList.splice(idx, 1);
    return HttpResponse.json(resultSuccess(null, { message: '刪除成功' }));
  }),
];
