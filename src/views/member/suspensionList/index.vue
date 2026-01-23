<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { UserPunishDetailItem } from '@/api/backend/adminSystem/suspension';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';

import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { addPunish, deletePunish, EPunishStatus, getPunishDetail } from '@/api/backend/adminSystem/suspension';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'SuspensionList',
});

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const i18n = useI18n('routes.member.suspensionListPage');
const t = i18n.t;

const userStore = useUserStore();

// 從 Layout 根元件 provide 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值
const selectedMasterAgent = computed<string>(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion
const contextVersion = computed<number>(() => masterAgentCtx?.contextVersion.value ?? 0);

const tableLoading = ref(false);
const currentList = ref<UserPunishDetailItem[]>([]);

const canAdd = computed(() => userStore.level < 3);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

const unselectableSet = computed(() => new Set(currentList.value.map(i => String(i.memberID ?? ''))));

const punishTypeOptions = computed(() => [
  { label: t('punishTypes.platformSuspension'), value: EPunishStatus.SUSPEND },
  { label: t('punishTypes.chatRoomBan'), value: EPunishStatus.MUTE },
  { label: t('punishTypes.giftBan'), value: EPunishStatus.BAN_GIFT },
]);

const formatPunishStatus = (status: unknown) => {
  const s = String(status ?? '');
  if (s === EPunishStatus.SUSPEND) {
    return t('punishTypes.platformSuspension');
  }
  if (s === EPunishStatus.MUTE) {
    return t('punishTypes.chatRoomBan');
  }
  if (s === EPunishStatus.BAN_GIFT) {
    return t('punishTypes.giftBan');
  }
  return s;
};

const form = ref<{ memberID: string; punishStatus: EPunishStatus | undefined; punishReason: string; punishTime: string }>({
  memberID: '',
  punishStatus: EPunishStatus.SUSPEND,
  punishReason: '',
  punishTime: '',
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
    const disabled = unselectableSet.value.has(value) && form.value.memberID !== value;
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

const loadTableData = async (_params: LoadDataParams) => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await getPunishDetail({ masterAgent });
    const items = Array.isArray(list) ? list : [];
    currentList.value = items;
    return { items, meta: { totalItems: items.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

// 定義基礎欄位（STEP 3 定型後的欄位集合與順序）
const baseColumns = ref<TableColumn<UserPunishDetailItem>[]>([
  { title: t('columns.id'), dataIndex: 'id', width: 120, hideInSearch: true },
  {
    title: t('columns.accountID'),
    dataIndex: 'accountID',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
  },
  {
    title: t('columns.nickName'),
    dataIndex: 'nickName',
    flexible: true, // 彈性寬度欄位
    minWidth: 180, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
  },
  {
    title: t('columns.punishStatus'),
    dataIndex: 'punishStatus',
    width: 160,
    hideInSearch: true,
    customRender: ({ text }) => formatPunishStatus(text),
  },
  {
    title: t('columns.createdAt'),
    dataIndex: 'createdAt',
    flexible: true, // 彈性寬度欄位
    minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
    customRender: ({ text }) => {
      if (!text) {
        return '';
      }
      const d = dayjs(text as any);
      return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(text);
    },
  },
  {
    title: t('columns.punishReason'),
    dataIndex: 'punishReason',
    flexible: true, // 彈性寬度欄位
    minWidth: 260, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
  },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 140,
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
    actions: ({ record }) => [
      {
        label: t('delete'),
        type: 'link',
        danger: true,
        onClick: () => onLift(record),
      },
    ],
  },
]);

// 使用表格配置 Hook
// 注意：useTableConfig 的類型定義較嚴格，但實際實現是通用的，使用類型斷言繞過類型檢查
const tableConfig = useTableConfig(baseColumns as any);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  // Guard: 如果 visibleColumnKeys 尚未初始化完成（空或無效），維持全部顯示
  // 這確保初始載入時不會因為 visibleColumnKeys 未就緒而隱藏欄位
  if (!visibleKeys || visibleKeys.length === 0) {
    return baseColumns.value;
  }

  return baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = visibleKeys.includes(key);

    // 確保 flexible 欄位有 minWidth
    const processedCol: any = {
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

    return processedCol as TableColumn<UserPunishDetailItem>;
  });
});

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

  // 其他情況（scroll.x 為 '100%' 或 undefined），container 不允許橫向滾動
  // 原因：表格會自適應容器寬度，不會產生橫向 scrollbar
  return 'hidden';
});

