<script setup lang="ts">
import type { AccountBaseInfoItem, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { TransactionMemberSettingItem } from '@/api/backend/transactionSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, h, inject, ref, watch } from 'vue';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import {
  queryTransactionMemberSettings,
  removeTransactionMemberSetting,
  setTransactionMemberSetting,

} from '@/api/backend/transactionSystem';

import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'TransactionMemberSetting',
});

const i18n = useI18n('routes.member.transactionMemberSettingPage');
const t = i18n.t;

// 從 Breadcrumb Context 取得站長狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);
const tableLoading = ref(false);
const currentList = ref<TransactionMemberSettingItem[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';
interface MemberSelectValue { value: string; label: string }
type ModalMode = 'add' | 'edit';

const modalOpen = ref(false);
const isEditReady = ref(true);
const modalSubmitting = ref(false);
const modalMode = ref<ModalMode>('add');
const form = ref<{ member?: MemberSelectValue; serviceTariff: number | undefined }>({
  member: undefined,
  serviceTariff: undefined,
});

// =========================
// Member remote options
// =========================

interface MemberOption { label: string; value: string; disabled?: boolean; raw?: FuzzyQueryUserItem }

const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

const unselectableSet = computed(() => new Set(currentList.value.map(i => i.memberID)));

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    const disabled = unselectableSet.value.has(value) && form.value.member?.value !== value;
    return {
      raw: item,
      value,
      label: `${item.accountID} - ${item.nickName}`,
      disabled,
    };
  });

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const res = await fuzzyQueryUser({
      masterAgent,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });
    const list = Array.isArray(res) ? res : [];
    const mapped = mapMemberOptions(list);
    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => fetchMemberOptions(text, false), 250);

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom) {
    return;
  }
  if (!memberLastQueryText.value) {
    return;
  }
  if (!memberLastAccountID.value) {
    return;
  }
  await fetchMemberOptions(memberLastQueryText.value, true);
};

const preloadMemberOptionLabel = async (memberID: string, nickName?: string, accountID?: string): Promise<MemberSelectValue | null> => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!memberID) {
    memberOptions.value = [];
    return null;
  }

  if (!masterAgent) {
    const fallback = { label: memberID, value: memberID, disabled: false };
    memberOptions.value = [fallback];
    return { value: memberID, label: memberID };
  }

  const queries = Array.from(
    new Set(
      [memberID.split('@')[0] || memberID, accountID, nickName]
        .map(i => (i || '').trim())
        .filter(Boolean),
    ),
  );

  memberLoading.value = true;
  let matched = false;
  let matchedLabel: string | undefined;
  for (const queryText of queries) {
    try {
      const res = await fuzzyQueryUser({
        masterAgent,
        queryText,
        limit: memberPageSize,
      });
      const list = Array.isArray(res) ? res : [];
      const match = list.find(item => `${item.account}@${item.agentID}` === memberID);
      if (match) {
        matchedLabel = `${match.accountID} - ${match.nickName}`;
        memberOptions.value = [
          {
            raw: match,
            value: memberID,
            label: matchedLabel,
            disabled: false,
          },
        ];
        matched = true;
        return { value: memberID, label: matchedLabel };
      }
    }
    catch (error) {
      console.warn('preloadMemberOptionLabel failed', error);
    }
  }
  memberLoading.value = false;

  // 若未命中搜尋結果，最後才回落顯示原值，避免先顯示錯誤值再跳轉
  if (!matched) {
    memberOptions.value = [{ label: memberID, value: memberID, disabled: false }];
    return { value: memberID, label: memberID };
  }

  return matchedLabel ? { value: memberID, label: matchedLabel } : null;
};

// =========================
// Modal
// =========================

const modalTitle = computed(() => (modalMode.value === 'edit' ? t('titleEdit') : t('titleAdd')));

