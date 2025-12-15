import axios, { CanceledError } from 'axios';
import { isString } from 'lodash-es';
import qs from 'qs';
import { message as $message, Modal } from 'ant-design-vue';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ResultEnum } from '@/enums/httpEnum';
import { useUserStore } from '@/store/modules/user';
import { useSSEStore } from '@/store/modules/sse';
import apiActionSetting from '@/config/apiActionSetting';
import { isMockEnabled } from '@/utils/mockSwitch';

export interface RequestOptions extends AxiosRequestConfig {
  /** 是否直接将数据从响应中提取出，例如直接返回 res.data，而忽略 res.code 等信息 */
  isReturnResult?: boolean;
  /** 请求成功是提示信息 */
  successMsg?: string;
  /** 请求失败是提示信息 */
  errorMsg?: string;
  /** 成功时，是否显示后端返回的成功信息 */
  showSuccessMsg?: boolean;
  /** 失败时，是否显示后端返回的失败信息 */
  showErrorMsg?: boolean;
  requestType?: 'json' | 'form';
}

const UNKNOWN_ERROR = '未知错误，请重试';

/** 真实请求的路径前缀 */
export const baseApiUrl = isMockEnabled ? '' : import.meta.env.VITE_BASE_API_URL;
/** AdminSystem API 基礎 URL（從 Vue 2 專案整合） */
export const adminSystemApiUrl = isMockEnabled
  ? ''
  : import.meta.env.VITE_APP_BASE_API || baseApiUrl;
/** mock请求路径前缀 */
// const baseMockUrl = import.meta.env.VITE_MOCK_API;

const controller = new AbortController();
const service = axios.create({
  baseURL: baseApiUrl,
  // adapter: 'fetch',
  timeout: 10000,
  signal: controller.signal,
  paramsSerializer(params) {
    return qs.stringify(params, { arrayFormat: 'brackets' });
  },
});

