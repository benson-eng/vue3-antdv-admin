<script setup lang="tsx">
import type { Dayjs } from 'dayjs';
import type { TableColumnItem, TableListItem } from './columns';
import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal } from 'ant-design-vue';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import Api from '@/api/backend/adminAccount/masterAgent';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import CreateWizardDialog from '../components/CreateWizardDialog.vue';
import { getBaseColumns } from './columns';
import { getMasterAgentSchemas, passwordSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountMasterAgent' });

const routeI18n = useI18n('routes.adminAccount');
const pageI18n = useI18n('page.adminAccount');
const t = routeI18n.t;
const pt = pageI18n.t;
const userStore = useUserStore();
const canCreate = computed(() => userStore.level === 2);
const route = useRoute();
const isMasterAgentX = computed(() => route.name === 'AdminAccountMasterAgentX' || String(route.path).endsWith('/masterAgentX'));

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const [showModal] = useFormModal();

const wizardVisible = ref<boolean>(false);
const editWizardVisible = ref<boolean>(false);
const editWizardRecord = ref<Partial<TableListItem> | null>(null);
const rawListCache = ref<any[] | null>(null);
const goCreateWizard = () => {
  wizardVisible.value = true;
};

const handleWizardClose = () => {
  wizardVisible.value = false;
};

const handleWizardSuccess = () => {
  wizardVisible.value = false;
  // 清空緩存，確保重新載入時獲取最新資料
  rawListCache.value = null;
  // 重新載入表格資料
  tableInstance?.reload();
};

const openEditWizard = async (record: Partial<TableListItem>) => {
  editWizardRecord.value = record;
  editWizardVisible.value = true;
};

const handleEditWizardClose = () => {
  editWizardVisible.value = false;
  editWizardRecord.value = null;
};

const handleEditWizardSuccess = () => {
  editWizardVisible.value = false;
  editWizardRecord.value = null;
  // 清空緩存，確保重新載入時獲取最新資料
  rawListCache.value = null;
  // 重新載入表格資料
  tableInstance?.reload();
};

// Vue2 行為對齊：當 filter 條件變更時，自動觸發資料重新載入
// 監聽表單值的變化來實現自動篩選
// let isInitialized = false;
// let reloadTimer: ReturnType<typeof setTimeout> | null = null;

// watch(
//   () => {
//     const searchFormRef = tableInstance?.getSearchFormRef();
//     if (!searchFormRef) {
//       return null;
//     }
//     // 獲取表單當前值
//     return searchFormRef.getFieldsValue?.();
//   },
//   (newVal, oldVal) => {
//     // 跳過初始觸發（oldVal 為 undefined）
//     if (oldVal === undefined) {
//       isInitialized = true;
//       return;
//     }
//     // 確保已經初始化後才觸發篩選
//     if (!isInitialized) {
//       isInitialized = true;
//       return;
//     }
//     // 使用 debounce 避免頻繁觸發篩選（特別是輸入框）
//     if (reloadTimer) {
//       clearTimeout(reloadTimer);
//     }
//     reloadTimer = setTimeout(() => {
//       // 條件變更時，重置分頁至第一頁並重新載入資料
//       nextTick(() => {
//         tableInstance?.reload(true);
//       });
//     }, 300); // 300ms 防抖延遲
//   },
//   { deep: true },
// );

interface TableListResponse {
  items: TableListItem[];
  meta: { totalItems: number };
}

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

const generateSecret = () => {
  /**
   * 160-bit
   */
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

const generateHashKey = () => {
  // Vue2 用 generate-password(length=15)，這裡用 base32 並裁 15 位
  return generateSecret().slice(0, 15);
};

const safeJsonStringify = (obj: any) => {
  try {
    return JSON.stringify(obj);
  }
  catch {
    return '';
  }
};

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

const normalizeFirebaseConfigApiKey = (raw: any) => {
  // Vue2：internalSettings.firebaseAPIKey 取自 firebaseConfig.apiKey
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

const buildInternalSettings = (account: string, values: any) => {
  // Vue2：若 admin 等級可直接編 raw internalSettings，則尊重 raw 值
  if (userStore.level === 1 && values.internalSettings && String(values.internalSettings).trim()) {
    return String(values.internalSettings);
  }

  const reCaptchaHasValue = Boolean(
    values.reCaptcha_secretKey || values.reCaptcha_name || values.reCaptcha_siteKey,
  );
  const reCaptchaV2Settings = reCaptchaHasValue
    ? {
        masterAgent: account,
        secretKey: String(values.reCaptcha_secretKey ?? ''),
        name: String(values.reCaptcha_name ?? ''),
        siteKey: String(values.reCaptcha_siteKey ?? ''),
        enabled: Boolean(values.reCaptcha_enabled),
        platform: 'web',
      }
    : undefined;

  // MyCard 設定（從扁平化欄位轉換為嵌套結構）
  const myCard = {
    facServiceID: String(values.myCard_facServiceID ?? ''),
    secretKey: String(values.myCard_secretKey ?? ''),
    allowIPs: String(values.myCard_allowIPs ?? ''),
    topUpSecretKeyA: String(values.myCard_topUpSecretKeyA ?? ''),
    topUpSecretKeyB: String(values.myCard_topUpSecretKeyB ?? ''),
    topUpFacId: String(values.myCard_topUpFacId ?? ''),
  };

  // 交易設定
  const transactionSettings: any = {
    masterAgent: account,
  };
  if (values.transactionSetting) {
    transactionSettings.minTransactionBalance = Number(values.minTransactionBalance ?? 0);
    transactionSettings.sendSmsOTPIntervals = {
      unit: 'minutes',
      value: Number(values.sendSmsOTPIntervals ?? 2),
    };
    transactionSettings.authExpireTime = {
      unit: 'minutes',
      value: Number(values.authExpireTime ?? 30),
    };
    transactionSettings.spinUnfreezeRatio = Number(values.spinUnfreezeRatio ?? 0);
  }

  const internalSettings = {
    firebaseAPIKey: normalizeFirebaseConfigApiKey(values.firebaseConfig),
    paymentSettings: {
      masterAgent: account,
      myCard,
    },
    smsSettings: {
      masterAgent: account,
      boSmsAccount: String(values.boSmsAccount ?? ''),
      boSmsPassWord: String(values.boSmsPassWord ?? ''),
    },
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
    ...(reCaptchaV2Settings ? { reCaptchaV2Settings } : {}),
  };

  return safeJsonStringify(internalSettings);
};

const buildRemoteConfigURLs = (values: any) => {
  if (userStore.level === 1 && values.remoteConfigURLs && String(values.remoteConfigURLs).trim()) {
    return String(values.remoteConfigURLs);
  }

  const base = safeJsonParse(values.remoteConfigURLs) ?? {};

  const reCaptchaHasValue = Boolean(
    values.reCaptcha_secretKey || values.reCaptcha_name || values.reCaptcha_siteKey,
  );
  const reCaptchaV2Settings = reCaptchaHasValue
    ? {
        secretKey: String(values.reCaptcha_secretKey ?? ''),
        name: String(values.reCaptcha_name ?? ''),
        siteKey: String(values.reCaptcha_siteKey ?? ''),
        enabled: Boolean(values.reCaptcha_enabled),
        platform: 'web',
      }
    : undefined;

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
    ...(reCaptchaV2Settings ? { reCaptchaV2Settings } : {}),
  });
};

const buildUpdatePayload = (record: Partial<MasterAgentItem>, overrides: Record<string, any> = {}) => {
  const roleIds = Array.isArray(record.roles)
    ? record.roles.map((r: any) => Number(r?.id)).filter((n: number) => Number.isFinite(n))
    : [];

  const account = String(record.account ?? '');

  return {
    id: Number(record.id),
    account,
    name: String(record.name ?? ''),
    prefix: record.prefix,
    isEnabled: Boolean(record.isEnabled),
    isMaintained: Boolean(record.isMaintained),
    roles: roleIds,
    website: record.website,
    hashKey: record.hashKey,
    currencyCode: record.currencyCode,
    apiDomain: record.apiDomain,
    whiteIPList: record.whiteIPList,
    cdnList: record.cdnList,
    proxyList: record.proxyList,
    currencies: record.currencies ?? [],
    isSingleWallet: record.isSingleWallet,
    singleWallerVersion: record.singleWallerVersion,
    vipDowngradeFormula: record.vipDowngradeFormula,
    isRanking: record.isRanking,
    levelFormula: record.levelFormula,
    activityFormula: record.activityFormula,
    levelUpNeedPoint: record.levelUpNeedPoint,
    gaKey: record.gaKey,
    firebaseSdkConfig: record.firebaseSdkConfig,
    firebaseAdminSdkConfig: record.firebaseAdminSdkConfig,
    firebaseConfig: record.firebaseConfig,
    iosPaymentKey: record.iosPaymentKey,
    androidPaymentKey: record.androidPaymentKey,
    ecPaymentKey: record.ecPaymentKey,
    gcpKey: record.gcpKey,
    androidBundleID: record.androidBundleID,
    iosBundleID: record.iosBundleID,
    serviceEmail: record.serviceEmail,
    facebookID: record.facebookID,
    backendKey: record.backendKey,
    agentBackendKey: record.agentBackendKey,
    isAllowMemberNicknameDuplicate: record.isAllowMemberNicknameDuplicate,
    internalSettings: record.internalSettings,
    remoteConfigURLs: record.remoteConfigURLs,
    ...overrides,
  };
};

const loadTableData = async (params: LoadDataParams & Record<string, any>): Promise<TableListResponse> => {
  console.log('[loadTableData params]', params);
  if (!rawListCache.value) {
    const list = await Api.getMasterAgentAccountList({});
    rawListCache.value = Array.isArray(list) ? list : [];
  }

  const list = rawListCache.value;
  // Vue2：只顯示「啟用」或「非維護」的總代
  const baseFiltered = (Array.isArray(list) ? list : []);
  // .filter(
  //   (i: any) => Boolean(i?.isEnabled) || !i?.isMaintained,
  // );

  // 從 params 中讀取篩選條件（篩選值會通過 handleFormValues 合併到 params 中）
  const searchParams = params as Record<string, any>;
  const filterAccount = searchParams.account ? String(searchParams.account).trim() : '';
  /**
   * 後台維護預設為「全部」（空字串 '' 代表全部），資料抓完要執行一次過濾
   * 空字串 '' 轉換為 undefined 表示「全部」，不過濾任何資料
   * 預設值為「全部」
   */
  const filterIsEnabled = 'isEnabled' in searchParams
    ? (searchParams.isEnabled === '' || searchParams.isEnabled === undefined
        ? undefined // 空字串或 undefined 代表「全部」
        : Boolean(searchParams.isEnabled))
    : undefined;
  const filterDateRange = searchParams.createDatetime as [Dayjs, Dayjs] | undefined;

  /**
   * Vue2 filterList 邏輯對齊
   * 資料抓完要執行一次過濾（即使預設值是「全部」，過濾邏輯也會執行）
   */
  const filtered = baseFiltered.filter((data: any) => {
    // 帳號篩選：Vue2 同時比對 account 和 name（不區分大小寫）
    let rtValue = true;
    if (filterAccount) {
      const keyword = filterAccount.toLowerCase();
      rtValue
        = String(data?.account ?? '').toLowerCase().includes(keyword)
          || String(data?.name ?? '').toLowerCase().includes(keyword);
    }

    // 啟用狀態過濾：Vue2 使用 === 嚴格比對
    // 當 filterIsEnabled 為 undefined 時（預設「全部」），不過濾，保留所有資料
    if (filterIsEnabled !== undefined) {
      rtValue = rtValue && Boolean(data?.isEnabled) === filterIsEnabled;
    }

    // 日期過濾：Vue2 使用 Date.parse 進行數值比較
    if (filterDateRange && filterDateRange.length === 2) {
      const startDate = filterDateRange[0];
      const dueDate = filterDateRange[1];
      if (startDate && dueDate) {
        // Vue2：Date.parse(data.createDatetime).valueOf() >= Date.parse(startDate).valueOf()
        const dataTimestamp = data?.createDatetime ? Date.parse(String(data.createDatetime)) : Number.NaN;
        const startTimestamp = Date.parse(`${startDate.format('YYYY-MM-DD')} 00:00:00`);
        const dueTimestamp = Date.parse(`${dueDate.format('YYYY-MM-DD')} 23:59:59`);

        if (Number.isFinite(dataTimestamp)) {
          if (dataTimestamp < startTimestamp || dataTimestamp > dueTimestamp) {
            rtValue = false;
          }
        }
      }
    }

    return rtValue;
  });

  /**
   * 標記子行的輔助函數
   * 為 children 中的項目添加 __isChild 標識
   */
  const markChildRows = (data: any[]): any[] => {
    return data.map((item: any) => {
      const result = {
        ...item,
        id: Number(item.id),
        account: String(item.account ?? ''),
        name: String(item.name ?? ''),
        isEnabled: Boolean(item.isEnabled),
        isMaintained: Boolean(item.isMaintained),
        roles: Array.isArray(item.roles) ? item.roles : [],
      };

      // 如果有 children，遞歸處理並標記為子行
      if (Array.isArray(item.children) && item.children.length > 0) {
        result.children = item.children.map((child: any) => ({
          ...child,
          id: Number(child.id),
          account: String(child.account ?? ''),
          name: String(child.name ?? ''),
          isEnabled: Boolean(child.isEnabled),
          isMaintained: Boolean(child.isMaintained),
          roles: Array.isArray(child.roles) ? child.roles : [],
          __isChild: true, // 標記為子行
        }));
      }

      return result;
    });
  };

  // 資料格式化
  const formatted = markChildRows(filtered);

  // 分頁處理
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 10);
  const totalItems = formatted.length;
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const items = formatted.slice(startIdx, endIdx);

  return {
    items,
    meta: { totalItems },
  };
};

