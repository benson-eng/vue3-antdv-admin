<script setup lang="ts">
import { message, Modal } from 'ant-design-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import AuthenticatorApi from '@/api/backend/adminAccount/authenticator';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'AdminAccountAuthenticator' });

interface ViewItem {
  id: number;
  account: string;
  backendKey?: string;
  authenticator: boolean;
  originalAuthenticator: boolean;
  hierarchyLevel?: number;
  masterAgent?: string;
  canReset: boolean;
  style?: string;
  otpauth?: string;
  qrcodeUrl?: string;
}

const userStore = useUserStore();
const loading = ref(false);
const saving = ref(false);

const list = ref<ViewItem[]>([]);
const filterLevel = ref<string | undefined>(undefined);

const changes = reactive(new Map<number, { id: number; account: string; authenticator: boolean }>());

const authLevel = computed(() => Number(userStore.level ?? -1));
const canEditAuthenticator = computed(() => authLevel.value <= 2);
const canSave = computed(() => canEditAuthenticator.value && changes.size > 0);

const filterLevelOptions = [
  { label: '站長', value: '3' },
  { label: '族長', value: '4' },
];

const showLevelFilter = computed(() => {
  // 沒有沿用 Vue2 的 isDistributionPlatform 判斷，改為「有 3/4 層級資料就顯示」
  return list.value.some(i => i.hierarchyLevel === 3 || i.hierarchyLevel === 4);
});

const filteredList = computed(() => {
  if (!filterLevel.value) {
    return list.value;
  }
  const lv = Number(filterLevel.value);
  return list.value.filter(i => Number(i.hierarchyLevel) === lv);
});

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

