// API 動作設定
// 來源：src/config/apiActionSetting.ts
// 用於請求攔截器中判斷哪些 action 需要使用 spinner

export default {
  // spinner：讓使用者無法點選畫面
  // 需要使用spinner的action name在這裡定義
  actionsUsingSpinner: [
    "addRace"
  ],
  // 限定檢查的gate way
  actionGateWay: [
    "accessGateway",
    "accessUploadGateway"
  ]
};

