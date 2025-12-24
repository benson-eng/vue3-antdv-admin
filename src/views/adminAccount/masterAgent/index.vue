<template>
  <DynamicTable
    row-key="id"
    header-title="總代理管理"
    :data-request="loadTableData"
    :columns="columns"
    :form-props="{ schemas: [] }"
  >
    <template #form-formHeader>
      <a-col :span="24">
        <a-row :gutter="16" align="middle">
          <a-col :span="6">
            <a-form-item label="帳號" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-input v-model:value="searchAccount" placeholder="請輸入帳號" />
            </a-form-item>
          </a-col>

          <a-col :span="6">
            <a-form-item label="啟用" class="mb-0" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
              <a-select v-model:value="searchIsEnabled" :options="statusOptions" allow-clear placeholder="全部" />
            </a-form-item>
          </a-col>

          <a-col :span="12">
            <a-form-item label="建立時間" class="mb-0" :label-col="{ span: 5 }" :wrapper-col="{ span: 19 }">
              <a-range-picker
                v-model:value="searchDateRange"
                style="width: 100%"
                :allow-clear="true"
                format="YYYY-MM-DD"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-col>
    </template>

    <template #toolbar>
      <a-space>
        <a-button type="primary" :disabled="!canCreate" @click="openFormModal()">
          新增
        </a-button>
        <a-button type="primary" ghost :disabled="!canCreate" @click="goCreateWizard">
          導引式建立
        </a-button>
      </a-space>
    </template>
  </DynamicTable>
</template>

<script setup lang="tsx">
import { computed, ref } from 'vue';
import { message, Modal, Tag, Switch } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';
import { useRoute, useRouter } from 'vue-router';
import { useTable } from '@/components/core/dynamic-table';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import Api, { type MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import { baseColumns, type TableColumnItem, type TableListItem } from './columns';
import { getMasterAgentSchemas, passwordSchemas } from './formSchemas';

defineOptions({ name: 'AdminAccountMasterAgent' });

const userStore = useUserStore();
const canCreate = computed(() => userStore.level === 2);
const router = useRouter();
const route = useRoute();
const isMasterAgentX = computed(() => route.name === 'AdminAccountMasterAgentX' || String(route.path).endsWith('/masterAgentX'));

const [DynamicTable, tableInstance] = useTable({
  search: true, // 保留搜尋區容器
});
const [showModal] = useFormModal();

const goCreateWizard = () => {
  // 根據當前路由判斷 accountType
  const accountType = isMasterAgentX.value ? 'masterAgentX' : 'masterAgent';
  router.push({
    path: '/adminAccount/create-wizard',
    query: { accountType },
  });
};

const searchAccount = ref<string>('');
const searchIsEnabled = ref<'true' | 'false' | undefined>(undefined);
const searchDateRange = ref<[Dayjs, Dayjs] | undefined>(undefined);

const statusOptions = [
  { label: '啟用', value: 'true' },
  { label: '停用', value: 'false' },
];

type TableListResponse = {
  items: TableListItem[];
  meta: { totalItems: number };
};

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
  const bytes = window.crypto.getRandomValues(new Uint8Array(20)); // 160-bit
  return toBase32(bytes);
};

const generateHashKey = () => {
  // Vue2 用 generate-password(length=15)，這裡用 base32 並裁 15 位
  return generateSecret().slice(0, 15);
};

const safeJsonStringify = (obj: any) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
};

