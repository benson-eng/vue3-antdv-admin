<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';

import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { getPlatformAccount } from '@/api/backend/cashierManager';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({ name: 'GetPlatformAccount' });

const { t } = useI18n('routes.member.getPlatformAccountPage');

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
const selectedMasterAgent = computed<string>(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion
const contextVersion = computed<number>(() => masterAgentCtx?.contextVersion.value ?? 0);

const memberID = ref<string>('');
const memberLabel = ref<string>('');

interface MemberOption {
  label: string;
  value: string;
  raw?: FuzzyQueryUserItem;
}

const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

interface Row {
  key: string;
  member: string;
  platform: string;
  account: string;
}

const pendingToast = ref(false);

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    return { raw: item, value, label: `${item.accountID} - ${item.nickName}` };
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

const baseColumns = ref<TableColumn<Row>[]>([
  { title: t('columns.member'), dataIndex: 'member', flexible: true, minWidth: 260, hideInSearch: true },
  { title: t('columns.platform'), dataIndex: 'platform', flexible: true, minWidth: 200, hideInSearch: true },
  { title: t('columns.account'), dataIndex: 'account', flexible: true, minWidth: 180, hideInSearch: true },
]);

// 配置 member 欄位為搜尋欄位
const memberSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'member');
if (memberSearchCol) {
  memberSearchCol.hideInSearch = false;
  memberSearchCol.formItemProps = {
    label: t('filters.member'),
    component: 'Select',
    componentProps: () => ({
      options: memberOptions.value,
      loading: memberLoading.value,
      placeholder: t('filters.memberPlaceholder'),
      allowClear: true,
      showSearch: true,
      filterOption: false,
      onSearch: onMemberSearch,
      onPopupScroll: onMemberPopupScroll,
      onChange: (val: string) => {
        const matched = memberOptions.value.find((o: MemberOption) => o.value === val);
        memberID.value = val || '';
        memberLabel.value = matched?.label || '';
      },
    }),
  };
}

// 使用表格配置 Hook
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

  return baseColumns.value.map((col: any) => {
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

    return processedCol;
  });
});

const [DynamicTable, tableInstance] = useTable({ search: true });

// 控制 vertical scroll（固定表頭）
// 類型 B（有搜尋區）：初始為 undefined，於 mounted + nextTick 後補上
const scrollY = ref<number | undefined>(undefined);

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
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料，不使用快取
 */
const handleFormSubmit = () => {
  tableInstance?.reload(true);
};

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

const loadTableData = async (params: LoadDataParams) => {
  const searchMemberID = String((params as any)?.member ?? memberID.value ?? '').trim();
  if (!searchMemberID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 同步搜尋表單的值到 memberID
  if ((params as any)?.member && (params as any).member !== memberID.value) {
    const matched = memberOptions.value.find((o: MemberOption) => o.value === (params as any).member);
    memberID.value = (params as any).member;
    memberLabel.value = matched?.label || '';
  }

  const list = await getPlatformAccount({ memberID: searchMemberID });
  const items = (Array.isArray(list) ? list : []).map((i: any) => {
    const platform = String(i?.platform ?? '');
    const account = String(i?.account ?? '');
    return {
      key: `${platform}:${account}`,
      member: memberLabel.value || searchMemberID,
      platform,
      account,
    } as Row;
  });

  if (pendingToast.value) {
    message.success(t('notify.searchFinish'));
    pendingToast.value = false;
  }

  return { items, meta: { totalItems: items.length } };
};

/**
 * 重置查詢條件狀態（不觸發 API 請求）
 */
const resetQueryState = () => {
  memberID.value = '';
  memberLabel.value = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
  // 清空搜尋表單（不會觸發 API 請求，因為 submitOnReset: false）
  const searchFormRef = tableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
  }
  // 注意：表格資料不會立即清空，但當使用者下次查詢時，
  // loadTableData 會因為 memberID 為空而返回空資料，從而清空表格顯示
};

/**
 * 監聽 contextVersion 變更，當站長切換時清空查詢條件和表格資料
 * 受控型 Consumer：不自動觸發資料查詢，等待使用者補齊必要條件並主動操作
 */
watch(
  () => contextVersion.value,
  () => {
    resetQueryState();
  },
);

/**
 * SearchMode 狀態顯示（僅標示，不影響任何行為）
 * 本頁必須輸入 memberID 才能查詢，所有資料皆從後端 API 取得，因此為 BACKEND
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

/**
 * 類型 B（有搜尋區頁面）：於 mounted + nextTick 後補上 scroll.y
 * 確保 DynamicTable 已 render，layout 穩定後再啟用 fixed header
 */
onMounted(() => {
  nextTick(() => {
    // 計算合理的 scroll.y 值（視窗高度減去其他元素高度，保留緩衝）
    // 使用常見的固定值，確保表頭固定行為穩定
    scrollY.value = window.innerHeight - 300; // 預留搜尋區、表頭、toolbar 等空間
  });
});
</script>

<template>
  <div class="agent-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        :data-request="loadTableData"
        :columns="columns"
        :pagination="false"
        row-key="key"
        :scroll="{
          x: tableConfig.scrollX.value,
          y: scrollY,
        }"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          showAdvancedButton: true,
          submitOnReset: false,
        }"
        @search="handleFormSubmit"
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
          <!-- 站長選擇已遷移至 Breadcrumb，此處不再需要顯示 -->
        </template>
      </DynamicTable>
    </div>
  </div>
</template>