const generateBackendKey = () => {
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

const buildOtpauth = (account: string, backendKey: string) => {
  // Vue2：otpauth://totp/${account}?secret=${backendKey}
  return `otpauth://totp/${encodeURIComponent(account)}?secret=${encodeURIComponent(backendKey)}`;
};

const buildQrUrl = (otpauth: string) => {
  // Vue2：api.qrserver.com
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpauth)}&size=150x150`;
};

const computeStyle = (hierarchyLevel?: number) => {
  switch (Number(hierarchyLevel)) {
    case 1:
      return 'text-shadow:2px 3px 5px #ff0000';
    case 2:
      return 'text-shadow:2px 3px 5px #ffa500';
    case 3:
      return 'text-shadow:2px 3px 5px #008000';
    case 4:
      return 'text-shadow:2px 3px 5px #0000ff';
    default:
      return '';
  }
};

const resolveUserId = (all: any[]) => {
  const level = authLevel.value;
  const account = String(userStore.account ?? '');
  const masterAgent = String(userStore.masterAgent ?? '');
  const targetAccount = level === 4 ? `${account}.${masterAgent}` : account;
  const found = all.find((i: any) => String(i?.account ?? '') === targetAccount);
  return found?.id ? String(found.id) : '';
};

const canInListByLevel = (item: any, userId: string) => {
  const level = authLevel.value;
  const itemLevel = Number(item?.hierarchyLevel ?? item?.hierarchyLevel?.toString?.() ?? -1);

  switch (level) {
    case 1:
      return true;
    case 2:
      return itemLevel >= 2;
    case 3:
      return itemLevel >= 3 && String(item?.masterAgent ?? '') === String(userStore.masterAgent ?? '');
    case 4:
      return String(item?.id ?? '') === userId;
    default:
      return false;
  }
};

const computeCanReset = (item: any) => {
  const current = String(userStore.account ?? '');
  const target = String(item?.account ?? '');
  if (current !== 'admin' && target === 'admin') {
    return false;
  }
  if (current !== 'admin' && current !== 'cg' && target === 'cg') {
    return false;
  }
  return true;
};

const normalize = (raw: any[]): ViewItem[] => {
  const all = Array.isArray(raw) ? raw : [];
  const userId = resolveUserId(all);

  const re: ViewItem[] = [];
  for (const item of all) {
    // Vue2：if (getAuthLevel <= item.hierarchyLevel) ... 再做 canInList
    if (authLevel.value > Number(item?.hierarchyLevel ?? 999)) {
      continue;
    }
    if (!canInListByLevel(item, userId)) {
      continue;
    }

    const account = String(item?.account ?? '');
    const backendKey = item?.backendKey ? String(item.backendKey) : '';
    const authenticator = Boolean(item?.authenticator ?? item?.Authenticator ?? false);
    const otpauth = backendKey ? buildOtpauth(account, backendKey) : '';

    re.push({
      id: Number(item?.id),
      account,
      backendKey: backendKey || undefined,
      authenticator,
      originalAuthenticator: authenticator,
      hierarchyLevel: Number(item?.hierarchyLevel),
      masterAgent: String(item?.masterAgent ?? ''),
      canReset: computeCanReset(item),
      style: computeStyle(item?.hierarchyLevel),
      otpauth: otpauth || undefined,
      qrcodeUrl: otpauth ? buildQrUrl(otpauth) : undefined,
    });
  }

  return re;
};

const reload = async () => {
  loading.value = true;
  try {
    const raw = await AuthenticatorApi.getAllAccount();
    list.value = normalize(raw as any);
    changes.clear();
    if (filterLevel.value && !showLevelFilter.value) {
      filterLevel.value = undefined;
    }
  }
  catch (e) {
    console.error(e);
    message.error('載入失敗');
  }
  finally {
    loading.value = false;
  }
};

const onToggleAuthenticator = (record: ViewItem, checked: boolean) => {
  record.authenticator = Boolean(checked);
  if (record.authenticator === record.originalAuthenticator) {
    changes.delete(record.id);
  }
  else {
    changes.set(record.id, { id: record.id, account: record.account, authenticator: record.authenticator });
  }
};

const save = async () => {
  if (!canSave.value) {
    return;
  }
  saving.value = true;
  try {
    const settings = Array.from(changes.values()).map(i => ({
      id: i.id,
      account: i.account,
      authenticator: i.authenticator,
    }));
    await AuthenticatorApi.bulkUpdateBackendKeyAndAuthenticator({ settings });
    message.success('儲存成功');
    await reload();
  }
  catch (e) {
    console.error(e);
    message.error('儲存失敗');
  }
  finally {
    saving.value = false;
  }
};

const resetBackendKey = async (record: ViewItem) => {
  if (!record?.id || !record?.account) {
    return;
  }
  Modal.confirm({
    title: '重置 BackendKey',
    content: `確定要重置：${record.account}？`,
    okText: '確定',
    cancelText: '取消',
    async onOk() {
      const backendKey = generateBackendKey();
      await AuthenticatorApi.bulkUpdateBackendKeyAndAuthenticator({
        settings: [{ id: record.id, account: record.account, backendKey }],
      });
      message.success('重置成功');
      await reload();
    },
  });
};

const qrModalOpen = ref(false);
const qrModalTitle = ref('');
const qrModalUrl = ref('');
const qrModalOtplink = ref('');

const openQr = (record: ViewItem) => {
  qrModalTitle.value = record.account;
  qrModalUrl.value = record.qrcodeUrl || '';
  qrModalOtplink.value = record.otpauth || '';
  qrModalOpen.value = true;
};

onMounted(reload);
</script>

<template>
  <div class="app-container">
    <a-space style="margin-bottom: 12px; width: 100%; justify-content: space-between">
      <a-space>
        <a-select
          v-if="showLevelFilter"
          v-model:value="filterLevel"
          style="width: 200px"
          allow-clear
          placeholder="篩選層級"
        >
          <a-select-option v-for="opt in filterLevelOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
      </a-space>

      <a-space>
        <a-button :loading="loading" @click="reload">
          重新整理
        </a-button>
        <a-button type="primary" :disabled="!canSave" :loading="saving" @click="save">
          儲存
        </a-button>
      </a-space>
    </a-space>

    <a-table
      :data-source="filteredList"
      :loading="loading"
      :pagination="{ pageSize: 20, showSizeChanger: true }"
      :row-key="r => r.id"
      bordered
    >
      <a-table-column title="ID" data-index="id" :width="100" />

      <a-table-column title="帳號" data-index="account">
        <template #default="{ record }">
          <span :style="record.style">{{ record.account }}</span>
        </template>
      </a-table-column>

      <a-table-column title="BackendKey" data-index="backendKey" />

      <a-table-column v-if="canEditAuthenticator" key="authenticator" title="啟用" :width="120">
        <template #default="{ record }">
          <a-switch
            :checked="Boolean(record.authenticator)"
            :disabled="!canEditAuthenticator"
            @change="checked => onToggleAuthenticator(record, checked)"
          />
        </template>
      </a-table-column>

      <a-table-column key="actions" title="操作" :width="220">
        <template #default="{ record }">
          <a-space>
            <a-button size="small" :disabled="!record.qrcodeUrl" @click="openQr(record)">
              QRcode
            </a-button>
            <a-button
              size="small"
              type="primary"
              danger
              :disabled="!record.canReset"
              @click="resetBackendKey(record)"
            >
              重置
            </a-button>
          </a-space>
        </template>
      </a-table-column>
    </a-table>

    <a-modal v-model:open="qrModalOpen" title="QRcode" :footer="null" :destroy-on-close="true">
      <div style="text-align: center">
        <div style="margin-bottom: 12px; font-weight: 600">
          {{ qrModalTitle }}
        </div>
        <img v-if="qrModalUrl" :src="qrModalUrl" alt="qrcode">
        <div v-if="qrModalOtplink" style="margin-top: 12px; word-break: break-all; color: #666">
          {{ qrModalOtplink }}
        </div>
      </div>
    </a-modal>
  </div>
</template>