const toggleEnabled = async (record: TableListItem, checked: boolean) => {
  try {
    await Api.updateMasterAgentAccount(
      buildUpdatePayload(record, {
        isEnabled: checked,
      }),
    );
    const status = checked ? pt('labels.enable') : pt('labels.disable');
    message.success(pt('message.enableBackendSuccess', { status, account: record.account }));
    // 清空緩存，確保重新載入時獲取最新資料
    rawListCache.value = null;
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error(pt('message.updateFailed'));
    // 清空緩存，確保重新載入時獲取最新資料
    rawListCache.value = null;
    tableInstance?.reload();
  }
};

const toggleMaintained = async (record: TableListItem, checked: boolean) => {
  try {
    await Api.updateMasterAgentAccount(
      buildUpdatePayload(record, {
        isMaintained: checked,
      }),
    );
    const status = checked ? pt('labels.disable') : pt('labels.enable');
    message.success(pt('message.enableFrontendSuccess', { status, account: record.account }));
    // 清空緩存，確保重新載入時獲取最新資料
    rawListCache.value = null;
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error(pt('message.updateFailed'));
    // 清空緩存，確保重新載入時獲取最新資料
    rawListCache.value = null;
    tableInstance?.reload();
  }
};

const openPasswordModal = async (record: Partial<TableListItem>) => {
  if (!record.account) {
    return;
  }
  await showModal({
    modalProps: {
      title: pt('dialog.changePassword', { account: record.account }),
      width: 520,
      async onFinish(values) {
        await Api.updateMasterAgentAccountPassword({
          account: String(record.account),
          newPassword: String(values.newPassword),
        });
        message.success(pt('message.changePasswordSuccess'));
      },
    },
    formProps: {
      labelWidth: 200,
      schemas: passwordSchemas,
    },
  });
};