const openModal = async (mode: ModalMode, record?: TransactionMemberSettingItem) => {
  modalMode.value = mode;
  modalSubmitting.value = false;
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  if (mode === 'edit' && record) {
    isEditReady.value = false;
    form.value = { member: undefined, serviceTariff: undefined };
    const memberID = String(record.memberID ?? '');
    const serviceTariff = Math.round(Number(record.serviceTariff || 0) * 100);

    // =========================
    // STEP 1: Context 可用性判斷
    // =========================
    const recordWithContext = record as TransactionMemberSettingItem & { accountID?: string; nickName?: string };
    // 1. 編輯入口來自資料表 row（非新建/非空白）✓ - mode === 'edit' && record 已滿足
    // 2. row/context 已包含可直接顯示的會員資訊（accountID + nickName 或等價欄位）
    const hasAccountID = Boolean(recordWithContext.accountID);
    const hasDisplayableContext = hasAccountID; // 必須有 accountID 才能使用 Context-first
    // 3. 編輯 Modal 中「會員」欄位為唯讀（不可切換）✓ - :disabled="modalMode === 'edit'" 已滿足
    const isMemberFieldReadonly = true;

    const canUseContextFirst = hasDisplayableContext && isMemberFieldReadonly;

    if (canUseContextFirst) {
      // =========================
      // CASE A: Context 可用 - Context-first 流程
      // =========================
      // 不呼叫任何會員查詢 API
      // 直接由 row/context 重組會員 Select option
      const accountID = recordWithContext.accountID || '';
      const nickName = recordWithContext.nickName || '';
      // 顯示文字規則：優先顯示「帳戶ID - 暱稱」，無暱稱時顯示「帳戶ID」
      const displayLabel = accountID && nickName
        ? `${accountID} - ${nickName}`
        : accountID;

      memberOptions.value = [
        {
          value: memberID,
          label: displayLabel,
          disabled: true, // option 僅一筆，且 disabled
        },
      ];
      form.value.member = { value: memberID, label: displayLabel };
      form.value.serviceTariff = serviceTariff;
      modalOpen.value = true;
      isEditReady.value = true;
      return;
    }

    // =========================
    // CASE B: Context 不可用 - 退回 ARCH-02（Base）流程
    // =========================
    // 完全退回 ARCH-02（Base）流程：preload queryAccountBaseInfo / fallback fuzzyQueryUser
    const preset = await preloadMemberOptionLabel(memberID, recordWithContext.nickName, recordWithContext.accountID);
    form.value.member = preset || { value: memberID, label: memberID };
    form.value.serviceTariff = serviceTariff;
    modalOpen.value = true;
    isEditReady.value = true;
    return;
  }

  // add 模式
  isEditReady.value = true;
  form.value = { member: undefined, serviceTariff: undefined };
  modalOpen.value = true;
};

const closeModal = () => {
  modalOpen.value = false;
};

const validateForm = () => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (!form.value.member?.value) {
    throw new Error(t('notify.required'));
  }
  const n = Number(form.value.serviceTariff);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new Error(t('notify.serviceTariff'));
  }
  return masterAgent;
};

const submitModal = async () => {
  try {
    const masterAgent = validateForm();
    modalSubmitting.value = true;

    const percent = Number(form.value.serviceTariff || 0);
    await setTransactionMemberSetting({
      masterAgent,
      memberID: form.value.member?.value ?? '',
      serviceTariff: percent > 0 ? percent / 100 : 0,
    });

    message.success(modalMode.value === 'edit' ? t('editSuccess') : t('addSuccess'));
    closeModal();
    tableInstance?.reload?.();
  }
  catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  }
  finally {
    modalSubmitting.value = false;
  }
};

