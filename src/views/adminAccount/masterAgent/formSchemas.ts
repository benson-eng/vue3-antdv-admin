import type { FormSchema } from '@/components/core/schema-form';
import RolesApi from '@/api/backend/adminAccount/roles';

export type MasterAgentFormValues = Record<string, any>;

interface BuildSchemaOptions {
  isMasterAgentX: boolean;
  authLevel: number;
  /** 可選的翻譯函數，用於顯示選項文字 */
  t?: (key: string) => string;
}

/**
 * ✅ 以「對齊 Vue2 顯示/隱藏行為」為優先：
 * - masterAgent：顯示完整設定
 * - masterAgentX：僅顯示精簡欄位
 */
export const getMasterAgentSchemas = (opt: BuildSchemaOptions): FormSchema<MasterAgentFormValues>[] => {
  const isX = opt.isMasterAgentX;
  /**
   * Vue2：getAuthLevel === 1 才顯示 internalSettings/remoteConfigURLs
   */
  const isSuper = opt.authLevel === 1;
  /**
   * 如果沒有提供翻譯函數，使用 key 作為 fallback
   */
  const t = opt.t || ((key: string) => key);

  const colHalf = { span: 12 };
  const colFull = { span: 24 };

  return [
    // 基本欄位（Vue2 正式欄位清單）
    {
      field: 'account',
      label: '後台帳戶',
      component: 'Input',
      rules: [{ required: true, message: '請輸入帳號' }],
      colProps: colHalf,
    },
    {
      field: 'website',
      label: '網站名稱',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
      componentProps: {
        placeholder: '例如：example.com（不要包含 http/https）',
      },
    },
    {
      field: 'apiDomain',
      label: '網域',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'isRanking',
      label: '啟用排行榜功能',
      component: 'Switch',
      defaultValue: true,
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'roles',
      label: '角色',
      component: 'Select',
      colProps: colFull,
      componentProps: {
        mode: 'multiple',
        placeholder: '請選擇角色',
        request: async () => {
          const res = await RolesApi.getlocalRoles({});
          const roles = res?.roles ?? [];
          return roles.map((r: any) => ({
            label: r.name,
            value: r.id,
          }));
        },
      },
    },

    // Firebase 設定（Vue2 正式欄位清單）
    {
      field: 'firebaseAdminSdkConfig',
      label: 'Firebase 管理員 SDK 配置',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },
    {
      field: 'firebaseConfig',
      label: 'Firebase 設定',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },

    // 客服/Line/Facebook（Vue2 正式欄位清單）
    {
      field: 'serviceEmail',
      label: '客服信箱',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'lineOfficialAccount',
      label: 'line官方帳號',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'liffID',
      label: 'liffID',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'lineClientID',
      label: 'Line登入ID',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'lineClientSecret',
      label: 'line登入密鑰',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'facebookID',
      label: 'Facebook登入ID',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },

    // MyCard 設定（Vue2 正式欄位清單）
    {
      field: 'myCard_facServiceID',
      label: 'MyCard FacServiceID',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'myCard_secretKey',
      label: 'MyCard 廠商Key',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'myCard_allowIPs',
      label: 'MyCard正式環境IP提供',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'myCard_topUpSecretKeyA',
      label: 'MyCard Key1',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'myCard_topUpSecretKeyB',
      label: 'MyCardKey2',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'myCard_topUpFacId',
      label: 'MyCard FatoryId',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },

    // 簡訊設定（Vue2 正式欄位清單）
    {
      field: 'boSmsAccount',
      label: '三竹簡訊商帳號',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'boSmsPassWord',
      label: '三竹簡訊商密碼',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },

    // 交易設定（Vue2 正式欄位清單）
    {
      field: 'transactionSetting',
      label: '交易設定',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'minTransactionBalance',
      label: '贈禮最小交易金額',
      component: 'InputNumber',
      vIf: ({ formModel }) => !isX && formModel.transactionSetting,
      defaultValue: 0,
      colProps: colHalf,
      componentProps: { min: 0, precision: 0 },
    },
    {
      field: 'sendSmsOTPIntervals',
      label: 'OTP 發送間隔(分鐘)',
      component: 'InputNumber',
      vIf: ({ formModel }) => !isX && formModel.transactionSetting,
      defaultValue: 2,
      colProps: colHalf,
      componentProps: { min: 0, precision: 0 },
    },
    {
      field: 'authExpireTime',
      label: 'OTP 驗證相關過期時間(分鐘)',
      component: 'InputNumber',
      vIf: ({ formModel }) => !isX && formModel.transactionSetting,
      defaultValue: 30,
      colProps: colHalf,
      componentProps: { min: 0, precision: 0 },
    },
    {
      field: 'spinUnfreezeRatio',
      label: '押注解鎖倍率 (數值)',
      component: 'InputNumber',
      vIf: ({ formModel }) => !isX && formModel.transactionSetting,
      defaultValue: 0,
      colProps: colHalf,
      componentProps: { min: 0, precision: 0 },
    },
    {
      field: 'onePhoneNumberToAccountCounts',
      label: '單一手機號碼可綁定帳號數',
      component: 'InputNumber',
      vIf: !isX,
      defaultValue: 1,
      colProps: colHalf,
      componentProps: { min: 1, precision: 0 },
    },

    // 人機驗證（Vue2 正式欄位清單）
    {
      field: 'reCaptcha_secretKey',
      label: '專案API金鑰',
      component: 'Input',
      vIf: !isX,
      colProps: colFull,
    },
    {
      field: 'reCaptcha_name',
      label: '設定名稱',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'reCaptcha_siteKey',
      label: '網站金鑰',
      component: 'Input',
      vIf: !isX,
      colProps: colFull,
    },
    {
      field: 'reCaptcha_enabled',
      label: '啟用開關',
      component: 'Switch',
      vIf: ({ formModel }) =>
        !isX
        && Boolean(formModel.reCaptcha_secretKey && formModel.reCaptcha_name && formModel.reCaptcha_siteKey),
      defaultValue: false,
      colProps: colHalf,
    },

    // raw json：僅管理員可見（對齊 Vue2）
    {
      field: 'internalSettings',
      label: 'internalSettings(JSON)',
      component: 'InputTextArea',
      vIf: !isX && isSuper,
      colProps: colFull,
      componentProps: { rows: 6 },
    },
    {
      field: 'remoteConfigURLs',
      label: 'remoteConfigURLs(JSON)',
      component: 'InputTextArea',
      vIf: !isX && isSuper,
      colProps: colFull,
      componentProps: { rows: 6 },
    },
  ];
};

// 保留舊 export 名稱（避免你或其他地方尚未改完）
export const baseSchemas: FormSchema[] = getMasterAgentSchemas({ isMasterAgentX: false, authLevel: 2 });

export const passwordSchemas: FormSchema[] = [
  {
    field: 'newPassword',
    label: '新密碼',
    component: 'InputPassword',
    rules: [{ required: true, message: '請輸入新密碼' }],
    componentProps: {
      placeholder: '請輸入新密碼',
    },
  },
];