const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? pt('dialog.editMasterAgent') : pt('dialog.createMasterAgent'),
      width: 860,
      async onFinish(values) {
        const roleIds = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        // 確保新增時必要欄位有預設
        const account = String(values.account ?? '');
        const websiteToUse = isMasterAgentX.value ? (values.website || account) : values.website;

        const internalSettings = buildInternalSettings(account, values);
        const remoteConfigURLs = buildRemoteConfigURLs(values);

        const payloadBase = {
          account,
          roles: roleIds,
          website: websiteToUse,
          isRanking: Boolean(values.isRanking),
          apiDomain: values.apiDomain,
          firebaseAdminSdkConfig: values.firebaseAdminSdkConfig,
          firebaseConfig: values.firebaseConfig,
          serviceEmail: values.serviceEmail,
          lineOfficialAccount: values.lineOfficialAccount,
          liffID: values.liffID,
          lineClientID: values.lineClientID,
          lineClientSecret: values.lineClientSecret,
          facebookID: values.facebookID,
          internalSettings,
          remoteConfigURLs,
        };

        if (isEdit && record?.id) {
          // Vue2 對齊：從表單 values 構建完整 payload，保留 record 中的必要欄位
          // 構建 reCaptchaV2Settings（Vue2 對齊：作為獨立欄位傳遞）
          const reCaptchaHasValue = Boolean(
            values.reCaptcha_secretKey || values.reCaptcha_name || values.reCaptcha_siteKey,
          );
          const reCaptchaV2Settings = reCaptchaHasValue
            ? {
                masterAgent: account,
                secretKey: String(values.reCaptcha_secretKey ?? ''),
                name: String(values.reCaptcha_name ?? ''),
                siteKey: String(values.reCaptcha_siteKey ?? ''),
                enabled: Boolean(values.reCaptcha_enabled),
                platform: 'web',
              }
            : undefined;

          const updatePayload = {
            id: Number(record.id),
            account,
            name: String(values.name ?? record.name ?? ''),
            prefix: values.prefix ?? record.prefix,
            isEnabled: Boolean(record.isEnabled), // 保持原有狀態
            isMaintained: Boolean(record.isMaintained), // 保持原有狀態
            roles: roleIds,
            website: websiteToUse,
            hashKey: record.hashKey, // 保留原有 hashKey
            currencyCode: values.currencyCode ?? record.currencyCode,
            apiDomain: values.apiDomain ?? record.apiDomain,
            whiteIPList: values.whiteIPList ?? record.whiteIPList ?? '',
            cdnList: values.cdnList ?? record.cdnList ?? '',
            proxyList: values.proxyList ?? record.proxyList ?? '',
            currencies: record.currencies ?? [], // 保留原有 currencies
            isSingleWallet: values.isSingleWallet !== undefined ? Boolean(values.isSingleWallet) : record.isSingleWallet,
            singleWallerVersion: values.singleWallerVersion !== undefined ? Number(values.singleWallerVersion) : record.singleWallerVersion,
            vipDowngradeFormula: values.vipDowngradeFormula !== undefined ? Number(values.vipDowngradeFormula) : record.vipDowngradeFormula,
            isRanking: Boolean(values.isRanking),
            levelFormula: values.levelFormula !== undefined ? Number(values.levelFormula) : record.levelFormula,
            activityFormula: values.activityFormula ?? record.activityFormula,
            levelUpNeedPoint: values.levelUpNeedPoint !== undefined ? values.levelUpNeedPoint : record.levelUpNeedPoint,
            gaKey: values.gaKey ?? record.gaKey ?? '',
            firebaseSdkConfig: values.firebaseSdkConfig ?? record.firebaseSdkConfig ?? '',
            firebaseAdminSdkConfig: values.firebaseAdminSdkConfig ?? record.firebaseAdminSdkConfig,
            firebaseConfig: values.firebaseConfig ?? record.firebaseConfig,
            iosPaymentKey: values.iosPaymentKey ?? record.iosPaymentKey ?? '',
            androidPaymentKey: values.androidPaymentKey ?? record.androidPaymentKey ?? '',
            ecPaymentKey: values.ecPaymentKey ?? record.ecPaymentKey ?? '',
            gcpKey: values.gcpKey ?? record.gcpKey ?? '',
            androidBundleID: values.androidBundleID ?? record.androidBundleID,
            iosBundleID: values.iosBundleID ?? record.iosBundleID,
            serviceEmail: values.serviceEmail ?? record.serviceEmail,
            facebookID: values.facebookID ?? record.facebookID,
            backendKey: record.backendKey, // 保留原有 backendKey
            agentBackendKey: record.agentBackendKey, // 保留原有 agentBackendKey
            isAllowMemberNicknameDuplicate: values.isAllowMemberNicknameDuplicate !== undefined
              ? Boolean(values.isAllowMemberNicknameDuplicate)
              : record.isAllowMemberNicknameDuplicate,
            internalSettings,
            remoteConfigURLs,
            reCaptchaV2Settings, // Vue2 對齊：作為獨立欄位
          };

          await Api.updateMasterAgentAccount(updatePayload);

          message.success(pt('message.editSuccess'));
          // 清空緩存，確保重新載入時獲取最新資料
          rawListCache.value = null;
          tableInstance?.reload();
        }
        else {
          await Api.createMasterAgentAccount({
            ...payloadBase,
            name: String(values.name ?? ''),
            prefix: values.prefix ?? undefined,
            password: '123456',
            currencyIndex: 1,
            currencyCode: values.currencyCode,
            currencyName: values.currencyCode,
            backendKey: generateSecret(),
            agentBackendKey: generateSecret(),
            hashKey: generateHashKey(),
            isEnabled: true,
            isSingleWallet: Boolean(values.isSingleWallet ?? false),
            singleWallerVersion: Number(values.singleWallerVersion ?? 1),
            vipDowngradeFormula: Number(values.vipDowngradeFormula ?? 1),
            levelFormula: Number(values.levelFormula ?? 0),
            isAllowMemberNicknameDuplicate: Boolean(values.isAllowMemberNicknameDuplicate ?? false),
            whiteIPList: values.whiteIPList ?? '',
            cdnList: values.cdnList ?? '',
            proxyList: values.proxyList ?? '',
            activityFormula: values.activityFormula,
            gaKey: values.gaKey ?? '',
            firebaseSdkConfig: values.firebaseSdkConfig ?? '',
            iosPaymentKey: values.iosPaymentKey ?? '',
            androidPaymentKey: values.androidPaymentKey ?? '',
            ecPaymentKey: values.ecPaymentKey ?? '',
            gcpKey: values.gcpKey ?? '',
            levelUpNeedPoint: values.levelUpNeedPoint ?? undefined,
          });
          message.success(pt('message.createSuccess'));
          rawListCache.value = null;
          tableInstance?.reload();
        }

        // tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 200,
      schemas: getMasterAgentSchemas({
        isMasterAgentX: isMasterAgentX.value,
        authLevel: userStore.level,
        t: pageI18n.t,
      }),
    },
  });

  if (isEdit && record) {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter(n => Number.isFinite(n));
    const internalObj: any = safeJsonParse(record.internalSettings) ?? {};
    const paymentSettings = internalObj?.paymentSettings ?? {};
    const smsSettings = internalObj?.smsSettings ?? {};
    const accountSettings = internalObj?.accountSettings ?? {};
    const transactionSettings = internalObj?.transactionSettings ?? {};

    const remoteObj: any = safeJsonParse(record.remoteConfigURLs) ?? {};

    // 對齊 vue2：先從 internalSettings.accountSettings.lingLoginConfig 讀取，然後如果 remoteConfigURLs.lingLoginConfig 存在則覆蓋
    const lingLoginConfigBase = accountSettings?.lingLoginConfig ?? {};
    const lingLoginConfigRemote = remoteObj?.lingLoginConfig ?? {};
    const lingLoginConfig = {
      ...lingLoginConfigBase,
      ...lingLoginConfigRemote,
    };

    const myCard = paymentSettings?.myCard ?? {};

    formRef?.setFieldsValue({
      account: record.account,
      website: record.website,
      apiDomain: record.apiDomain,
      isRanking: Boolean(record.isRanking),
      roles: roleIds,

      // Firebase 設定
      firebaseAdminSdkConfig: (record as any)?.firebaseAdminSdkConfig,
      firebaseConfig: (record as any)?.firebaseConfig,

      // 客服/Line/Facebook（對齊 vue2：優先使用 remoteConfigURLs，如果沒有則使用 internalSettings）
      serviceEmail: remoteObj?.serviceEmail ?? (record as any)?.serviceEmail,
      lineOfficialAccount: lingLoginConfig?.lineOfficialAccount ?? '',
      liffID: lingLoginConfig?.liffID ?? '',
      lineClientID: lingLoginConfig?.clientID ?? '',
      lineClientSecret: lingLoginConfig?.clientSecret ?? '',
      facebookID: remoteObj?.facebookID ?? (record as any)?.facebookID,

      // MyCard 設定
      myCard_facServiceID: myCard?.facServiceID ?? '',
      myCard_secretKey: myCard?.secretKey ?? '',
      myCard_allowIPs: myCard?.allowIPs ?? '',
      myCard_topUpSecretKeyA: myCard?.topUpSecretKeyA ?? '',
      myCard_topUpSecretKeyB: myCard?.topUpSecretKeyB ?? '',
      myCard_topUpFacId: myCard?.topUpFacId ?? '',

      // 簡訊設定
      boSmsAccount: smsSettings?.boSmsAccount ?? '',
      boSmsPassWord: smsSettings?.boSmsPassWord ?? '',

      // 交易設定（從 internalSettings.transactionSettings 讀取，對齊 vue2）
      transactionSetting: Boolean(transactionSettings?.minTransactionBalance !== undefined),
      minTransactionBalance: transactionSettings?.minTransactionBalance ?? 0,
      sendSmsOTPIntervals: transactionSettings?.sendSmsOTPIntervals?.value ?? 2,
      authExpireTime: transactionSettings?.authExpireTime?.value ?? 30,
      spinUnfreezeRatio: transactionSettings?.spinUnfreezeRatio ?? 0,
      onePhoneNumberToAccountCounts: accountSettings?.onePhoneNumberToAccountCounts ?? 1,

      // 人機驗證
      reCaptcha_secretKey: (remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.secretKey ?? '',
      reCaptcha_name: (remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.name ?? '',
      reCaptcha_siteKey: (remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.siteKey ?? '',
      reCaptcha_enabled: Boolean((remoteObj?.reCaptchaV2Settings ?? internalObj?.reCaptchaV2Settings)?.enabled),

      // raw json（僅管理員顯示）
      internalSettings: record.internalSettings,
      remoteConfigURLs: record.remoteConfigURLs,
    });

    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: true } }]);
  }
  else {
    formRef?.setFieldsValue({
      isRanking: true,
      transactionSetting: false,
      onePhoneNumberToAccountCounts: 1,
      minTransactionBalance: 0,
      sendSmsOTPIntervals: 2,
      authExpireTime: 30,
      spinUnfreezeRatio: 0,
      reCaptcha_enabled: false,
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: false } }]);
  }
};

