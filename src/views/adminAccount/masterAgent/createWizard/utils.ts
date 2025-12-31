/**
 * Wizard 共用工具函數
 * 從 index.vue 抽取，避免重複邏輯
 */

/**
 * Base32 編碼（用於產生 secret）
 */
const toBase32 = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
};

/**
 * 產生 160-bit secret（Base32）
 */
export const generateSecret = () => {
  /**
   * 160-bit
   */
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

/**
 * 產生 hashKey（15 位）
 */
export const generateHashKey = () => {
  return generateSecret().slice(0, 15);
};

/**
 * 安全 JSON stringify
 */
const safeJsonStringify = (obj: any) => {
  try {
    return JSON.stringify(obj);
  }
  catch {
    return '';
  }
};

/**
 * 安全 JSON parse
 */
const safeJsonParse = (raw?: string) => {
  if (!raw || !raw.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  }
  catch {
    return undefined;
  }
};

/**
 * 正規化 Firebase Config API Key
 */
const normalizeFirebaseConfigApiKey = (raw: any) => {
  if (!raw) {
    return '';
  }
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return String(obj?.apiKey ?? '');
  }
  catch {
    return '';
  }
};

/**
 * 建立 internalSettings（對齊 Vue2 版本）
 */
export const buildInternalSettings = (account: string, values: any, authLevel: number) => {
  // 若 admin 等級可直接編 raw internalSettings，則尊重 raw 值
  if (authLevel === 1 && values.internalSettings && String(values.internalSettings).trim()) {
    return String(values.internalSettings);
  }

  // 補齊 myCard 相關的預設值處理邏輯
  const website = values.website ?? '';
  // 組裝 myCard 物件（從分散的欄位組裝）
  const myCard: any = values.myCard ?? {};
  if (values.myCard_facServiceID !== undefined) {
    myCard.facServiceID = values.myCard_facServiceID;
  }
  if (values.myCard_secretKey !== undefined) {
    myCard.secretKey = values.myCard_secretKey;
  }
  if (values.myCard_allowIPs !== undefined) {
    myCard.allowIPs = values.myCard_allowIPs;
  }
  if (values.myCard_topUpSecretKeyA !== undefined) {
    myCard.topUpSecretKeyA = values.myCard_topUpSecretKeyA;
  }
  if (values.myCard_topUpSecretKeyB !== undefined) {
    myCard.topUpSecretKeyB = values.myCard_topUpSecretKeyB;
  }
  if (values.myCard_topUpFacId !== undefined) {
    myCard.topUpFacId = values.myCard_topUpFacId;
  }
  // 優先使用表單中的值，如果沒有則使用預設值
  const myCardCallbackDomain = values.myCardCallbackDomain || myCard.callbackDomain || (website ? `https://mycard.${website}/` : '');
  const myCardWebsite = values.myCardWebsite || myCard.website || 'https://bargain.mycard520.com.tw';
  const myCardRedirectVerifyWebsite = values.myCardRedirectVerifyWebsite || myCard.myCardRedirectVerifyWebsite || (website ? `https://pd.${website}/` : '');

  // 處理 reCAPTCHA 設定
  const hasReCAPTCHAValue = values.reCaptcha_secretKey || values.reCaptcha_name || values.reCaptcha_siteKey;
  const reCaptchaV2Settings = hasReCAPTCHAValue
    ? {
        masterAgent: account,
        secretKey: String(values.reCaptcha_secretKey ?? ''),
        name: String(values.reCaptcha_name ?? ''),
        siteKey: String(values.reCaptcha_siteKey ?? ''),
        enabled: Boolean(values.reCaptcha_enabled),
        platform: 'web',
      }
    : undefined;

  // 處理 transactionSettings 的欄位（對齊 Vue2）
  const transactionSettings: any = {
    masterAgent: account,
  };
  // Level 1 欄位：凍結週期（數值，單位為天）
  if (values.freezeDuration !== undefined) {
    transactionSettings.freezeDuration = {
      unit: 'days',
      value: Number(values.freezeDuration ?? 7),
    };
  }
  // Level 1 欄位：贈禮交易過期時間（數值，單位為天）
  if (values.orderExpireTime !== undefined) {
    transactionSettings.orderExpireTime = {
      unit: 'days',
      value: Number(values.orderExpireTime ?? 3),
    };
  }
  // Level 1 欄位：OTP 模式
  if (values.otpMode !== undefined) {
    transactionSettings.otpMode = values.otpMode;
  }
  // Level 2 欄位：贈禮最小交易金額
  if (values.minTransactionBalance !== undefined) {
    transactionSettings.minTransactionBalance = values.minTransactionBalance;
  }
  // Level 2 欄位：OTP 發送間隔
  if (values.sendSmsOTPIntervals !== undefined) {
    // Vue2 中是物件 { unit: "minutes", value: 2 }，但 Vue3 可能是數字，需要轉換
    if (typeof values.sendSmsOTPIntervals === 'object' && values.sendSmsOTPIntervals !== null) {
      transactionSettings.sendSmsOTPIntervals = values.sendSmsOTPIntervals;
    }
    else {
      transactionSettings.sendSmsOTPIntervals = {
        unit: 'minutes',
        value: Number(values.sendSmsOTPIntervals ?? 2),
      };
    }
  }
  // Level 2 欄位：OTP 驗證相關過期時間
  if (values.authExpireTime !== undefined) {
    if (typeof values.authExpireTime === 'object' && values.authExpireTime !== null) {
      transactionSettings.authExpireTime = values.authExpireTime;
    }
    else {
      transactionSettings.authExpireTime = {
        unit: 'minutes',
        value: Number(values.authExpireTime ?? 30),
      };
    }
  }
  if (values.settlementIntervalUnit !== undefined) {
    transactionSettings.settlementIntervalUnit = values.settlementIntervalUnit;
  }
  // Level 2 欄位：押注解鎖倍率
  if (values.spinUnfreezeRatio !== undefined) {
    transactionSettings.spinUnfreezeRatio = values.spinUnfreezeRatio;
  }

  // 處理 smsSettings 的額外欄位
  const smsSettings: any = {
    masterAgent: account,
    smsAccount: String(values.smsAccount ?? ''),
    smsPassWord: String(values.smsPassWord ?? ''),
    boSmsAccount: String(values.boSmsAccount ?? ''),
    boSmsPassWord: String(values.boSmsPassWord ?? ''),
    cloudSmsAccount: String(values.cloudSmsAccount ?? ''),
    cloudSmsPassWord: String(values.cloudSmsPassWord ?? ''),
  };
  if (values.isOpenOtherSMS !== undefined) {
    smsSettings.isOpenOtherSMS = values.isOpenOtherSMS;
  }
  if (values.useSMSPlatforms !== undefined) {
    smsSettings.useSMSPlatforms = values.useSMSPlatforms;
  }
  if (values.accountPointsWarningValue !== undefined) {
    smsSettings.accountPointsWarningValue = values.accountPointsWarningValue;
  }

  const internalSettings: any = {
    firebaseAPIKey: normalizeFirebaseConfigApiKey(values.firebaseConfig),
    paymentSettings: {
      masterAgent: account,
      paymentMode: values.paymentMode ?? 'Real',
      topUpRate: Number(values.topUpRate ?? 100),
      myCard: {
        ...myCard,
        callbackDomain: myCardCallbackDomain,
        website: myCardWebsite,
        myCardRedirectVerifyWebsite,
      },
      soNet: values.soNet ?? {},
      nganLuong: values.nganLuong ?? {},
      moPay: values.moPay ?? {},
      btPay: values.btPay ?? {},
    },
    smsSettings,
    transactionSettings,
    accountSettings: {
      masterAgent: account,
      onePhoneNumberToAccountCounts: Number(values.onePhoneNumberToAccountCounts ?? 1),
      lingLoginConfig: {
        lineOfficialAccount: String(values.lineOfficialAccount ?? ''),
        liffID: String(values.liffID ?? ''),
        clientID: String(values.lineClientID ?? ''),
        clientSecret: String(values.lineClientSecret ?? ''),
      },
    },
    slotGameSettings: {
      // Vue2 只有 prizeDecimalPlaces，不包含 waitingSettleTime 和 oneTimeToken
      prizeDecimalPlaces: Number(values.slot_prizeDecimalPlaces ?? 2),
    },
  };

  // 如果有 reCAPTCHA 設定，加入到 internalSettings
  if (reCaptchaV2Settings) {
    internalSettings.reCaptchaV2Settings = reCaptchaV2Settings;
  }

  return safeJsonStringify(internalSettings);
};

