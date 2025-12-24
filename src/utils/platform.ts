import { adminSystemApiUrl, baseApiUrl } from '@/utils/request';

/**
 * Vue2 admin-web 的 BaseName / platform 判斷邏輯（精簡遷移版）
 *
 * - BaseName 用於特定站台差異化（例如 vipSetting2 欄位顯示）
 * - distribution 平台判斷用於隱藏部分欄位（非超管）
 */

function getHostDomainFromLocation(): string {
  // Vue2 邏輯：location.hostname.split("admin")[1]
  // 例如：admin.xxx.com -> .xxx.com
  // 例如：admin-test.xxx.com -> -test.xxx.com（仍可用於拼 api domain）
  const hostname = window.location.hostname || '';
  const parts = hostname.split('admin');
  if (parts.length < 2) {
    return '';
  }
  return parts.slice(1).join('admin');
}

export function getAdminApiBaseUrl(): string {
  const hostDomain = getHostDomainFromLocation();
  if (hostDomain) {
    return `${window.location.protocol}//admin-api${hostDomain}`;
  }
  // fallback：走 env 設定（Vue3）
  return adminSystemApiUrl || baseApiUrl || '';
}

export function getBaseName(): string {
  const apiBase = getAdminApiBaseUrl();
  if (!apiBase) {
    return '';
  }

  // Vue2: BaseName = apiBaseURL.replace("https://admin-api.", "").replace(".", "").split("/")[0];
  try {
    const url = new URL(apiBase, window.location.origin);
    let host = url.hostname || '';
    host = host.replace(/^admin-api\./, '');
    host = host.replace('.', ''); // 只移除第一個 '.'，對齊 Vue2 行為
    return host.split('/')[0];
  }
  catch {
    return apiBase
      .replace(/^https?:\/\/admin-api\./, '')
      .replace('.', '')
      .split('/')[0];
  }
}

export function isDistributionPlatform(): boolean {
  const baseName = getBaseName();
  // Vue2 邏輯：BaseName 命中清單 或 env PLATFORM=distribution
  const distributionBaseNameSet = new Set(['luck-999com', 'ambmhcom', 'jwl168com', 'ww688bet']);
  if (distributionBaseNameSet.has(baseName)) {
    return true;
  }

  // env 可能不存在；以 any 讀取避免型別噴錯
  const envPlatform = (import.meta.env as any).VITE_APP_PLATFORM as string | undefined;
  return envPlatform === 'distribution';
}