/**
 * 計算表格總寬度：所有欄位寬度總和
 * 基礎欄位：account(160) + name(160) + isMaintained(100) + adminMaintained(100) + roles(220) + website(160) + currencies(100) = 1000
 * 管理員額外欄位：isSingleWallet(120) + apiDomain(140) + whiteIPList(140) + cdnList(140) = 540
 * 共用欄位：createDatetime(180) = 180
 * 操作欄：ACTION(250)
 * 管理員總和：1000 + 540 + 180 + 250 = 1970
 * 非管理員總和：1000 + 180 + 250 = 1430
 */
const calculateTableScrollX = () => {
  /** account + name + isMaintained + adminMaintained + roles + website + currencies */
  const baseColumnsWidth = 1000;
  /** isSingleWallet + apiDomain + whiteIPList + cdnList */
  const adminOnlyColumnsWidth = 540;
  /** createDatetime */
  const commonColumnsWidth = 180;
  /** ACTION */
  const actionColumnWidth = 250;
  const totalWidth = userStore.level === 1
    ? baseColumnsWidth + adminOnlyColumnsWidth + commonColumnsWidth + actionColumnWidth
    : baseColumnsWidth + commonColumnsWidth + actionColumnWidth;
  /** 加上一些緩衝空間，確保不會出現跑版 */
  return totalWidth + 50;
};

