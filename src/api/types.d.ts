// API 回應類型定義
// 從 Vue 2 + Element UI 專案整合

export interface IVueResponse {
  error?: {
    code: number;
    message: string;
  };
  data?: any;
  result?: string | boolean;
}

