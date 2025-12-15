/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 网站标题 */
  readonly VITE_APP_TITLE: string;
  /** 网站部署的目录 */
  readonly VITE_BASE_URL: string;
  /** API 接口路径 */
  readonly VITE_BASE_API_URL: string;
  /** socket 请求路径前缀 */
  readonly VITE_BASE_SOCKET_PATH: string;
  /** socket 命名空间 */
  readonly VITE_BASE_SOCKET_NSP: string;
  /** mock API 路徑 */
  readonly VITE_MOCK_API: string;
  /** 是否啟用 mock（開發/測試可開啟） */
  readonly VITE_ENABLE_MOCK?: string;
  /** 從 Vue 2 專案整合：AdminSystem API 基礎 URL */
  readonly VITE_APP_BASE_API?: string;
  /** 從 Vue 2 專案整合：CDN 基礎 URL */
  readonly VITE_APP_CDN_BASE_URL?: string;
  /** 是否在生產環境啟用 mock */
  readonly VITE_MOCK_IN_PROD?: string;
  /** 是否移除 console */
  readonly VITE_DROP_CONSOLE?: string;
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