const columns = ref<TableColumnItem[]>([
  ...getBaseColumns(pt, userStore.level),
  {
    title: pt('action.operation'),
    dataIndex: 'ACTION',
    width: 250,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => {
      // 判斷是否為子行（展開的帳號）
      // 方法1: 檢查 record 是否有 __isChild 標識
      let isChildRow = Boolean((record as any).__isChild);

      /**
       * 方法2: 如果還沒有判斷出是子行，嘗試通過檢查表格數據結構來判斷
       * 檢查當前記錄是否在原始數據的頂層，如果不在頂層，則可能是子行
       */
      if (!isChildRow) {
        try {
          // 檢查原始緩存數據
          if (rawListCache.value && Array.isArray(rawListCache.value)) {
            // 檢查當前記錄是否在頂層數據中
            const isTopLevel = rawListCache.value.some((item: any) => {
              return item.id === record.id || item.account === record.account;
            });

            // 如果不在頂層，則可能是子行
            if (!isTopLevel) {
              isChildRow = true;
            }
            else {
              // 如果在頂層，再檢查表格數據結構，看是否在任何父級的 children 中
              if (tableInstance) {
                const tableData = (tableInstance as any).tableData?.value || [];
                /**
                 * 遞歸檢查當前記錄是否在任何父級的 children 中
                 */
                const checkIfChild = (data: any[]): boolean => {
                  for (const item of data) {
                    if (Array.isArray(item.children) && item.children.length > 0) {
                      // 檢查當前記錄是否在這個父級的 children 中
                      const found = item.children.some((child: any) => {
                        return child.id === record.id || child.account === record.account;
                      });
                      if (found) {
                        return true;
                      }
                      // 遞歸檢查更深層的 children
                      if (checkIfChild(item.children)) {
                        return true;
                      }
                    }
                  }
                  return false;
                };
                isChildRow = checkIfChild(tableData);
              }
            }
          }
        }
        catch (e) {
          // 如果無法訪問表格數據，忽略錯誤
          console.warn('無法檢查表格數據結構:', e);
        }
      }

      // 如果是子行，不顯示操作按鈕
      if (isChildRow) {
        return [];
      }

      return [
        {
          label: pt('action.edit'),
          type: 'link',
          onClick: () => openFormModal(record),
        },
        {
          label: '編輯2',
          type: 'link',
          onClick: () => openEditWizard(record),
        },
        {
          label: pt('action.changePassword'),
          type: 'link',
          onClick: () => openPasswordModal(record),
        },
        {
          label: record.isMaintained ? pt('action.enableMaintained') : pt('action.disableMaintained'),
          type: 'link',
          popConfirm: {
            title: pt('confirm.enableMaintained', {
              action: record.isMaintained ? pt('labels.enable') : pt('labels.disable'),
              account: record.account,
            }),
            onConfirm: async () => {
              await toggleMaintained(record, !record.isMaintained);
            },
          },
        },
        {
          label: record.isEnabled ? pt('action.disableAccount') : pt('action.enableAccount'),
          type: 'link',
          popConfirm: {
            title: pt('confirm.enableAccount', {
              action: record.isEnabled ? pt('labels.disable') : pt('labels.enable'),
              account: record.account,
            }),
            onConfirm: async () => {
              await toggleEnabled(record, !record.isEnabled);
            },
          },
        },
      ];
    },
  },
]);