service.interceptors.request.use(
  (config) => {
    // 檢查是否是 AdminSystem API，如果是則使用不同的 baseURL
    const isAdminSystemApi = config.url?.includes('/AdminSystem/');
    if (isAdminSystemApi && adminSystemApiUrl) {
      // 動態設置 AdminSystem API 的 baseURL
      config.baseURL = adminSystemApiUrl;
    }
    
    const userStore = useUserStore();
    const token = userStore.token;
    if (token && config.headers) {
      // 支援兩種 token 格式：
      // 1. Authorization: Bearer ${token} (原有格式)
      // 2. X-Access-Token: ${token} (新整合格式)
      // 根據 API 路徑決定使用哪種格式
      if (isAdminSystemApi) {
        config.headers['X-Access-Token'] = token;
      } else {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    // 整合 apiActionSetting 邏輯（用於 spinner 控制）
    const { actionsUsingSpinner, actionGateWay } = apiActionSetting;
    const isApiGateWay = actionGateWay.some((gateway) => config.url?.includes(gateway));
    if (isApiGateWay) {
      // 取得 request action name
      let actionName: string = '';
      if (config.data) {
        if (config.data instanceof FormData) {
          actionName = (config.data.get('actionName') as string) || '';
        } else {
          actionName = (config.data as any).actionName || '';
        }
      }
      // 使用 store 執行 spinner，限制連續發出 API 請求
      if (actionsUsingSpinner.includes(actionName)) {
        // 如果需要狀態管理，可以在這裡設置
        // StatusModule.SET_ISREQUESTING(true);
      }
    }
    
    return config;
  },
  (error) => {
    Promise.reject(error);
  },
);

service.interceptors.response.use(
  (response: AxiosResponse<BaseResponse>) => {
    const res = response.data;
    
    // 處理 AdminSystem API 的回應格式（IVueResponse）
    const isAdminSystemApi = response.config.url?.includes('/AdminSystem/');
    if (isAdminSystemApi) {
      const data = res as any;
      // 檢查是否有 error 欄位（IVueResponse 格式）
      if (data.error) {
        const userStore = useUserStore();
        const { code, message: errorMsg } = data.error;
        
        // 處理特定的錯誤碼（認證失敗）
        if (code === 4 || code === 10012 || code === 10029) {
          userStore.resetToken();
          $message.error(errorMsg || '認證失敗，請重新登入');
          // 使用 Vue Router 進行跳轉
          window.location.href = '/#/login';
          return Promise.reject(data);
        } else {
          // 其他錯誤
          $message.error(errorMsg || '請求失敗');
          return Promise.reject(data);
        }
      }
      
      // 處理 spinner 邏輯
      const { actionsUsingSpinner, actionGateWay } = apiActionSetting;
      const isApiGateWay = actionGateWay.some((gateway) => response.config.url?.includes(gateway));
      if (isApiGateWay) {
        let actionName: string = '';
        if (response.config.data) {
          if (response.config.data instanceof FormData) {
            actionName = (response.config.data.get('actionName') as string) || '';
          } else {
            try {
              const requestData = typeof response.config.data === 'string' 
                ? JSON.parse(response.config.data) 
                : response.config.data;
              actionName = requestData.actionName || '';
            } catch (e) {
              actionName = '';
            }
          }
        }
        // 關閉spinner
        if (actionsUsingSpinner.includes(actionName)) {
          // StatusModule.SET_ISREQUESTING(false);
        }
      }
      
      // 返回原始回應（包含 data 和 error）
      return response;
    }

    // 原有邏輯：處理標準 API 回應格式
    // if the custom code is not 200, it is judged as an error.
    if (res.code !== ResultEnum.SUCCESS) {
      $message.error(res.message || UNKNOWN_ERROR);
      // Illegal token
      if ([1101, 1105].includes(res.code)) {
        // to re-login
        Modal.confirm({
          title: '警告',
          content: res.message || '账号异常，您可以取消停留在该页上，或重新登录',
          okText: '重新登录',
          cancelText: '取消',
          onOk: () => {
            localStorage.clear();
            window.location.reload();
          },
        });
      }

      // throw other
      const error = new Error(res.message || UNKNOWN_ERROR) as Error & { code: any };
      error.code = res.code;
      return Promise.reject(error);
    } else {
      const sseStore = useSSEStore();
      sseStore.setServerConnectStatus(true);
      return response;
    }
  },
  (error) => {
    if (!(error instanceof CanceledError)) {
      // 处理 422 或者 500 的错误异常提示
      const errMsg = error?.response?.data?.message ?? UNKNOWN_ERROR;
      $message.error({ content: errMsg, key: errMsg });
      error.message = errMsg;
    }
    return Promise.reject(error);
  },
);

type BaseResponse<T = any> = Omit<API.ResOp, 'data'> & {
  data: T;
};

export function request<T = any>(
  url: string,
  config: { isReturnResult: false } & RequestOptions,
): Promise<BaseResponse<T>>;
export function request<T = any>(
  url: string,
  config: RequestOptions,
): Promise<BaseResponse<T>['data']>;
export function request<T = any>(
  config: { isReturnResult: false } & RequestOptions,
): Promise<BaseResponse<T>>;
export function request<T = any>(config: RequestOptions): Promise<BaseResponse<T>['data']>;
/**
 *
 * @param url - request url
 * @param config - AxiosRequestConfig
 */
export async function request(_url: string | RequestOptions, _config: RequestOptions = {}) {
  const url = isString(_url) ? _url : _url.url;
  const config = isString(_url) ? _config : _url;
  try {
    // 兼容 from data 文件上传的情况
    const { requestType, isReturnResult = true, ...rest } = config;

    const response = (await service.request({
      url,
      ...rest,
      headers: {
        ...rest.headers,
        ...(requestType === 'form' ? { 'Content-Type': 'multipart/form-data' } : {}),
      },
    })) as AxiosResponse<BaseResponse>;
    const { data } = response;
    const { code, message } = data || {};

    const hasSuccess = data && Reflect.has(data, 'code') && code === ResultEnum.SUCCESS;

    if (hasSuccess) {
      const { successMsg, showSuccessMsg } = config;
      if (successMsg) {
        $message.success(successMsg);
      } else if (showSuccessMsg && message) {
        $message.success(message);
      }
    }

    // 页面代码需要获取 code，data，message 等信息时，需要将 isReturnResult 设置为 false
    if (!isReturnResult) {
      return data;
    } else {
      return data.data;
    }
  } catch (error: any) {
    return Promise.reject(error);
  }
}
