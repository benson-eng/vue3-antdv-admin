// API 回應類型定義
// 來源：src/api/types.d.ts

export interface IVueResponse {
  error?: {
    code: number;
    message: string;
  };
  data?: any;
  result?: string | boolean;
}

