import { delay, http, HttpResponse } from 'msw';
import { serverApi } from './_util';
import { setCaptchaCode } from './user';

/**
 * 產生隨機驗證碼
 */
function generateRandomCode(): string {
  return Math.random().toString().slice(2, 6);
}

/**
 * 簡單的 SVG 驗證碼生成器
 * 使用 data URL 代替 Buffer（瀏覽器環境）
 */
function generateCaptchaSvg(code: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">
    <rect fill="#f0f0f0" width="100" height="50"/>
    <text x="50" y="35" font-size="24" font-weight="bold" text-anchor="middle" fill="#333">${code}</text>
    <line x1="0" y1="25" x2="100" y2="25" stroke="#999" stroke-width="1"/>
  </svg>`;

  // 使用 btoa 編碼為 base64（瀏覽器原生）
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

export default [
  // 獲取驗證碼圖片
  http.get(serverApi('/auth/captcha/img'), async ({ request }) => {
    const code = generateRandomCode();
    const captchaId = `captcha-${Math.random().toString(36).substring(7)}`;

    // 儲存驗證碼到記憶體（5分鐘過期）
    setCaptchaCode(captchaId, code);

    await delay(500);
    return HttpResponse.json({
      code: 200,
      message: '验证码获取成功',
      data: {
        img: generateCaptchaSvg(code),
        id: captchaId,
      },
    });
  }),
];
