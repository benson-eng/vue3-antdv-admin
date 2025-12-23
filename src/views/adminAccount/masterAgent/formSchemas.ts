import type { FormSchema } from '@/components/core/schema-form';
import RolesApi from '@/api/backend/adminAccount/roles';
import ShareholderApi from '@/api/backend/adminAccount/shareholder';

export type MasterAgentFormValues = Record<string, any>;

type BuildSchemaOptions = {
  isMasterAgentX: boolean;
  authLevel: number;
};

/**
 * ✅ 以「對齊 Vue2 顯示/隱藏行為」為優先：
 * - masterAgent：顯示完整設定
 * - masterAgentX：僅顯示精簡欄位
 */
export const getMasterAgentSchemas = (opt: BuildSchemaOptions): FormSchema<MasterAgentFormValues>[] => {
  const isX = opt.isMasterAgentX;
  const isSuper = opt.authLevel === 1; // Vue2：getAuthLevel === 1 才顯示 internalSettings/remoteConfigURLs

  const colHalf = { span: 12 };
  const colFull = { span: 24 };

  return [
    // 基本
    {
      field: 'account',
      label: '後台帳戶',
      component: 'Input',
      rules: [{ required: true, message: '請輸入帳號' }],
      colProps: colHalf,
    },
    {
      field: 'name',
      label: '名稱',
      component: 'Input',
      rules: [{ required: true, message: '請輸入名稱' }],
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
      field: 'hashKey',
      label: '金鑰',
      component: 'Input',
      colProps: colHalf,
      componentProps: {
        placeholder: '可留空（新增時可用「產生」）',
      },
    },
    {
      field: 'currencyCode',
      label: '幣別',
      component: 'Input',
      colProps: colHalf,
      componentProps: {
        placeholder: '例如：gold',
      },
    },
    {
      field: 'shareholderAccount',
      label: '歸屬股東',
      component: 'Select',
      colProps: colHalf,
      componentProps: {
        allowClear: true,
        placeholder: '請選擇股東',
        request: async () => {
          const list = await ShareholderApi.getShareholderList({});
          const items = (Array.isArray(list) ? list : []).filter((i: any) => Boolean(i?.isMasterAccount));
          return items.map((i: any) => ({
            label: `${i.name ?? ''} (${i.account})`,
            value: i.account,
          }));
        },
      },
    },

    // 錢包/公式（masterAgentX 只保留單錢包）
    {
      field: 'isSingleWallet',
      label: '單一錢包',
      component: 'Switch',
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'singleWallerVersion',
      label: '單一錢包版本',
      component: 'Select',
      defaultValue: 1,
      vIf: !isX,
      colProps: colHalf,
      componentProps: {
        options: [
          { label: 'v1', value: 1 },
          { label: 'v2', value: 2 },
        ],
      },
    },
    {
      field: 'vipDowngradeFormula',
      label: 'vip 降級公式',
      component: 'Select',
      defaultValue: 1,
      vIf: !isX,
      colProps: colHalf,
      componentProps: {
        options: [
          { label: '0', value: 0 },
          { label: '1', value: 1 },
          { label: '2', value: 2 },
          { label: '3', value: 3 },
        ],
      },
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
      field: 'levelFormula',
      label: '等級公式',
      component: 'Select',
      defaultValue: 0,
      vIf: !isX,
      colProps: colHalf,
      componentProps: {
        options: [
          { label: '0', value: 0 },
          { label: '1', value: 1 },
          { label: '2', value: 2 },
        ],
      },
    },
    {
      field: 'activityFormulaRatio',
      label: '活躍值公式',
      component: 'Select',
      defaultValue: 1,
      vIf: !isX,
      colProps: colHalf,
      componentProps: {
        options: [
          { label: '1:100', value: 1 },
          { label: '1:1000', value: 10 },
        ],
      },
    },

    // 網域/白名單/CDN/Proxy
    {
      field: 'apiDomain',
      label: 'API Domain',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'whiteIPList',
      label: '白名單',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 2 },
    },
    {
      field: 'cdnList',
      label: 'CDN 名單',
      component: 'Input',
      vIf: !isX,
      colProps: colFull,
    },
    {
      field: 'proxyList',
      label: '代理伺服器名單',
      component: 'Input',
      vIf: !isX,
      colProps: colFull,
    },

    // 角色（兩者皆要）
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

    // GA / Firebase（masterAgent 才有）
    {
      field: 'gaKey',
      label: 'GA 金鑰',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 2 },
    },
    {
      field: 'firebaseSdkConfig',
      label: 'Firebase SDK 配置',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },
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

    // 支付金鑰（masterAgent 才有）
    {
      field: 'iosPaymentKey',
      label: 'iOS 支付金鑰',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },
    {
      field: 'androidPaymentKey',
      label: 'Android 支付金鑰',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },
    {
      field: 'ecPaymentKey',
      label: 'EC 支付金鑰',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },
    {
      field: 'gcpKey',
      label: 'GCP 金鑰',
      component: 'InputTextArea',
      vIf: !isX,
      colProps: colFull,
      componentProps: { rows: 3 },
    },
    {
      field: 'androidBundleID',
      label: 'Android 應用包識別碼',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'iosBundleID',
      label: 'iOS 應用包識別碼',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },

    // 客服/Line/Facebook（masterAgent 才有）
    {
      field: 'serviceEmail',
      label: '客服信箱',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'lineOfficialAccount',
      label: 'Line 官方帳號',
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
      label: 'Line 登入 ID',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'lineClientSecret',
      label: 'Line 登入密鑰',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'facebookID',
      label: 'Facebook 登入 ID',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },

    // 金流/簡訊（先做「能送出 payload」的最小集合）
    {
      field: 'myCardShowType',
      label: '金流設定 - MyCard',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'soNetShowType',
      label: '金流設定 - SoNet',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'nganLuongShowType',
      label: '金流設定 - NganLuong',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'moPayShowType',
      label: '金流設定 - MoPay',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'btPayShowType',
      label: '金流設定 - BtPay',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'paymentMode',
      label: '金流模式',
      component: 'Select',
      vIf: ({ formModel }) =>
        !isX &&
        Boolean(
          formModel.myCardShowType ||
            formModel.soNetShowType ||
            formModel.nganLuongShowType ||
            formModel.moPayShowType ||
            formModel.btPayShowType,
        ),
      defaultValue: 'Real',
      colProps: colHalf,
      componentProps: {
        options: [
          { label: 'Real', value: 'Real' },
          { label: 'Fake', value: 'Fake' },
        ],
      },
    },
    {
      field: 'topUpRate',
      label: '金流倍率',
      component: 'InputNumber',
      vIf: ({ formModel }) =>
        !isX &&
        Boolean(
          formModel.myCardShowType ||
            formModel.soNetShowType ||
            formModel.nganLuongShowType ||
            formModel.moPayShowType ||
            formModel.btPayShowType,
        ),
      defaultValue: 100,
      colProps: colHalf,
      componentProps: { min: 0, precision: 0 },
    },

    {
      field: 'smsAccount',
      label: '簡訊設定 - 帳號',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'smsPassWord',
      label: '簡訊設定 - 密碼',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
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
    {
      field: 'onePhoneNumberToAccountCounts',
      label: '單一手機號碼可綁定帳號數',
      component: 'InputNumber',
      vIf: !isX,
      defaultValue: 1,
      colProps: colHalf,
      componentProps: { min: 1, precision: 0 },
    },

    // 老虎機設定（兩者都要，masterAgentX 只有其中兩項）
    {
      field: 'slot_waitingSettleTime',
      label: '老虎機等待結算時間（分）',
      component: 'InputNumber',
      defaultValue: 30,
      colProps: colHalf,
      componentProps: { min: 0, precision: 0 },
    },
    {
      field: 'slot_oneTimeToken',
      label: '老虎機連結單次有效',
      component: 'Switch',
      vIf: !isX,
      defaultValue: false,
      colProps: colHalf,
    },
    {
      field: 'slot_prizeDecimalPlaces',
      label: '拉彩金位數',
      component: 'Select',
      defaultValue: 2,
      colProps: colHalf,
      componentProps: {
        options: [
          { label: '0', value: 0 },
          { label: '2', value: 2 },
        ],
      },
    },

    // 人機驗證（masterAgent 才有）
    {
      field: 'reCaptcha_secretKey',
      label: '人機驗證 - SecretKey',
      component: 'Input',
      vIf: !isX,
      colProps: colFull,
    },
    {
      field: 'reCaptcha_name',
      label: '人機驗證 - 名稱',
      component: 'Input',
      vIf: !isX,
      colProps: colHalf,
    },
    {
      field: 'reCaptcha_siteKey',
      label: '人機驗證 - SiteKey',
      component: 'Input',
      vIf: !isX,
      colProps: colFull,
    },
    {
      field: 'reCaptcha_enabled',
      label: '人機驗證 - 啟用',
      component: 'Switch',
      vIf: ({ formModel }) =>
        !isX &&
        Boolean(formModel.reCaptcha_secretKey && formModel.reCaptcha_name && formModel.reCaptcha_siteKey),
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




