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
  http.post(serverApi('/auth/login'), async ({ request }) => {
    const body = await request.json() as any;
    const { username, password, verifyCode, captchaId } = body;

    // 驗證必填字段
    if (!username || !password || !verifyCode || !captchaId) {
      return HttpResponse.json({
        code: -1,
        message: '用戶名、密碼、驗證碼不能為空',
        data: null,
      }, { status: 400 });
    }

    // 驗證驗證碼
    const storedCode = captchaStore.get(captchaId);
    if (!storedCode || storedCode !== verifyCode) {
      return HttpResponse.json({
        code: -1,
        message: '驗證碼錯誤或已過期',
        data: null,
      }, { status: 400 });
    }

    // 簡單的用戶驗證（開發環境）
    if (username === 'admin' && password === 'a123456') {
      // 驗證成功後刪除驗證碼
      captchaStore.delete(captchaId);

      await delay(1000);
      return HttpResponse.json({
        code: 200,
        message: '登入成功',
        data: {
          token: `mock-jwt-token-${Math.random().toString(36).substring(7)}`,
        },
      });
    }

    return HttpResponse.json({
      code: -1,
      message: '用戶名或密碼錯誤',
      data: null,
    }, { status: 401 });
  }),
];