// 計算表格的 scroll.y 值，用於啟用固定表頭
// 類型 A（無搜尋區頁面）：可以明確設定 scroll.y
// 使用視窗高度減去固定元素高度來計算可用高度
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 600);

// 計算可用高度：視窗高度 - 表頭高度 - toolbar 高度 - 其他固定元素高度
// 預留約 200px 給表頭、toolbar 和其他固定元素
const tableScrollY = computed(() => {
  const availableHeight = windowHeight.value - 270;
  // 確保最小高度為 400px
  return Math.max(availableHeight, 400);
});

/**
 * 監聽視窗大小變化，更新表格高度
 */
const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowHeight.value = window.innerHeight;
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
    // 初始化時計算一次
    windowHeight.value = window.innerHeight;
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
  }
});

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 本頁為 search: false（無搜尋區），所有查詢皆為後端 API
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
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

const modalOpen = ref(false);
const modalSubmitting = ref(false);

const modalTitle = computed(() => t('titleAdd'));

const openModal = () => {
  modalOpen.value = true;
  modalSubmitting.value = false;

  form.value = {
    memberID: '',
    punishStatus: EPunishStatus.SUSPEND,
    punishReason: '',
    punishTime: '',
  };

  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const closeModal = () => {
  modalOpen.value = false;
};

const validateForm = () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (!form.value.memberID) {
    throw new Error(t('notify.required'));
  }
  if (!form.value.punishStatus) {
    throw new Error(t('notify.required'));
  }
};

const submitModal = async () => {
  try {
    validateForm();
    modalSubmitting.value = true;

    const masterAgent = selectedMasterAgent.value;
    await addPunish({
      masterAgent,
      memberID: form.value.memberID,
      punishStatus: form.value.punishStatus!,
      punishReason: form.value.punishReason || undefined,
      punishTime: form.value.punishTime || undefined,
    });

    message.success(t('addSuccess'));
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

async function onLift(record: UserPunishDetailItem) {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  const id = record?.id;
  if (id === undefined || id === null) {
    return;
  }

  Modal.confirm({
    title: t('confirmDelete'),
    content: `${t('confirmDeleteContent')} ${String(record.accountID ?? record.memberID ?? id)}`,
    okText: t('delete'),
    okType: 'danger',
    cancelText: t('cancel'),
    async onOk() {
      await deletePunish({ masterAgent, id });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
}

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
// 但需要避免初始化階段的循環更新
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
    newColumns.forEach((col: any) => {
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

/**
 * 監聽 contextVersion 變更，當站長切換時自動重置並刷新表格
 */
watch(
  () => contextVersion.value,
  () => {
    // 清空成員選項相關狀態
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    // 清空表格資料並自動重新載入
    tableInstance?.reload?.(true);
  },
);
</script>

<template>
  <div class="agent-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="{ x: tableConfig.scrollX.value, y: tableScrollY }"
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
          <a-button
            v-if="canAdd"
            type="primary"
            :disabled="!selectedMasterAgent || tableLoading"
            @click="openModal"
          >
            {{ t('add') }}
          </a-button>
        </template>
      </DynamicTable>
    </div>

    <a-modal
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
            show-search
            :filter-option="false"
            :options="memberOptions"
            :loading="memberLoading"
            :placeholder="t('form.memberPlaceholder')"
            style="width: 100%"
            allow-clear
            @search="onMemberSearch"
            @popup-scroll="onMemberPopupScroll"
          />
        </a-form-item>

        <a-form-item :label="t('form.suspensionType')" required>
          <a-select
            v-model:value="form.punishStatus"
            :options="punishTypeOptions"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item :label="t('form.suspensionReason')">
          <a-input v-model:value="form.punishReason" style="width: 100%" />
        </a-form-item>

        <a-form-item :label="t('form.suspensionTime')">
          <a-input v-model:value="form.punishTime" placeholder="ex: 三日" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