/**
 * 建立 remoteConfigURLs（對齊 Vue2 版本）
 */
export const buildRemoteConfigURLs = (values: any, authLevel: number, account?: string) => {
  if (authLevel === 1 && values.remoteConfigURLs && String(values.remoteConfigURLs).trim()) {
    return String(values.remoteConfigURLs);
  }

  // 處理 reCAPTCHA 設定
  const masterAgentAccount = account || values.account || values.masterAgent || '';
  const hasReCAPTCHAValue = values.reCaptcha_secretKey || values.reCaptcha_name || values.reCaptcha_siteKey;
  const reCaptchaV2Settings = hasReCAPTCHAValue
    ? {
        masterAgent: masterAgentAccount,
        secretKey: String(values.reCaptcha_secretKey ?? ''),
        name: String(values.reCaptcha_name ?? ''),
        siteKey: String(values.reCaptcha_siteKey ?? ''),
        enabled: Boolean(values.reCaptcha_enabled),
        platform: 'web',
      }
    : undefined;

  // 先從 remoteConfigURLs 解析現有設定
  let sendRemoteConfigURLs: any = {};
  try {
    const config = safeJsonParse(values.remoteConfigURLs);
    if (config) {
      sendRemoteConfigURLs = { ...config };
    }
  }
  catch {
    // 解析失敗時使用空物件
  }

  // 如果有 reCAPTCHA 設定，加入到 remoteConfigURLs
  if (reCaptchaV2Settings) {
    sendRemoteConfigURLs.reCaptchaV2Settings = reCaptchaV2Settings;
  }

  // 處理 firebaseConfig 正規化（對齊 Vue2：將單引號轉為雙引號，處理屬性名）
  let normalizedFirebaseConfig = '';
  if (values.firebaseConfig) {
    try {
      // 先嘗試解析為 JSON
      const parsed = typeof values.firebaseConfig === 'string' ? JSON.parse(values.firebaseConfig) : values.firebaseConfig;
      normalizedFirebaseConfig = JSON.stringify(parsed);
    }
    catch {
      // 如果解析失敗，進行正規化處理（對齊 Vue2 的正規化邏輯）
      normalizedFirebaseConfig = String(values.firebaseConfig)
        .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/'/g, '"');
    }
  }

  sendRemoteConfigURLs = {
    ...sendRemoteConfigURLs,
    firebaseConfig: normalizedFirebaseConfig,
    facebookID: values.facebookID ?? '',
    lingLoginConfig: {
      lineOfficialAccount: values.lineOfficialAccount ?? '',
      liffID: values.liffID ?? '',
      clientID: values.lineClientID ?? '',
      clientSecret: values.lineClientSecret ?? '',
    },
    serviceEmail: values.serviceEmail ?? '',
  };

  return safeJsonStringify(sendRemoteConfigURLs);
};
