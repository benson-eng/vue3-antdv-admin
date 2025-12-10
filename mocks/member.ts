import { http, HttpResponse, delay } from 'msw';
import { faker } from '@faker-js/faker/locale/zh_CN';
import { serverApi, resultPageSuccess, resultSuccess, getQuery } from './_util';

// 模擬會員數據
const memberList = Array.from({ length: 400 }).map((_, index) => {
  const statuses = [0, 1];
  const memberLevels = ['金流內層', '金流全開', '大額入款', '套利總級', '疑似套利'];
  const vipLevels = ['VIP2', 'VIP8', '一般會員'];
  const returnWaterLevels = ['真人返2%', '不返水'];
  const registerSources = ['pc', 'h5', 'app'];
  const lines = ['line1', 'line2'];
  
  const status = faker.helpers.arrayElement(statuses);
  const memberLevel = faker.helpers.arrayElement(memberLevels);
  const vipLevel = faker.helpers.arrayElement(vipLevels);
  
  return {
    id: index + 1,
    account: `user${String(index + 1).padStart(2, '0')}`,
    status,
    superior: index > 0 ? `ag${String(faker.number.int({ min: 1, max: 10 })).padStart(2, '0')}` : '',
    memberLevel,
    returnWaterLevel: faker.helpers.arrayElement(returnWaterLevels),
    vipLevel,
    promotionCode: `/uplskif090ow3rr${index + 2}`,
    superiorAccount: index > 0 ? `user${String(faker.number.int({ min: 1, max: 99 })).padStart(2, '0')}` : '',
    createdAt: faker.date.past({ years: 1 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    // 搜索欄位
    realName: faker.person.fullName(),
    phone: `09${faker.string.numeric(8)}`,
    idCard: faker.string.alphanumeric(10).toUpperCase(),
    line: faker.helpers.arrayElement(lines),
    registerIp: faker.internet.ipv4(),
    lastLoginIp: faker.internet.ipv4(),
    registerTime: faker.date.past({ years: 1 }).toISOString(),
    lastLoginTime: faker.date.recent({ days: 7 }).toISOString(),
    registerSource: faker.helpers.arrayElement(registerSources),
    depositCount: faker.number.int({ min: 0, max: 50 }),
    firstDeposit: faker.datatype.boolean() ? 'completed' : 'no_deposit',
    firstWithdraw: faker.datatype.boolean() ? 'completed' : 'no_withdraw',
  };
});

export default [
  // 獲取會員列表
  http.get(serverApi('/member/list'), async ({ request }) => {
    await delay(300);
    const query = getQuery(request);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    
    return HttpResponse.json(resultPageSuccess(page, pageSize, memberList));
  }),

  // 獲取會員詳情
  http.get(serverApi('/member/:id'), async ({ params }) => {
    await delay(100);
    const { id } = params;
    const member = memberList.find((item) => item.id === Number(id));
    
    if (member) {
      return HttpResponse.json(resultSuccess(member));
    }
    return HttpResponse.json({ code: 404, message: '會員不存在' }, { status: 404 });
  }),

  // 新增會員
  http.post(serverApi('/member'), async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Record<string, any>;
    const newMember = {
      id: memberList.length + 1,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memberList.push(newMember as any);
    
    return HttpResponse.json(resultSuccess(newMember, { message: '新增成功' }));
  }),

  // 更新會員
  http.put(serverApi('/member/:id'), async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as Record<string, any>;
    const index = memberList.findIndex((item) => item.id === Number(id));
    
    if (index !== -1) {
      memberList[index] = {
        ...memberList[index],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      return HttpResponse.json(resultSuccess(memberList[index], { message: '更新成功' }));
    }
    return HttpResponse.json({ code: 404, message: '會員不存在' }, { status: 404 });
  }),

  // 刪除會員
  http.delete(serverApi('/member/:id'), async ({ params }) => {
    await delay(300);
    const { id } = params;
    const index = memberList.findIndex((item) => item.id === Number(id));
    
    if (index !== -1) {
      memberList.splice(index, 1);
      return HttpResponse.json(resultSuccess(null, { message: '刪除成功' }));
    }
    return HttpResponse.json({ code: 404, message: '會員不存在' }, { status: 404 });
  }),
];
