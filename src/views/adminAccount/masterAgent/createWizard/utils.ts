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
  const bytes = window.crypto.getRandomValues(new Uint8Array(20)); // 160-bit
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
  } catch {
    return '';
  }
};

/**
 * 安全 JSON parse
 */
const safeJsonParse = (raw?: string) => {
  if (!raw || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/**
 * 正規化 Firebase Config API Key
 */
const normalizeFirebaseConfigApiKey = (raw: any) => {
  if (!raw) return '';
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return String(obj?.apiKey ?? '');
  } catch {
    return '';
  }
};

/**
 * 建立 internalSettings（Phase 1 最小版，僅包含必要結構）
 */
export const buildInternalSettings = (account: string, values: any, authLevel: number) => {
  // 若 admin 等級可直接編 raw internalSettings，則尊重 raw 值
  if (authLevel === 1 && values.internalSettings && String(values.internalSettings).trim()) {
    return String(values.internalSettings);
  }

  // Phase 1 最小版：僅建立基本結構
  const internalSettings = {
    firebaseAPIKey: normalizeFirebaseConfigApiKey(values.firebaseConfig),
    paymentSettings: {
      masterAgent: account,
      paymentMode: values.paymentMode ?? 'Real',
      topUpRate: Number(values.topUpRate ?? 100),
      myCard: {},
      soNet: {},
      nganLuong: {},
      moPay: {},
      btPay: {},
    },
    smsSettings: {
      masterAgent: account,
      smsAccount: String(values.smsAccount ?? ''),
      smsPassWord: String(values.smsPassWord ?? ''),
      boSmsAccount: String(values.boSmsAccount ?? ''),
      boSmsPassWord: String(values.boSmsPassWord ?? ''),
      cloudSmsAccount: String(values.cloudSmsAccount ?? ''),
      cloudSmsPassWord: String(values.cloudSmsPassWord ?? ''),
    },
    transactionSettings: {
      masterAgent: account,
    },
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
      waitingSettleTime: Number(values.slot_waitingSettleTime ?? 30),
      oneTimeToken: Boolean(values.slot_oneTimeToken),
      prizeDecimalPlaces: Number(values.slot_prizeDecimalPlaces ?? 2),
    },
  };

  return safeJsonStringify(internalSettings);
};

/**
 * 建立 remoteConfigURLs（Phase 1 最小版）
 */
export const buildRemoteConfigURLs = (values: any, authLevel: number) => {
  if (authLevel === 1 && values.remoteConfigURLs && String(values.remoteConfigURLs).trim()) {
    return String(values.remoteConfigURLs);
  }

  const base = safeJsonParse(values.remoteConfigURLs) ?? {};

  return safeJsonStringify({
    ...base,
    firebaseConfig: values.firebaseConfig ?? '',
    facebookID: values.facebookID ?? '',
    lingLoginConfig: {
      lineOfficialAccount: values.lineOfficialAccount ?? '',
      liffID: values.liffID ?? '',
      clientID: values.lineClientID ?? '',
      clientSecret: values.lineClientSecret ?? '',
    },
    serviceEmail: values.serviceEmail ?? '',
  });
};