// 避免 antd table 內被 tree-shake 的 import
void Modal;
</script>

<template>
  <div class="master-agent-page">
    <DynamicTable
      row-key="id"
      :header-title="t('masterAgent')"
      :data-request="loadTableData"
      :columns="columns"
      :scroll="{ x: calculateTableScrollX() }"
      :form-props="{
        showSubmitButton: true,
        showResetButton: true,
        showAdvancedButton: true,
        submitOnReset: true,
        submitButtonOptions: {
          text: pt('queryText'),
        },
      }"
    >
      <template #toolbar>
        <a-space>
          <a-button type="primary" :disabled="!canCreate" @click="openFormModal()">
            {{ pt('button.add') }}
          </a-button>
          <a-button type="primary" ghost :disabled="!canCreate" @click="goCreateWizard">
            {{ pt('button.createWizard') }}
          </a-button>
        </a-space>
      </template>
    </DynamicTable>

    <CreateWizardDialog
      :visible="wizardVisible"
      :account-type="isMasterAgentX ? 'masterAgentX' : 'masterAgent'"
      @update:visible="handleWizardClose"
      @success="handleWizardSuccess"
    />
    <CreateWizardDialog
      :visible="editWizardVisible"
      :account-type="isMasterAgentX ? 'masterAgentX' : 'masterAgent'"
      :edit-record="editWizardRecord"
      @update:visible="handleEditWizardClose"
      @success="handleEditWizardSuccess"
    />
  </div>
</template>
