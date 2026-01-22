<script setup lang="ts">
import type { FixedMemberActivityItem } from '@/api/backend/activitySystem';
import type { AccountBaseInfoItem, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, h, inject, ref, watch } from 'vue';

import {
  cancelFixedMemberActivity,
  fixMemberActivity,
  getMemberActivity,
  queryFixedMemberActivities,
} from '@/api/backend/activitySystem';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'ActivityMemberSetting',
});

const i18n = useI18n('routes.member.activityMemberSettingPage');
const t = i18n.t;

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
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

const tableLoading = ref(false);
const currentList = ref<(FixedMemberActivityItem & { accountID?: string; nickName?: string })[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

const unselectableSet = computed(() => new Set(currentList.value.map(i => String(i.memberID ?? ''))));

// =========================
// Member remote options
// =========================

interface MemberOption { label: string; value: string; disabled?: boolean; raw?: FuzzyQueryUserItem }

const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

interface MemberSelectValue { value: string; label: string }

const form = ref<{ memberID?: MemberSelectValue; nowActivity: number | undefined; activity: number | undefined }>({
  memberID: undefined,
  nowActivity: undefined,
  activity: undefined,
});

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    const currentMemberID = form.value.memberID;
    const currentValue = typeof currentMemberID === 'string' ? currentMemberID : currentMemberID?.value || '';
    const disabled = unselectableSet.value.has(value) && currentValue !== value;
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
    const list = await queryFixedMemberActivities({ masterAgent });
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
      try {
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
      catch (error) {
        // 會員資料查詢失敗不影響表格顯示，但記錄錯誤以便調試
        console.warn('Failed to fetch member data', error);
      }
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

const baseColumns = ref<TableColumn<FixedMemberActivityItem & { accountID?: string; nickName?: string }>[]>([
  // { title: 'ID', dataIndex: 'id', width: 120, hideInSearch: true },
  // {
  //   title: t('columns.memberID'),
  //   dataIndex: 'memberID',
  //   flexible: true, // 彈性寬度欄位，對齊 agent 頁面行為
  //   minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  //   hideInSearch: true,
  // },
  {
    title: t('columns.accountID'),
    dataIndex: 'accountID',
    flexible: true,
    minWidth: 120,
    hideInSearch: true,
    customRender: ({ text }) => text || '-',
  },
  {
    title: t('columns.nickName'),
    dataIndex: 'nickName',
    flexible: true,
    minWidth: 120,
    hideInSearch: true,
    customRender: ({ text }) => text || '-',
  },
  { title: t('columns.activity'), dataIndex: 'activity', width: 160, hideInSearch: true },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 200,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    /**
     * 防止內容換行
     */
    customCell: () => {
      return {
        style: {
          whiteSpace: 'nowrap', // 禁止換行
        },
      };
    },
    actions: ({ record }: { record: FixedMemberActivityItem & { accountID?: string; nickName?: string } }) => [
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

// 使用表格配置 Hook
// 使用類型斷言，因為 useTableConfig 期望 TableColumnItem，但我們使用的是 TableColumn<FixedMemberActivityItem>
// 兩者在運行時結構相同，只是類型定義不同
const tableConfig = useTableConfig(baseColumns as any);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<FixedMemberActivityItem & { accountID?: string; nickName?: string }>[]>(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;
  // Guard: 如果 visibleColumnKeys 尚未初始化完成（為空或無效），不設置 hideInTable
  // 確保初始載入時所有欄位都顯示，符合 STEP 3 定型結果
  const isInitialized = visibleKeys.length > 0;

  return baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 如果 visibleColumnKeys 尚未初始化，保持所有欄位可見（不設置 hideInTable）
    if (!isInitialized) {
      return col;
    }

    const isVisible = visibleKeys.includes(key);

    // 確保 flexible 欄位有 minWidth
    const processedCol = {
      ...col,
      hideInTable: !isVisible,
    } as TableColumn<FixedMemberActivityItem & { accountID?: string; nickName?: string }>;

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

type ModalMode = 'add' | 'edit';

const modalOpen = ref(false);
const isEditReady = ref(true);
const modalSubmitting = ref(false);
const modalMode = ref<ModalMode>('add');

const modalTitle = computed(() => (modalMode.value === 'edit' ? t('titleEdit') : t('titleAdd')));

const fetchNowActivity = async (memberID: string) => {
  if (!memberID) {
    form.value.nowActivity = undefined;
    return;
  }
  // 確保 memberID 格式正確
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    form.value.nowActivity = undefined;
    return;
  }
  try {
    const res = await getMemberActivity({ memberID });
    form.value.nowActivity = res?.activity === undefined ? undefined : Number(res.activity);
  }
  catch {
    form.value.nowActivity = undefined;
  }
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

  // 優先使用 queryAccountBaseInfo 精準查詢
  const account = memberID.split('@')[0];
  if (account) {
    try {
      const baseRes = await queryAccountBaseInfo({ masterAgent, accounts: [account] });
      const baseListRaw = baseRes as { data?: AccountBaseInfoItem[] } | AccountBaseInfoItem[] | undefined;
      const baseList = Array.isArray(baseListRaw) ? baseListRaw : baseListRaw?.data ?? [];
      const match = baseList.find(item => `${item.account}@${item.agentID}` === memberID);
      if (match) {
        const matchedLabel = `${match.id} - ${match.nickName}`;
        memberOptions.value = [
          {
            raw: match as any,
            value: memberID,
            label: matchedLabel,
            disabled: false,
          },
        ];
        return { value: memberID, label: matchedLabel };
      }
    }
    catch (error) {
      console.warn('preloadMemberOptionLabel queryAccountBaseInfo failed', error);
    }
  }

  // 只有在 queryAccountBaseInfo 查不到時，才用 fuzzyQueryUser 做兜底查詢
  const queries = Array.from(
    new Set(
      [account || memberID, accountID, nickName]
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
        memberLoading.value = false;
        return { value: memberID, label: matchedLabel };
      }
    }
    catch (error) {
      console.warn('preloadMemberOptionLabel fuzzyQueryUser failed', error);
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

async function openModal(mode: ModalMode, record?: FixedMemberActivityItem & { accountID?: string; nickName?: string }) {
  // 檢查 masterAgent 是否存在
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }

  modalMode.value = mode;
  modalSubmitting.value = false;
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  if (mode === 'edit' && record) {
    isEditReady.value = false;
    form.value = { memberID: undefined, nowActivity: undefined, activity: undefined };
    const memberID = String(record.memberID ?? '');
    const preset = await preloadMemberOptionLabel(memberID, record.nickName, record.accountID);
    form.value.memberID = preset || { value: memberID, label: memberID };
    form.value.activity = record.activity === undefined ? undefined : Number(record.activity);
    await fetchNowActivity(memberID);
    modalOpen.value = true;
    isEditReady.value = true;
    return;
  }

  // add 模式
  isEditReady.value = true;
  form.value = { memberID: undefined, nowActivity: undefined, activity: undefined };
  modalOpen.value = true;
}

const closeModal = () => {
  modalOpen.value = false;
};

const validateForm = () => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (!form.value.memberID?.value) {
    throw new Error(t('notify.required'));
  }
  const n = Number(form.value.activity);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw new Error(t('notify.activity'));
  }
};

const submitModal = async () => {
  try {
    validateForm();
    modalSubmitting.value = true;

    const memberID = form.value.memberID?.value ?? '';
    const activity = Number(form.value.activity);

    // 對齊 Vue2：編輯時先取消舊固定，再設定新值
    if (modalMode.value === 'edit') {
      await cancelFixedMemberActivity({ memberID });
    }
    await fixMemberActivity({ memberID, activity });

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

async function onDelete(record: FixedMemberActivityItem & { accountID?: string; nickName?: string }) {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
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
      await cancelFixedMemberActivity({ memberID });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
}

// 監聽 contextVersion 變更，當站長切換時自動重置並刷新表格
watch(
  () => contextVersion.value,
  () => {
    // 站長切換時，清掉 modal 內會員選單（避免跨總代殘留）
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    // 如果 modal 打開，關閉它以避免顯示錯誤
    if (modalOpen.value) {
      closeModal();
    }
    // 清空表格資料並自動重新載入
    tableInstance?.reload(true);
  },
);

watch(
  () => form.value.memberID,
  (v) => {
    // member 變更時更新「目前活躍度」
    const memberID = typeof v === 'string' ? v : v?.value || '';
    if (!memberID) {
      form.value.nowActivity = undefined;
      return;
    }
    fetchNowActivity(memberID);
  },
);

// 計算 container 的 overflow-x 樣式
// container 預設 overflow-x 為 hidden，確保初始進入頁面時不會出現橫向 scrollbar
// 僅當 scroll.x !== '100%' 且為數字時，才允許 overflow-x: auto
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  // 原因：當 scroll.x 為數字時，表示表格內部有固定寬度欄位，且總和超過容器寬度
  // 此時表格內部會出現滾動條，外層 container 也需要允許滾動，以確保表格內容可以完整顯示
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  // 原因：
  // - '100%': 表示有 flexible 欄位，表格會自動適應容器寬度，不需要外層滾動
  //           這樣可以確保初始進入頁面時，不論資料量多少，都不會出現橫向 scrollbar
  // - undefined: 表示沒有固定寬度欄位或固定寬度總和為 0，表格會自適應容器，不需要滾動
  //              這樣可以確保關閉欄位到 1~2 欄時，table 寬度會自適應容器
  return 'hidden';
});

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent：後端 API 參數（Context Selector）
 * - 本頁面為 search: false，無搜尋表單
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 本頁面無搜尋表單，所有查詢都通過後端 API
  return 'BACKEND';
});

// SearchMode 顯示文字和顏色
const searchModeConfig = computed(() => {
  const mode = searchMode.value;
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[mode];
});
</script>

<template>
  <div class="activity-member-setting-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="memberID"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="{ x: tableConfig.scrollX.value }"
        :pagination="false"
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
      width="720px"
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

        <a-form-item :label="t('form.nowActivity')">
          <a-input :value="form.nowActivity" disabled />
        </a-form-item>

        <a-form-item :label="t('form.activity')" required>
          <a-input-number
            v-model:value="form.activity"
            :min="1"
            :max="99"
            :step="1"
            style="width: 100%"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
