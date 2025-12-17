import { delay, http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker/locale/zh_CN';
import { serverApi, resultPageSuccess, resultSuccess, getQuery } from './_util';

interface CurrencyItem {
  id: number;
  account: string;
  currencyName: string;
  currencyCode: string;
  status: number;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
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

  http.post(serverApi('/adminAccount/currency'), async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<typeof currencyList[number]>;
    const nextId = currencyList.length + 1;
    const newCurrency = {
      id: nextId,
      account: body.account ?? `salesacc${nextId}`,
      currencyName: body.currencyName ?? 'UNKNOWN',
      currencyCode: body.currencyCode ?? 'UNK',
      status: body.status ?? 1,
      orderNo: body.orderNo ?? nextId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    currencyList.push(newCurrency);
    return HttpResponse.json(resultSuccess(newCurrency, { message: '新增成功' }));
  }),

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
