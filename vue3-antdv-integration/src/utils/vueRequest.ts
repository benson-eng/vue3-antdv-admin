import { IVueResponse } from "@/api/types";
import { AxiosRequestConfig } from "axios";
import { message } from "ant-design-vue";
import request from "./request";

export function vueRequest(
  config: AxiosRequestConfig,
  showMessage: boolean = true,
  isShowMsgDialogWhenErr: boolean = true
): Promise<IVueResponse> {
  if (!JSON.stringify(config).includes("AdminSystem")) {
    console.log("vueRequest config======>" + JSON.stringify(config));
  }
  return request(config)
    .then((result: any) => {
      if (!JSON.stringify(config).includes("AdminSystem")) {
        console.log("result======>" + JSON.stringify(result));
      }
      return {
        data: result.data,
        error: result.error
      };
    })
    .catch((errorObj: any) => {
      console.log(errorObj);
      if (errorObj.isAxiosError && errorObj.message === "Network Error") {
        const networkErrorMsg = "網路錯誤，請檢查您的連線";
        if (isShowMsgDialogWhenErr) {
          message.error({
            content: networkErrorMsg,
            duration: 5
          });
        }
        throw new Error(networkErrorMsg);
      } else if (errorObj.__CANCEL__ === true) {
        // for uploadVideo cancel
        console.log("errorObj.__CANCEL__ ===> ", errorObj.__CANCEL__);
        throw errorObj;
      } else {
        if (!showMessage) {
          return {
            data: errorObj.data,
            error: errorObj.error
          };
        } else {
          if (isShowMsgDialogWhenErr) {
            message.error({
              content: errorObj.errorMsg || "請求失敗",
              duration: 5
            });
          }
          throw errorObj;
        }
      }
    });
}