const safeJsonParse = (raw?: string) => {
  if (!raw || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const normalizeFirebaseConfigApiKey = (raw: any) => {
  // Vue2：internalSettings.firebaseAPIKey 取自 firebaseConfig.apiKey
  if (!raw) return '';
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return String(obj?.apiKey ?? '');
  } catch {
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

  const internalSettings = {
    firebaseAPIKey: normalizeFirebaseConfigApiKey(values.firebaseConfig),
    paymentSettings: {
      masterAgent: account,
      paymentMode: values.paymentMode ?? 'Real',
      topUpRate: Number(values.topUpRate ?? 100),
      // 對齊 Vue2 結構：保留物件（未展開 provider 細節）
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

const loadTableData = async (params: LoadDataParams): Promise<TableListResponse> => {
  const list = await Api.getMasterAgentAccountList({});

  const keyword = searchAccount.value.trim().toLowerCase();
  const range = searchDateRange.value;
  const start = range?.[0]?.startOf?.('day')?.valueOf?.();
  const end = range?.[1]?.endOf?.('day')?.valueOf?.();

  const filtered = (Array.isArray(list) ? list : [])
    // Vue2：只顯示「啟用」或「非維護」的總代
    .filter((i: any) => Boolean(i?.isEnabled) || !Boolean(i?.isMaintained))
    .filter((i: any) => {
      if (keyword && !String(i?.account ?? '').toLowerCase().includes(keyword)) return false;
      if (
        searchIsEnabled.value !== undefined &&
        Boolean(i?.isEnabled) !== (searchIsEnabled.value === 'true')
      )
        return false;

      if (start != null && end != null) {
        const ts = i?.createDatetime ? new Date(i.createDatetime).getTime() : NaN;
        if (Number.isFinite(ts)) {
          if (ts < start || ts > end) return false;
        }
      }
      return true;
    })
    .map((i: any) => ({
      ...i,
      id: Number(i.id),
      account: String(i.account ?? ''),
      name: String(i.name ?? ''),
      isEnabled: Boolean(i.isEnabled),
      isMaintained: Boolean(i.isMaintained),
      roles: Array.isArray(i.roles) ? i.roles : [],
    }));

  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);
  const totalItems = filtered.length;
  const startIdx = (page - 1) * limit;
  const endIdx = startIdx + limit;
  const items = filtered.slice(startIdx, endIdx);

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
    message.success('更新成功');
    tableInstance?.reload();
  } catch (e) {
    console.error(e);
    message.error('更新失敗');
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
    message.success('更新成功');
    tableInstance?.reload();
  } catch (e) {
    console.error(e);
    message.error('更新失敗');
    tableInstance?.reload();
  }
};

const openPasswordModal = async (record: Partial<TableListItem>) => {
  if (!record.account) return;
  await showModal({
    modalProps: {
      title: `變更密碼：${record.account}`,
      width: 520,
      async onFinish(values) {
        await Api.updateMasterAgentAccountPassword({
          account: String(record.account),
          newPassword: String(values.newPassword),
        });
        message.success('變更成功');
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: passwordSchemas,
    },
  });
};

const openFormModal = async (record?: Partial<TableListItem>) => {
  const isEdit = Boolean(record?.id);

  const [formRef] = await showModal({
    modalProps: {
      title: isEdit ? '編輯總代理' : '新增總代理',
      width: 860,
      async onFinish(values) {
        const roleIds = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        // 確保新增時必要欄位有預設
        const account = String(values.account ?? '');
        const websiteToUse = isMasterAgentX.value ? (values.website || account) : values.website;

        const activityFormula =
          !isMasterAgentX.value && values.activityFormulaRatio
            ? {
                name: 'default',
                formula: 'defaultFormula',
                params: { ratio: Number(values.activityFormulaRatio) },
              }
            : undefined;

        const internalSettings = buildInternalSettings(account, values);
        const remoteConfigURLs = buildRemoteConfigURLs(values);

        const payloadBase = {
          ...values,
          account,
          name: String(values.name ?? ''),
          roles: roleIds,
          website: websiteToUse,
          activityFormula,
          internalSettings,
          remoteConfigURLs,
          // slotGameSettings 走 internalSettings，但後端仍可能接受獨立欄位，保留送出
          slotGameSettings: {
            waitingSettleTime: Number(values.slot_waitingSettleTime ?? 30),
            oneTimeToken: Boolean(values.slot_oneTimeToken),
            prizeDecimalPlaces: Number(values.slot_prizeDecimalPlaces ?? 2),
          },
        };

        if (isEdit && record?.id) {
          await Api.updateMasterAgentAccount({
            ...buildUpdatePayload(record),
            ...payloadBase,
            id: Number(record.id),
          });

          // 股東歸屬（對齊 Vue2：updateMasterAgentShareholder/removeMasterAgentFromShareholder）
          if (!isMasterAgentX.value) {
            const newShareholderAccount = String(values.shareholderAccount ?? '').trim();
            const oldShareholderAccount = String((record as any)?.shareholder?.account ?? '').trim();
            if (newShareholderAccount && newShareholderAccount !== oldShareholderAccount) {
              await Api.updateMasterAgentShareholder({
                masterAgentAccount: account,
                shareholderAccount: newShareholderAccount,
              });
            }
            if (!newShareholderAccount && oldShareholderAccount) {
              await Api.removeMasterAgentFromShareholder({ masterAgentAccount: account });
            }
          }
          message.success('編輯成功');
        } else {
          await Api.createMasterAgentAccount({
            ...payloadBase,
            password: '123456',
            currencyIndex: 1,
            backendKey: generateSecret(),
            agentBackendKey: generateSecret(),
            hashKey: String(values.hashKey || generateHashKey()),
          });

          if (!isMasterAgentX.value) {
            const shareholderAccount = String(values.shareholderAccount ?? '').trim();
            if (shareholderAccount) {
              await Api.updateMasterAgentShareholder({
                masterAgentAccount: account,
                shareholderAccount,
              });
            }
          }
          message.success('新增成功');
        }

        tableInstance?.reload();
      },
    },
    formProps: {
      labelWidth: 140,
      schemas: getMasterAgentSchemas({ isMasterAgentX: isMasterAgentX.value, authLevel: userStore.level }),
    },
  });

  if (isEdit && record) {
    const roleIds = (record.roles || []).map((r: any) => Number(r.id)).filter((n) => Number.isFinite(n));
    const internalObj: any = safeJsonParse(record.internalSettings) ?? {};
    const paymentSettings = internalObj?.paymentSettings ?? {};
    const smsSettings = internalObj?.smsSettings ?? {};
    const accountSettings = internalObj?.accountSettings ?? {};
    const slotGameSettings = internalObj?.slotGameSettings ?? {};

    const remoteObj: any = safeJsonParse(record.remoteConfigURLs) ?? {};
    const lingLoginConfig = remoteObj?.lingLoginConfig ?? accountSettings?.lingLoginConfig ?? {};

    formRef?.setFieldsValue({
      account: record.account,
      name: record.name,
      website: record.website,
      roles: roleIds,
      hashKey: record.hashKey,
      currencyCode: (record as any).currencyCode,
      shareholderAccount: (record as any)?.shareholder?.account ?? '',
      apiDomain: record.apiDomain,
      whiteIPList: record.whiteIPList,
      cdnList: record.cdnList,
      proxyList: record.proxyList,
      isSingleWallet: Boolean(record.isSingleWallet),
      singleWallerVersion: record.singleWallerVersion ?? 1,
      vipDowngradeFormula: record.vipDowngradeFormula ?? 1,
      isRanking: Boolean(record.isRanking),
      levelFormula: record.levelFormula ?? 0,
      activityFormulaRatio: (record as any)?.activityFormula?.params?.ratio ?? 1,
      levelUpNeedPoint: record.levelUpNeedPoint,
      isAllowMemberNicknameDuplicate: Boolean(record.isAllowMemberNicknameDuplicate),

      // 進階欄位
      gaKey: (record as any)?.gaKey,
      firebaseSdkConfig: (record as any)?.firebaseSdkConfig,
      firebaseAdminSdkConfig: (record as any)?.firebaseAdminSdkConfig,
      firebaseConfig: (record as any)?.firebaseConfig,
      iosPaymentKey: (record as any)?.iosPaymentKey,
      androidPaymentKey: (record as any)?.androidPaymentKey,
      ecPaymentKey: (record as any)?.ecPaymentKey,
      gcpKey: (record as any)?.gcpKey,
      androidBundleID: (record as any)?.androidBundleID,
      iosBundleID: (record as any)?.iosBundleID,
      serviceEmail: remoteObj?.serviceEmail ?? (record as any)?.serviceEmail,
      facebookID: remoteObj?.facebookID ?? (record as any)?.facebookID,

      // 金流/簡訊/slot（來源：internalSettings）
      myCardShowType: Boolean((record as any)?.myCardShowType),
      soNetShowType: Boolean((record as any)?.soNetShowType),
      nganLuongShowType: Boolean((record as any)?.nganLuongShowType),
      moPayShowType: Boolean((record as any)?.moPayShowType),
      btPayShowType: Boolean((record as any)?.btPayShowType),
      paymentMode: paymentSettings?.paymentMode ?? 'Real',
      topUpRate: paymentSettings?.topUpRate ?? 100,

      smsAccount: smsSettings?.smsAccount ?? '',
      smsPassWord: smsSettings?.smsPassWord ?? '',
      boSmsAccount: smsSettings?.boSmsAccount ?? '',
      boSmsPassWord: smsSettings?.boSmsPassWord ?? '',
      cloudSmsAccount: smsSettings?.cloudSmsAccount ?? '',
      cloudSmsPassWord: smsSettings?.cloudSmsPassWord ?? '',
      onePhoneNumberToAccountCounts: accountSettings?.onePhoneNumberToAccountCounts ?? 1,

      slot_waitingSettleTime: slotGameSettings?.waitingSettleTime ?? 30,
      slot_oneTimeToken: Boolean(slotGameSettings?.oneTimeToken),
      slot_prizeDecimalPlaces: slotGameSettings?.prizeDecimalPlaces ?? 2,

      // Line（remoteConfigURLs 優先）
      lineOfficialAccount: lingLoginConfig?.lineOfficialAccount ?? '',
      liffID: lingLoginConfig?.liffID ?? '',
      lineClientID: lingLoginConfig?.clientID ?? '',
      lineClientSecret: lingLoginConfig?.clientSecret ?? '',

      // raw json（僅管理員顯示）
      internalSettings: record.internalSettings,
      remoteConfigURLs: record.remoteConfigURLs,
    });

    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: true } }]);
  } else {
    formRef?.setFieldsValue({
      hashKey: generateHashKey(),
      activityFormulaRatio: 1,
      slot_waitingSettleTime: 30,
      slot_prizeDecimalPlaces: 2,
      slot_oneTimeToken: false,
    });
    formRef?.updateSchema([{ field: 'account', componentProps: { disabled: false } }]);
  }
};

