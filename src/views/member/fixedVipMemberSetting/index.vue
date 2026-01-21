<script setup lang="ts">
import type { AccountBaseInfoItem, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { FixedVipMemberInfo, VipSetting } from '@/api/backend/member/vipServer';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, h, inject, onMounted, ref, watch } from 'vue';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import VipApi from '@/api/backend/member/vipServer';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'FixedVipMemberSetting',
});

const i18n = useI18n('routes.member.fixedVipMemberSettingPage');
const t = i18n.t;
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

// 從 Layout 根元件 provide 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值
// 優先使用 Layout 提供的值，如果沒有則使用 userStore.masterAgent（Level 4 用戶）
const selectedMasterAgent = computed(() => {
  // 優先使用 Layout 提供的站長值
  if (masterAgentCtx?.selectedMasterAgent.value) {
    return String(masterAgentCtx.selectedMasterAgent.value || '').trim();
  }
  // Level 4 用戶：如果 Layout 沒有值，使用 userStore.masterAgent
  if (userStore.level === 4) {
    return String(userStore.masterAgent || '').trim();
  }
  return '';
});

// 使用 computed 取得 contextVersion
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

const tableLoading = ref(false);
const currentList = ref<(FixedVipMemberInfo & { accountID?: string; nickName?: string })[]>([]);
const vipList = ref<VipSetting[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

const unselectableSet = computed(() => new Set(currentList.value.map(i => String(i.memberID ?? ''))));

const vipMap = computed(() => {
  const m = new Map<number, string>();
  (vipList.value || []).forEach(v => m.set(Number(v.vipLevel), v.name));
  return m;
});

const vipOptions = computed(() => (vipList.value || []).map(v => ({ label: v.name, value: Number(v.vipLevel) })));

const formatVipName = (vipLevel: unknown) => {
  const n = Number(vipLevel);
  if (!Number.isFinite(n)) {
    return '';
  }
  return vipMap.value.get(n) || String(vipLevel ?? '');
};

interface MemberSelectValue { value: string; label: string }

const form = ref<{ memberID?: MemberSelectValue; vip: number | undefined }>({
  memberID: undefined,
  vip: undefined,
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

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    const disabled = unselectableSet.value.has(value) && form.value.memberID?.value !== value;
    return {
      raw: item,
      value,
      label: `${item.accountID} - ${item.nickName}`,
      disabled,
    };
  });

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  const masterAgent = selectedMasterAgent.value;
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

// =========================
// Table + CRUD
// =========================

const fetchVipList = async () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    vipList.value = [];
    return;
  }
  const list = await VipApi.listByMasterAgent({ masterAgent });
  vipList.value = Array.isArray(list) ? list : [];
};