const onDelete = async (record: TransactionMemberSettingItem & { accountID?: string; nickName?: string }) => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    return;
  }
  Modal.confirm({
    title: t('confirmDelete'),
    content: () => h('div', [
      h('div', t('confirmDeleteContent')),
      h('div', { style: 'margin-top: 8px; font-weight: 500;' }, `${record.accountID || ''} - ${record.nickName || ''}`),
    ]),
    okText: t('delete'),
    okType: 'danger',
    cancelText: t('cancel'),
    async onOk() {
      await removeTransactionMemberSetting({
        masterAgent,
        memberID: record.memberID,
      });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
};

// =========================
// Table + CRUD
// =========================

const loadTableData = async (_params: LoadDataParams) => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await queryTransactionMemberSettings({ masterAgent });
    const items = Array.isArray(list) ? list : [];

    // 依 memberID 批次取得帳戶ID與暱稱
    const accounts = Array.from(
      new Set(
        items
          .map(i => String(i.memberID || '').split('@')[0])
          .filter(Boolean),
      ),
    );

    let accountInfoMap: Record<string, { id?: string; nickName?: string }> = {};
    let accountOnlyMap: Record<string, { id?: string; nickName?: string }> = {};
    if (accounts.length) {
      const baseRes = await queryAccountBaseInfo({ masterAgent, accounts });
      const baseListRaw = baseRes as { data?: AccountBaseInfoItem[] } | AccountBaseInfoItem[] | undefined;
      const baseList = Array.isArray(baseListRaw) ? baseListRaw : baseListRaw?.data ?? [];
      accountInfoMap = baseList.reduce((acc, cur) => {
        const key = `${cur.account}@${cur.agentID}`;
        acc[key] = { id: cur.id, nickName: cur.nickName };
        return acc;
      }, {} as Record<string, { id?: string; nickName?: string }>);
      accountOnlyMap = baseList.reduce((acc, cur) => {
        acc[cur.account] = { id: cur.id, nickName: cur.nickName };
        return acc;
      }, {} as Record<string, { id?: string; nickName?: string }>);
    }

    const merged = items.map((item) => {
      const info = accountInfoMap[item.memberID] || accountOnlyMap[String(item.memberID || '').split('@')[0]] || {};
      return {
        ...item,
        accountID: info.id || '',
        nickName: info.nickName || '',
      };
    });

    currentList.value = merged;
    return { items: merged, meta: { totalItems: merged.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

const formatPercent = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return '';
  }
  return `${Math.round(n * 10000) / 100}%`;
};

const columns = ref<TableColumn<TransactionMemberSettingItem & { accountID?: string; nickName?: string }>[]>([
  { title: 'ID', dataIndex: 'id', width: 120, hideInSearch: true },
  // { title: t('columns.memberID'), dataIndex: 'memberID', hideInSearch: true },
  { title: '帳戶ID', dataIndex: 'accountID', hideInSearch: true },
  { title: '暱稱', dataIndex: 'nickName', hideInSearch: true },
  {
    title: t('columns.serviceTariff'),
    dataIndex: 'serviceTariff',
    flexible: true,
    minWidth: 160,
    hideInSearch: true,
    customRender: ({ text }) => formatPercent(text),
  },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 180,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    actions: ({ record }) => [
      {
        label: t('edit'),
        type: 'link',
        onClick: () => openModal('edit', record),
      },
      {
        label: t('delete'),
        type: 'link',
        danger: true,
        onClick: () => onDelete(record as TransactionMemberSettingItem & { accountID?: string; nickName?: string }),
      },
    ],
  },
]);

// 表格配置（與 agent 頁一致的基礎設施）
const tableConfig = useTableConfig(columns as any);

// 控制外層容器的 overflow-x，與 agent 頁一致
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }
  return 'hidden';
});

/**
 * SearchMode 狀態顯示（僅標示，不影響任何行為）
 * 本頁資料直接從後端依站長查詢，不做前端過濾，因此為 BACKEND
 */
const searchMode = computed<SearchMode>(() => 'BACKEND');
const searchModeConfig = computed(() => {
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[searchMode.value];
});

watch(
  () => contextVersion.value,
  () => {
    // 站長變更時清理本地狀態並刷新表格
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    tableInstance?.reload?.();
  },
);
</script>

<template>
  <div class="transaction-member-setting-page">
    <div class="table-container" :style="{ overflowX: containerOverflowX }">
      <DynamicTable
        row-key="memberID"
        :data-request="loadTableData"
        :columns="columns"
        :pagination="false"
        :scroll="{ x: tableConfig.scrollX.value }"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('title') }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
            <!-- <Tag color="orange" style="margin: 0">
              API優化:會員帳號與暱稱取得方式
            </Tag> -->
          </div>
        </template>
        <template #toolbar>
          <a-button type="primary" :disabled="!selectedMasterAgent || tableLoading" @click="openModal('add')">
            {{ t('add') }}
          </a-button>
        </template>
      </DynamicTable>
    </div>

    <a-modal
      v-if="isEditReady"
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="modalSubmitting"
      :mask-closable="false"
      :destroy-on-close="true"
      width="680px"
      @ok="submitModal"
      @cancel="closeModal"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('form.member')" required>
          <a-select
            v-model:value="form.member"
            label-in-value
            show-search
            :filter-option="false"
            :options="memberOptions"
            :loading="memberLoading"
            :disabled="modalMode === 'edit'"
            :placeholder="t('form.memberPlaceholder')"
            style="width: 100%"
            allow-clear
            @search="onMemberSearch"
            @popup-scroll="onMemberPopupScroll"
          />
        </a-form-item>

        <a-form-item :label="t('form.serviceTariff')" required>
          <a-input-number v-model:value="form.serviceTariff" :min="0" :max="100" :step="1" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