const columns = ref<TableColumnItem[]>([
  ...baseColumns,
  {
    title: '啟用',
    dataIndex: 'isEnabled',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Switch
        checked={Boolean(record.isEnabled)}
        checkedChildren="啟用"
        unCheckedChildren="停用"
        onChange={(checked) => toggleEnabled(record, Boolean(checked))}
      />
    ),
  },
  {
    title: '維護',
    dataIndex: 'isMaintained',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Switch
        checked={Boolean(record.isMaintained)}
        checkedChildren="維護"
        unCheckedChildren="運行"
        onChange={(checked) => toggleMaintained(record, Boolean(checked))}
      />
    ),
  },
  {
    title: '狀態',
    dataIndex: 'statusTag',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Tag color={record.isEnabled ? 'green' : 'red'}>{record.isEnabled ? '啟用' : '停用'}</Tag>
    ),
  },
  {
    title: '操作',
    dataIndex: 'ACTION',
    width: 220,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: '編輯',
        type: 'link',
        onClick: () => openFormModal(record),
      },
      {
        label: '改密碼',
        type: 'link',
        onClick: () => openPasswordModal(record),
      },
      {
        label: '更多',
        type: 'link',
        popConfirm: {
          title: '將會顯示更多進階設定（後續補齊）',
          okText: '知道了',
          cancelButtonProps: { style: { display: 'none' } },
          onConfirm: () => {},
        },
      },
      {
        label: '停用/啟用',
        type: 'link',
        popConfirm: {
          title: `確認要${record.isEnabled ? '停用' : '啟用'} ${record.account}？`,
          onConfirm: async () => {
            await Api.updateMasterAgentAccount(buildUpdatePayload(record, { isEnabled: !record.isEnabled }));
            message.success('更新成功');
            tableInstance?.reload();
          },
        },
      },
      {
        label: '維護切換',
        type: 'link',
        popConfirm: {
          title: `確認要${record.isMaintained ? '取消維護' : '設為維護'} ${record.account}？`,
          onConfirm: async () => {
            await Api.updateMasterAgentAccount(buildUpdatePayload(record, { isMaintained: !record.isMaintained }));
            message.success('更新成功');
            tableInstance?.reload();
          },
        },
      },
    ],
  },
]);

// 避免 antd table 內被 tree-shake 的 import
void Modal;
</script>