const loadTableData = async (_params: LoadDataParams) => {
  // 使用從 LayoutBreadcrumb provide 取得的站長值
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await VipApi.getFixedVipMemberList({ masterAgent });
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

// =========================
// Modal Functions (定義在前，供 columns 使用)
// =========================

type ModalMode = 'add' | 'edit';

const modalOpen = ref(false);
const isEditReady = ref(true);
const modalSubmitting = ref(false);
const modalMode = ref<ModalMode>('add');

const modalTitle = computed(() => (modalMode.value === 'edit' ? t('titleEdit') : t('titleAdd')));

const preloadMemberOptionLabel = async (memberID: string, nickName?: string, accountID?: string): Promise<MemberSelectValue | null> => {
  const masterAgent = selectedMasterAgent.value;
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

const openModal = async (mode: ModalMode, record?: FixedVipMemberInfo & { accountID?: string; nickName?: string }) => {
  modalMode.value = mode;
  modalSubmitting.value = false;
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  if (mode === 'edit' && record) {
    isEditReady.value = false;
    form.value = { memberID: undefined, vip: undefined };
    const memberID = String(record.memberID ?? '');
    const preset = await preloadMemberOptionLabel(memberID, record.nickName, record.accountID);
    form.value.memberID = preset || { value: memberID, label: memberID };
    form.value.vip = record.vip === undefined ? undefined : Number(record.vip);
    modalOpen.value = true;
    isEditReady.value = true;
    return;
  }

  // add 模式
  isEditReady.value = true;
  form.value = { memberID: undefined, vip: undefined };
  modalOpen.value = true;
};

const closeModal = () => {
  modalOpen.value = false;
};

const validateForm = () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (!form.value.memberID?.value) {
    throw new Error(t('notify.required'));
  }
  const vip = Number(form.value.vip);
  if (!Number.isFinite(vip)) {
    throw new TypeError(t('notify.required'));
  }
  return masterAgent;
};

const submitModal = async () => {
  try {
    const masterAgent = validateForm();
    modalSubmitting.value = true;

    await VipApi.setFixedVipMember({
      masterAgent,
      memberID: form.value.memberID?.value ?? '',
      vip: Number(form.value.vip),
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

async function onDelete(record: FixedVipMemberInfo & { accountID?: string; nickName?: string }) {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.warning(t('notify.masterAgentRequired'));
    return;
  }
  if (record.masterAgent && record.masterAgent !== masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  const memberID = String(record.memberID ?? '');
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
      await VipApi.removeFixedVipMember({ memberID });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
}

// 定義所有欄位（包含操作欄）- STEP 3 定型結構
const baseColumnsWithAction = computed<TableColumn<FixedVipMemberInfo & { accountID?: string; nickName?: string }>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 120, hideInSearch: true },
  {
    title: t('columns.memberID'),
    dataIndex: 'memberID',
    flexible: true, // 彈性寬度欄位，對齊 agent 頁面行為
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
  },
  { title: '帳戶ID', dataIndex: 'accountID', hideInSearch: true },
  { title: '暱稱', dataIndex: 'nickName', hideInSearch: true },
  {
    title: t('columns.vip'),
    dataIndex: 'vip',
    width: 200,
    hideInSearch: true,
    customRender: ({ text }) => formatVipName(text),
  },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 200,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    customCell: () => ({
      style: {
        whiteSpace: 'nowrap',
      },
    }),
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
        onClick: () => onDelete(record),
      },
    ],
  },
]);

// Table config 與 scroll 基礎設施（對齊 agent 完成態）
// @ts-expect-error - useTableConfig 接受 Ref/ComputedRef，但類型定義不匹配
const tableConfig = useTableConfig(baseColumnsWithAction);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<FixedVipMemberInfo & { accountID?: string; nickName?: string }>[]>(() => {
  return baseColumnsWithAction.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<FixedVipMemberInfo & { accountID?: string; nickName?: string }> = {
      ...col,
      hideInTable: !isVisible,
    };

    // 如果欄位是 flexible 但沒有設置 minWidth，設置預設值
    if (processedCol.flexible && !processedCol.minWidth) {
      processedCol.minWidth = 100; // 預設最小寬度 100px
    }

    // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
    // 這樣可以避免初始 render 時被壓縮為 0
    if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
      processedCol.width = processedCol.minWidth;
    }

    return processedCol;
  });
});

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
watch(
  () => {
    // 嘗試從 tableInstance 獲取實際的 columns 狀態
    const innerProps = (tableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumn<FixedVipMemberInfo & { accountID?: string; nickName?: string }>) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      if (key && !col.hideInTable) {
        newVisibleKeys.push(key);
      }
    });

    // 只更新有變化的部分，避免循環更新
    const currentKeys = tableConfig.visibleColumnKeys.value;
    const keysChanged = newVisibleKeys.length !== currentKeys.length
      || newVisibleKeys.some(key => !currentKeys.includes(key))
      || currentKeys.some(key => !newVisibleKeys.includes(key));

    if (keysChanged) {
      tableConfig.updateVisibleColumns(newVisibleKeys);
    }
  },
  { deep: true, flush: 'post' },
);

// 計算 container 的 overflow-x 樣式
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

// 監聽站長切換（透過 contextVersion 變更），清空相關狀態並重新載入資料
watch(
  contextVersion,
  async () => {
    // 站長切換時，清掉 modal 內會員選單（避免跨總代殘留）
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    await fetchVipList();
    // 使用 reload(true) 強制重新查詢，不使用快取（對齊 agent 頁面行為）
    tableInstance?.reload?.(true);
  },
);

onMounted(async () => {
  // 初始化時載入 VIP 清單
  if (selectedMasterAgent.value) {
    await fetchVipList();
  }
});
</script>

<template>
  <div class="agent-page">
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
            v-model:value="form.memberID"
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

        <a-form-item :label="t('form.vip')" required>
          <a-select
            v-model:value="form.vip"
            :options="vipOptions"
            :placeholder="t('form.vipPlaceholder')"
            style="width: 100%"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
