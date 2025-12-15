import { faker } from '@faker-js/faker/locale/zh_CN';
import { delay, http, HttpResponse } from 'msw';
import { serverApi } from './_util';

/**
 * 簡單的記憶體儲存，用於儲存已產生的驗證碼（開發環境）
 */
const captchaStore = new Map<string, string>();

/**
 * 從 captcha.ts 獲取存儲的驗證碼（此處定義供共用）
 */
export function getCaptchaStore() {
  return captchaStore;
}

/**
 * 設定驗證碼儲存（由 captcha.ts 呼叫）
 */
export function setCaptchaCode(captchaId: string, code: string) {
  captchaStore.set(captchaId, code);
  setTimeout(() => captchaStore.delete(captchaId), 5 * 60 * 1000);
}

const createLoginResponse = () => ({
  accessToken: `mock-jwt-token-${Math.random().toString(36).substring(7)}`,
  token: `mock-jwt-token-${Math.random().toString(36).substring(7)}`,
  userData: {
    id: 1,
    username: 'admin',
    masterAgent: 'mock-master',
    agent: 'mock-agent',
    currencies: ['USD', 'EUR'],
  },
});

const loginHandler = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as any;
  const account = body.account || body.username;
  const password = body.password;
  const verifyCode = body.verifyCode;
  const captchaId = body.captchaId;

  if (!account || !password) {
    return HttpResponse.json(
      {
        code: -1,
        message: '帳號或密碼不能為空',
        data: null,
      },
      { status: 400 },
    );
  }

  if (verifyCode || captchaId) {
    if (!verifyCode || !captchaId) {
      return HttpResponse.json(
        {
          code: -1,
          message: '驗證碼與驗證碼 ID 必須同時提供',
          data: null,
        },
        { status: 400 },
      );
    }

    const storedCode = captchaStore.get(captchaId);
    if (!storedCode || storedCode !== verifyCode) {
      return HttpResponse.json(
        {
          code: -1,
          message: '驗證碼錯誤或已過期',
          data: null,
        },
        { status: 400 },
      );
    }
    captchaStore.delete(captchaId);
  }

  if (account === 'admin' && password === 'a123456') {
    await delay(1000);
    return HttpResponse.json({
      code: 200,
      message: '登入成功',
      data: createLoginResponse(),
    });
  }

  return HttpResponse.json(
    {
      code: -1,
      message: '用戶名或密碼錯誤',
      data: null,
    },
    { status: 401 },
  );
};

const getUserInfoResponse = () =>
  HttpResponse.json({
    code: 200,
    message: '获取成功',
    data: {
      roles: ['admin'],
      name: '管理员',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/WhxWfqPqFOtEFYAKBlFJ.jpg',
      introduction: 'Mock 后台管理员',
      email: 'admin@example.com',
      level: 4,
      website: 'https://example.com',
      masterAgent: 'mock-master',
      agent: 'mock-agent',
      currencies: ['USD', 'EUR'],
      account: 'admin',
      shareholder: { account: 'mock-shareholder' },
    },
  })

const logoutResponse = () =>
  HttpResponse.json({
    code: 200,
    message: '登出成功',
    data: null,
  })

const backendKeyResponse = () =>
  HttpResponse.json({
    code: 200,
    message: 'BackendKey 取得成功',
    data: {
      id: 123,
      secret: 'mock-secret',
    },
  })

export default [
  http.get(serverApi('/user/:id'), async () => {
    await delay(1000);
    return HttpResponse.json(
      Array.from({ length: 10 }).map(() => ({
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
        address: faker.location.streetAddress(),
      })),
    );
  }),
  http.post(serverApi('/auth/login'), loginHandler),
  http.post('/AdminSystem/api/login', loginHandler),
  http.post(serverApi('/auth/getUserInfo'), async () => await getUserInfoResponse()),
  http.post('/AdminSystem/api/getUserInfo', async () => await getUserInfoResponse()),
  http.post(serverApi('/auth/logout'), async () => await logoutResponse()),
  http.post('/AdminSystem/api/logout', async () => await logoutResponse()),
  http.post(serverApi('/auth/getBackendKey'), async () => await backendKeyResponse()),
  http.post('/AdminSystem/api/getBackendKey', async () => await backendKeyResponse()),
];