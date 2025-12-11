import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { message } from "ant-design-vue";
import { useUserStore } from "@/stores/user";
import { removeToken } from "@/utils/cookies";
import apiActionSetting from "@/config/apiActionSetting";

export let apiBaseURL = "";
export let cdnBaseURL = "";
export let BaseName = "";

// 初始化 API 基礎 URL
const initApiBaseURL = () => {
  const hostDomain = location.hostname.split("admin")[1];
  if (hostDomain) {
    apiBaseURL = `${location.protocol}//admin-api${hostDomain}`;
    cdnBaseURL = `${location.protocol}//cdn${hostDomain}/`;
  } else {
    apiBaseURL = import.meta.env.VITE_APP_BASE_API || "";
    cdnBaseURL = import.meta.env.VITE_APP_CDN_BASE_URL || "";
  }
  BaseName = apiBaseURL.replace("https://admin-api.", "").replace(".", "").split("/")[0];
  console.log("BaseName", BaseName);
  if (BaseName === "ww688bet") {
    cdnBaseURL = "https://cdn.ww188.bet/";
  }
};

initApiBaseURL();

const { actionsUsingSpinner, actionGateWay } = apiActionSetting;

const service = axios.create({
  baseURL: apiBaseURL,
  timeout: 0,
  headers: { "Content-Type": "application/json" }
});

// Request interceptors
service.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const userStore = useUserStore();
    // Add X-Access-Token header to every request
    if (userStore.token) {
      config.headers = config.headers || {};
      config.headers["X-Access-Token"] = userStore.token;
    }

    // 檢查是否是api request
    const isApiGateWay = actionGateWay.some(gateway => config.url?.includes(gateway));
    if (isApiGateWay) {
      // 取得request action name
      let actionName: string = "";
      if (config.data) {
        if (config.data instanceof FormData) {
          actionName = config.data.get("actionName") as string || "";
        } else {
          actionName = (config.data as any).actionName || "";
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
    return Promise.reject(error);
  }
);

// Response interceptors
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { error } = response.data;

    if (error) {
      const userStore = useUserStore();
      if (error.code === 4 || error.code === 10012 || error.code === 10029) {
        userStore.resetToken();
        const errorKey = `errorMsg.${error.code.toString()}`;
        // 如果需要 i18n，可以在這裡處理
        const errorMsg = error.message || "認證失敗，請重新登入";
        message.error(errorMsg);
        window.location.href = "/#/login";
      } else {
        const errorKey = `errorMsg.${error.code.toString()}`;
        const errorMsg = error.message || "請求失敗";
        let rejectObj = response.data;
        rejectObj.errorMsg = errorMsg;
        return Promise.reject(rejectObj);
      }
    }

    const isApiGateWay = actionGateWay.some(gateway => response.config.url?.includes(gateway));
    if (isApiGateWay) {
      // 取得request action name
      let actionName: string = "";
      if (response.config.data) {
        if (response.config.data instanceof FormData) {
          actionName = (response.config.data.get("actionName") as string) || "";
        } else {
          try {
            const data = typeof response.config.data === "string" 
              ? JSON.parse(response.config.data) 
              : response.config.data;
            actionName = data.actionName || "";
          } catch (e) {
            actionName = "";
          }
        }
      }
      // 關閉spinner
      if (actionsUsingSpinner.includes(actionName)) {
        // StatusModule.SET_ISREQUESTING(false);
      }
    }

    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default service;

