<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
// 【暫時停用】nextTick 暫時未使用（代理欄位已備註），但程式碼保留
import { computed, inject, onMounted, ref, watch } from 'vue';
// import { nextTick } from 'vue'; // 備註：代理欄位恢復時需要取消備註
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { queryTokens } from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import { treasureItemList as fetchTreasureItemList } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { request } from '@/utils/request';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'MissionRecordTable',
});

// SearchMode 定義（僅用於狀態顯示）
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

/**
 * ARCH03-01：搜尋模型已升級（Vue2 → Vue3）
 *
 * 本頁已從 Vue2 page-owned search logic 升級為 Vue3 DynamicTable formSchemas 主控：
 * - 移除 query / appliedQuery 雙狀態模型，改用單一搜尋 state
 * - 搜尋主控權完全交由 DynamicTable formSchemas
 * - Context 切換時自動觸發 reload（不再保留「清空但不查」行為）
 * - 代理商選擇器保留在頁面層（依賴 Context 狀態）
 */

const { t } = useI18n('page.task.missionRecordTable');
const userStore = useUserStore();

// 從 Layout 根元件 provide 取得站長選單狀態（系統層 Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（從 Breadcrumb Context）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion（用於檢測站長切換）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

/**
 * ============ 工具函數 ============
 */
function getMasterAgentByAgentID(agentID: string): string {
  if (!agentID) {
    return '';
  }
  const parts = agentID.split('.');
  return parts.length > 1 ? parts[1] : agentID;
}

function pickByIdentity<T extends Record<string, any>>(
  obj: T,
  excludeValues: any[],
): Partial<T> {
  const result: Partial<T> = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (!excludeValues.includes(value)) {
      result[key as keyof T] = value;
    }
  });
  return result;
}

// ============ 查詢條件 ============
// ARCH03-01：移除 appliedQuery，改用單一搜尋 state（由 DynamicTable formSchemas 主控）
// 保留 agentID 在頁面層（依賴 Context 和代理商選擇器）
const agentID = ref<string>('');

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!agentID.value) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const masterAgent = getMasterAgentByAgentID(agentID.value);
    const res = await fuzzyQueryUser({
      masterAgent,
      agentID: agentID.value,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });

    const list = res || [];
    const mapped = list.map(item => ({
      raw: item,
      value: `${item.account}@${item.agentID}`,
      label: `${item.accountID} - ${item.nickName}`,
    }));

    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => {
  if (text && text.length >= 2) {
    fetchMemberOptions(text, false);
  }
  else {
    memberOptions.value = [];
  }
}, 250);

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom || !memberLastQueryText.value || !memberLastAccountID.value) {
    return;
  }

  await fetchMemberOptions(memberLastQueryText.value, true);
};

// ARCH03-01：當 agentID 改變時，清空會員選項（不再清空 memberID，由 DynamicTable formSchemas 管理）
watch(
  () => agentID.value,
  () => {
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
  },
);

// ============ 代理商選擇器 ============
const agentList = ref<Array<{ label: string; value: string }>>([]);
// 【暫時停用】代理欄位已備註，以下變數暫時未使用，程式碼保留
const _agentOptions = computed(() => agentList.value);
const _isAgentDisabled = computed(() => userStore.level >= 5 || !selectedMasterAgent.value);

// ============ 虛寶列表 ============
const treasureItemList = ref<TreasureItem[]>([]);

// ============ 幣別列表 ============
const currencyTypeList = ref<Array<{ name: string; value: string }>>([]);

// ============ 代幣列表 ============
const tokenList = ref<TokenItem[]>([]);

// ============ 任務記錄數據類型 ============
interface MissionRecordItem {
  id: number;
  settingID: number;
  memberID: string;
  /** 帳戶ID（由 queryAccountBaseInfo 批次補齊） */
  accountID?: string;
  /** 暱稱（由 queryAccountBaseInfo 批次補齊） */
  nickName?: string;
  taskId?: string;
  missionCreatedTime?: string;
  missionCompletedTime?: string;
  missionCompleted: boolean;
  missionVip?: number;
  missTypeStr?: string;
  missionName?: string;
  awardItemsArr?: string[];
  setting?: any;
  accumulatedValue?: any;
  Nickname?: string;
}

// ============ 表格 ============
// ARCH03-01：啟用 DynamicTable 內建搜尋表單（Submit 才觸發）
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true,
});

type ColumnsRowData = MissionRecordItem & {
  id: number;
};

const getAwardItemsStr = (awardItemsArr?: string[]): string => {
  if (!awardItemsArr || awardItemsArr.length === 0) {
    return '';
  }
  return awardItemsArr.join('、');
};

/**
 * ============ 工具函數（需要在 columns 定義前） ============
 */
const getCurrencyName = (currencyType?: string): string => {
  const found = currencyTypeList.value.find(c => c.value === currencyType);
  return found ? found.name : currencyType || 'unknown';
};

const getTreasureItemName = (itemID?: string): string => {
  const foundItem = treasureItemList.value.find(t => t.treasureItemID === itemID);
  return foundItem ? foundItem.itemName : 'unknown';
};

const getTokenName = (tokenID?: string | number): string => {
  const found = tokenList.value.find(t => t.id === tokenID || t.id?.toString() === tokenID?.toString());
  return found ? found.name : 'unknown';
};

const getLoyaltyPointName = (group?: string): string => {
  if (group === 'Daily' || group === 'ContinuousDaily') {
    return t('enum.LoyaltyPointDaily') || '每日活躍點';
  }
  if (group === 'Weekly' || group === 'ContinuousWeekly') {
    return t('enum.LoyaltyPointWeekly') || '每週活躍點';
  }
  return group || 'unknown';
};

// ============ 對話框 ============
const isDialogVisible = ref(false);
const dialogData = ref<any>(null);

const onView = (row: MissionRecordItem) => {
  dialogData.value = row;
  isDialogVisible.value = true;
};

const closeDialog = () => {
  isDialogVisible.value = false;
  dialogData.value = null;
};

// 定義所有欄位（包含操作欄）
// 欄位寬度策略對齊 agent 頁面：
// - 文字類、長度可變的欄位使用 flexible + minWidth（自動適應容器寬度）
// - 固定格式或短內容的欄位使用 fixed width
const baseColumns = computed<TableColumn<ColumnsRowData>[]>(() => [
  {
    title: t('tables.settingID') || 'ID',
    dataIndex: 'settingID',
    /** 固定寬度：ID 長度固定 */
    width: 80,
    /** 不在資料表中顯示 ID 欄位 */
    hideInTable: true,
  },
  {
    title: '帳戶ID',
    dataIndex: 'accountID',
    flexible: true,
    minWidth: 140,
    hideInSearch: true,
    customRender: ({ text }) => text || '-',
  },
  {
    title: '暱稱',
    dataIndex: 'nickName',
    flexible: true,
    minWidth: 140,
    hideInSearch: true,
    customRender: ({ text }) => text || '-',
  },
  {
    // 會員ID 欄位僅保留作為搜尋欄位使用，資料表中不再顯示（ARCH-02）
    title: t('tables.memberID') || '會員ID',
    dataIndex: 'memberID',
    /** 彈性寬度欄位：會員ID長度可能不同 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 200,
    /** 不在資料表中顯示，僅用於 DynamicTable 搜尋區 */
    hideInTable: true,
  },
  {
    title: t('tables.taskId') || '任務ID',
    dataIndex: 'taskId',
    /** 彈性寬度欄位：任務ID長度可能不同 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 150,
  },
  {
    title: t('tables.missionCreatedTime') || '任務建立時間',
    dataIndex: 'missionCreatedTime',
    /** 固定寬度：時間格式固定 */
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.missionCreatedTime ? dayjs(record.missionCreatedTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('tables.missionCompletedTime') || '任務完成時間',
    dataIndex: 'missionCompletedTime',
    /** 固定寬度：時間格式固定 */
    width: 180,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.missionCompletedTime ? dayjs(record.missionCompletedTime).format('YYYY-MM-DD HH:mm:ss') : '';
    },
  },
  {
    title: t('tables.missionCompleted') || '完成狀態',
    dataIndex: 'missionCompleted',
    /** 固定寬度：只有"完成"/"未完成" */
    width: 120,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return record.missionCompleted ? '完成' : '未完成';
    },
  },
  {
    title: t('tables.missionVip') || 'VIP',
    dataIndex: 'missionVip',
    /** 固定寬度：VIP 數字 */
    width: 100,
  },
  {
    title: t('tables.missTypeStr') || '任務類型',
    dataIndex: 'missTypeStr',
    /** 彈性寬度欄位：任務類型名稱長度可能不同 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 150,
  },
  {
    title: t('tables.missionName') || '任務名稱',
    dataIndex: 'missionName',
    /** 彈性寬度欄位：任務名稱長度可能不同 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 200,
  },
  {
    title: t('tables.awardItemsArr') || '獎勵項目',
    dataIndex: 'awardItemsArr',
    /** 彈性寬度欄位：獎勵項目內容長度可能不同 */
    flexible: true,
    /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
    minWidth: 300,
    customRender: ({ record }: { record: ColumnsRowData }) => {
      return getAwardItemsStr(record.awardItemsArr);
    },
  },
  {
    title: t('tables.control') || '操作',
    dataIndex: 'ACTION',
    /** 固定寬度：操作欄位 */
    width: 100,
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
    actions: ({ record }: { record: ColumnsRowData }) => {
      return [
        {
          label: t('view') || '查看',
          type: 'link',
          onClick: () => onView(record),
        },
      ];
    },
  },
]);

// 使用表格配置 Hook
// 注意：useTableConfig 期望 TableColumnItem 類型，但我們使用的是 TableColumn<ColumnsRowData>
// 由於兩者結構兼容（都基於 TableColumn），使用類型斷言來繞過類型檢查
const tableConfig = useTableConfig(baseColumns as any);

// STEP 3 定型的欄位 keys（按順序，僅用於文檔記錄）：
// settingID, memberID, taskId, missionCreatedTime, missionCompletedTime,
// missionCompleted, missionVip, missTypeStr, missionName, awardItemsArr, ACTION

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<ColumnsRowData>[]>(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;
  // Guard: 確保 visibleColumnKeys 已初始化且為有效集合
  // 如果 visibleKeys 為空或無效，則不套用 hideInTable（維持全部顯示）
  const isVisibleKeysValid = Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    // 僅在 visibleColumnKeys 有效時才檢查可見性，否則預設顯示
    const isVisible = isVisibleKeysValid ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<ColumnsRowData> = {
      ...col,
      // 僅在 visibleColumnKeys 有效時才套用 hideInTable
      hideInTable: isVisibleKeysValid ? !isVisible : false,
    };

    // 固定規則：ID 欄位（settingID）與原始會員ID（memberID）永遠不在資料表中顯示
    if (key === 'settingID' || key === 'memberID') {
      processedCol.hideInTable = true;
    }

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

// ARCH03-01：配置 DynamicTable formSchemas（搜尋欄位）
// 預設：所有欄位隱藏在搜尋表單中
baseColumns.value.forEach((col: any) => {
  if (col.hideInSearch === undefined) {
    col.hideInSearch = true;
  }
});

// 搜尋欄位 0：代理（放在搜尋區裡，參考 memberList 頁面）
// 使用 settingID 欄位來配置代理搜尋欄位（該欄位在表格中仍正常顯示）
// 【暫時停用】代理欄位已備註，程式碼保留
// const agentSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'settingID');
// if (agentSearchCol) {
//   agentSearchCol.hideInSearch = false;
//   agentSearchCol.searchField = 'agent';
//   agentSearchCol.formItemProps = {
//     label: t('labels.agent') || '代理',
//     component: 'Select',
//     order: 0,
//     componentProps: () => ({
//       options: _agentOptions.value,
//       disabled: _isAgentDisabled.value,
//       placeholder: t('labels.agent') || '代理',
//       allowClear: true,
//       onChange: (val: string) => {
//         // 當代理改變時，更新 agentID 並清空會員選項
//         const masterAgent = selectedMasterAgent.value;
//         if (masterAgent && val) {
//           const agentAccount = val.includes('.') ? val.split('.')[0] : val;
//           agentID.value = `${agentAccount}.${masterAgent}`;
//         }
//         else if (masterAgent) {
//           agentID.value = masterAgent;
//         }
//         else {
//           agentID.value = '';
//         }
//         // 清空會員選項
//         memberOptions.value = [];
//         memberLastQueryText.value = '';
//         memberLastAccountID.value = '';
//       },
//     }),
//   };
// }

// 搜尋欄位 1：會員（remote search）
const memberSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'memberID');
if (memberSearchCol) {
  memberSearchCol.hideInSearch = false;
  memberSearchCol.searchField = 'memberID';
  memberSearchCol.formItemProps = {
    label: t('labels.member') || '會員',
    component: 'Select',
    order: 1,
    required: true,
    rules: [{ required: true, message: t('notify.needAccount') }],
    componentProps: () => ({
      options: memberOptions.value,
      loading: memberLoading.value,
      placeholder: '00001314 - 王小明',
      allowClear: true,
      showSearch: true,
      filterOption: false,
      disabled: !agentID.value,
      onSearch: onMemberSearch,
      onPopupScroll: onMemberPopupScroll,
    }),
  };
}

// 搜尋欄位 2：任務名稱
const missionNameSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'missionName');
if (missionNameSearchCol) {
  missionNameSearchCol.hideInSearch = false;
  missionNameSearchCol.searchField = 'missionName';
  missionNameSearchCol.formItemProps = {
    label: t('labels.missionName') || '任務名稱',
    component: 'Input',
    order: 2,
    componentProps: {
      allowClear: true,
      placeholder: '請輸入任務名稱',
    },
  };
}

// 搜尋欄位 3：任務建立時間
const missionCreatedTimeSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'missionCreatedTime');
if (missionCreatedTimeSearchCol) {
  missionCreatedTimeSearchCol.hideInSearch = false;
  missionCreatedTimeSearchCol.searchField = 'missionCreatedTime';
  missionCreatedTimeSearchCol.formItemProps = {
    label: t('labels.missionCreatedTime') || '任務建立時間',
    component: 'RangePicker',
    order: 3,
    componentProps: {
      /** 雙月顯示 + 日期與時間同時選擇 */
      showTime: { format: 'HH:mm:ss' },
      format: 'YYYY-MM-DD HH:mm:ss',
      placeholder: [t('datePicker.startDate') || '開始時間', t('datePicker.dueDate') || '結束時間'],
      allowClear: true,
    },
  };
}

// 搜尋欄位 4：任務完成時間
const missionCompletedTimeSearchCol = baseColumns.value.find((c: any) => c?.dataIndex === 'missionCompletedTime');
if (missionCompletedTimeSearchCol) {
  missionCompletedTimeSearchCol.hideInSearch = false;
  missionCompletedTimeSearchCol.searchField = 'missionCompletedTime';
  missionCompletedTimeSearchCol.formItemProps = {
    label: t('labels.missionCompletedTime') || '任務完成時間',
    component: 'RangePicker',
    order: 4,
    componentProps: {
      /** 雙月顯示 + 日期與時間同時選擇 */
      showTime: { format: 'HH:mm:ss' },
      format: 'YYYY-MM-DD HH:mm:ss',
      placeholder: [t('datePicker.startDate') || '開始時間', t('datePicker.dueDate') || '結束時間'],
      allowClear: true,
    },
  };
}

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
// 此 watch 僅反映「使用者在 column setting 中的操作」，不會改變預設欄位集合與順序
watch(
  () => {
    // 嘗試從 dynamicTableInstance 獲取實際的 columns 狀態
    const innerProps = (dynamicTableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumn<ColumnsRowData>) => {
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
 * ============ API 調用 ============
 */
const queryMissionRecords = async (params: {
  masterAgent: string;
  memberID: string;
  missionName?: string;
  missionCreatedTime?: { startTime: Date; endTime: Date };
  missionCompletedTime?: { startTime: Date; endTime: Date };
}) => {
  return request({
    url: '/AdminSystem/api/action/queryMissionRecords',
    method: 'post',
    data: {
      server: 'gameMissionSystem',
      actionName: 'queryMissionRecords',
      query: JSON.stringify(params),
    },
  });
};

/**
 * ARCH03-01：loadTableData 使用 DynamicTable formSchemas 的值
 */
const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();

  /** 從 formSchemas 獲取搜尋條件 */
  const agent = String((params as any)?.agent ?? '').trim();
  const memberID = String((params as any)?.memberID ?? '').trim();
  const missionName = String((params as any)?.missionName ?? '').trim();
  const missionCreatedTime = (params as any)?.missionCreatedTime as [Dayjs, Dayjs] | undefined;
  const missionCompletedTime = (params as any)?.missionCompletedTime as [Dayjs, Dayjs] | undefined;

  // 構建 agentID（根據代理和站長）
  let currentAgentID = '';
  if (agent && masterAgent) {
    const agentAccount = agent.includes('.') ? agent.split('.')[0] : agent;
    currentAgentID = `${agentAccount}.${masterAgent}`;
  }
  else if (masterAgent) {
    currentAgentID = masterAgent;
  }

  // 更新 agentID ref（用於會員選擇器的依賴判斷）
  agentID.value = currentAgentID;

  // 檢查必要的查詢條件（masterAgent 和 currentAgentID 是系統狀態，非搜尋表單欄位）
  // ARCH04：memberID 的必填驗證已移至 DynamicTable formSchemas，此處不再檢查
  if (!masterAgent || !currentAgentID) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 驗證 memberID 格式：應該是 account@agentID 格式
  const memberIDParts = memberID.split('@');
  if (memberIDParts.length !== 2 || !memberIDParts[0] || !memberIDParts[1]) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const postData: any = {
    masterAgent,
    memberID,
  };

  if (missionName) {
    postData.missionName = missionName;
  }

  if (missionCreatedTime && missionCreatedTime[0] && missionCreatedTime[1]) {
    postData.missionCreatedTime = {
      startTime: missionCreatedTime[0].toDate(),
      endTime: missionCreatedTime[1].toDate(),
    };
  }

  if (missionCompletedTime && missionCompletedTime[0] && missionCompletedTime[1]) {
    postData.missionCompletedTime = {
      startTime: missionCompletedTime[0].toDate(),
      endTime: missionCompletedTime[1].toDate(),
    };
  }

  const actualConditions = pickByIdentity(postData, [undefined, '']) as any;

  try {
    const res = await queryMissionRecords(actualConditions);
    // 處理多種可能的 API 響應結構
    const resData = res as any;

    let rawItems: any[] = [];
    let total = 0;

    // 路徑 1: res.data (API 定義的結構)
    if (resData?.data && Array.isArray(resData.data)) {
      rawItems = resData.data;
      total = resData.data.length;
    }
    // 路徑 2: res 本身就是陣列
    else if (Array.isArray(resData)) {
      rawItems = resData;
      total = resData.length;
    }
    // 確保 items 是數組
    else {
      rawItems = [];
      total = 0;
    }

    /**
     * ARCH-02：批次補齊會員基本資料（accountID / nickName）
     */
    const accounts = Array.from(
      new Set(
        rawItems
          .map((i: any) => String(i.memberID || '').split('@')[0])
          .filter(Boolean),
      ),
    );

    let accountInfoMap: Record<string, { id?: string; nickName?: string }> = {};
    let accountOnlyMap: Record<string, { id?: string; nickName?: string }> = {};
    if (accounts.length && masterAgent) {
      try {
        const baseRes = await queryAccountBaseInfo({ masterAgent, accounts });
        const baseListRaw = baseRes as { data?: any[] } | any[] | undefined;
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
        // 會員基本資料查詢失敗不影響主列表，只記錄警告
        console.warn('[MissionRecordTable] Failed to fetch member base info', error);
      }
    }

    // 處理數據格式並合併會員基本資料
    const processedItems = rawItems.map((item: any) => {
      let missionCompleted = false;
      if (item.missionCompletedTime !== null && item.missionCompletedTime !== undefined) {
        missionCompleted = true;
      }

      let settingName = item.setting?.name || '';
      if (item.setting?.group !== 'FreeCoin' && settingName) {
        try {
          const parsed = JSON.parse(settingName);
          settingName = parsed.default || settingName;
        }
        catch {
          // 如果解析失敗，使用原始值
        }
      }

      const memberIDKey = String(item.memberID || '');
      const accountKey = memberIDKey.split('@')[0];
      const baseInfo = accountInfoMap[memberIDKey] || accountOnlyMap[accountKey] || {};

      const processedItem: MissionRecordItem = {
        id: item.id || item.settingID || 0,
        settingID: item.settingID || item.id || 0,
        memberID: item.memberID || '',
        accountID: baseInfo.id || '',
        nickName: baseInfo.nickName || '',
        taskId: item.setting?.extraInfo?.taskId || '',
        missionCreatedTime: item.missionCreatedTime || item.createdTime,
        missionCompletedTime: item.missionCompletedTime,
        missionCompleted,
        missionVip: item.setting?.vip || item.missionVip,
        missTypeStr: item.missTypeStr || '',
        missionName: settingName,
        awardItemsArr: [],
        setting: item.setting,
        accumulatedValue: item.accumulatedValue,
        Nickname: item.Nickname || '',
      };

      // 處理獎勵項目
      if (item.accumulatedValue?.targets && Array.isArray(item.accumulatedValue.targets)) {
        const awardItemsArr: string[] = [];
        const isLoyalty = item.accumulatedValue.targets.length > 1;
        const currentValue = item.accumulatedValue.currentValue || 0;

        item.accumulatedValue.targets.forEach((target: any, targetIdx: number) => {
          if (target.isReceived === true) {
            if (isLoyalty === true) {
              awardItemsArr.push(`${t('labels.loyaltyBox') || '活躍寶箱'}${targetIdx + 1} => `);
            }
            target.rewards?.forEach((reward: any) => {
              if ((currentValue >= target.targetValue && missionCompleted === false && isLoyalty === true)
                || (currentValue >= target.targetValue && missionCompleted === true && isLoyalty === false)) {
                let rewardStr = '';
                switch (reward.type) {
                  case 1: // BALANCE
                    rewardStr = `${getCurrencyName(reward.currencyType)} : ${reward.balance}`;
                    break;
                  case 2: // TREASURE_ITEM
                    rewardStr = `${getTreasureItemName(reward.treasureItemID)} : ${reward.amount}`;
                    break;
                  case 3: // LOYALTY_POINT
                    rewardStr = `${getLoyaltyPointName(reward.group)} : ${reward.point}`;
                    break;
                  case 4: // TOKEN
                    rewardStr = `${getTokenName(reward.tokenID)} : ${reward.amount}`;
                    break;
                }
                if (rewardStr) {
                  awardItemsArr.push(rewardStr);
                }
              }
            });
          }
        });
        processedItem.awardItemsArr = awardItemsArr;
      }

      return processedItem;
    });

    const sortedItems = [...processedItems].sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

    return {
      items: sortedItems,
      meta: {
        totalItems: total,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error(t('notify.connectionError') || '連接錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * ============ API 調用 ============
 */
const setCurrencyTypeList = async (_masterAgent: string): Promise<void> => {
  currencyTypeList.value = [];
  if (userStore.level === 4) {
    const currencies = userStore.currencies || [];
    currencies.forEach((item: any) => {
      currencyTypeList.value.push({ name: item.currencyName, value: item.currencyCode });
    });
  }
  // 注意：level < 4 時，幣別列表需要從 API 獲取，但本頁面不再維護 masterAgentList
  // 如果需要，可以從 masterAgentCtx 獲取或調用 API
};

const setTreasureItemList = async (masterAgent: string): Promise<void> => {
  try {
    const res = await fetchTreasureItemList({ masterAgent });
    if (res?.rows) {
      treasureItemList.value = res.rows.reduce((acc: TreasureItem[], r) => {
        if (
          r.type === 'eventItem'
          || r.type === 'gachapon'
          || r.type === 'entityItem'
          || r.type === 'freeScratchCard'
        ) {
          const inItem: TreasureItem[] = [];
          r.items.forEach((item: any) => {
            if (item.enabled === 1 || item.enabled === true) {
              let itemName = item.itemName;
              if (typeof itemName === 'object') {
                itemName = itemName.tw || itemName.default || '';
              }
              else if (typeof itemName === 'string' && itemName.includes('{"default":')) {
                try {
                  const parsed = JSON.parse(itemName);
                  itemName = parsed.tw || parsed.default || itemName;
                }
                catch {
                  // 解析失敗，使用原始值
                }
              }
              inItem.push({ ...item, itemName });
            }
          });
          return [...acc, ...inItem];
        }
        return acc;
      }, []);
    }
  }
  catch (error) {
    console.error('Failed to fetch treasure items:', error);
  }
};

const getTokenList = async (masterAgent: string) => {
  tokenList.value = [];
  try {
    const res = await queryTokens({ masterAgent });
    if (res) {
      tokenList.value = res;
    }
  }
  catch (error) {
    console.error('Failed to fetch tokens:', error);
  }
};

const fetchAgentList = async (masterAgent: string) => {
  if (!masterAgent) {
    agentList.value = [];
    return;
  }
  try {
    const list = await getAgentListByMasterAgent({ masterAgent });
    agentList.value = (list || []).map(item => ({
      label: item.account.includes('.') ? item.account.split('.')[0] : item.account,
      value: item.account,
    }));
  }
  catch (error) {
    console.error('Failed to fetch agent list:', error);
    agentList.value = [];
  }
};

/**
 * ============ 事件處理 ============
 */
/**
 * ARCH03-01：處理站長切換（從 Breadcrumb Context）
 * 更新 agentID 並自動觸發 reload
 */
const handleMasterAgentChange = async (masterAgent: string) => {
  agentList.value = [];
  tokenList.value = [];

  if (!masterAgent) {
    agentID.value = '';
    // 重置搜尋表單並觸發 reload
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }
    dynamicTableInstance?.reload(true);
    return;
  }

  await setCurrencyTypeList(masterAgent);
  await setTreasureItemList(masterAgent);
  await getTokenList(masterAgent);

  // 如果有選擇總代理，獲取代理商列表
  await fetchAgentList(masterAgent);

  // ARCH03-01：重置搜尋表單（清空其他搜尋條件）
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
  }

  // 如果有代理商，自動選擇第一個並更新 agentID，然後設置到搜尋表單
  // 【暫時停用】代理欄位已備註，以下設置代理值的邏輯也暫時停用
  if (agentList.value.length > 0 && userStore.level <= 4) {
    const firstAgent = agentList.value[0].value;
    const agentAccount = firstAgent.includes('.') ? firstAgent.split('.')[0] : firstAgent;
    agentID.value = `${agentAccount}.${masterAgent}`;
    // 自動設置搜尋表單中的代理值（在 resetFields 之後設置，確保值不會被清空）
    // 使用 nextTick 確保 resetFields 完成後再設置值
    // await nextTick(); // 備註：需要 import { nextTick } from 'vue'
    // if (searchFormRef) {
    //   searchFormRef.setFieldsValue({ agent: firstAgent });
    // }
  }
  else {
    agentID.value = masterAgent;
  }

  // ARCH03-01：自動觸發 reload
  dynamicTableInstance?.reload(true);
};

/**
 * ARCH03-01：代理商選擇器已移至 DynamicTable formSchemas
 * 代理改變邏輯在 formSchemas 的 onChange 中處理
 */

/**
 * ARCH03-01：已移除頁面層搜尋表單相關函數
 * - onPlayDateTimeDatePickChanged
 * - onCompletedDateTimeDatePickChanged
 * - searchConditionValidator
 * - handleFilter
 * - handleReset
 * - resetQueryState
 *
 * 搜尋主控權已完全交由 DynamicTable formSchemas
 */

/**
 * ARCH03-01：監聽站長切換（從 Breadcrumb Context）
 * 當站長切換時，同步更新相關狀態、重置搜尋表單並自動觸發 reload
 */
watch(
  () => selectedMasterAgent.value,
  async (newMasterAgent) => {
    await handleMasterAgentChange(newMasterAgent);
  },
);

/**
 * ARCH03-01：監聽 contextVersion 變更，當站長切換時重置搜尋表單並自動觸發 reload
 */
watch(
  () => contextVersion.value,
  () => {
    // 重置搜尋表單並自動觸發 reload
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.resetFields();
    }
    dynamicTableInstance?.reload(true);
  },
);

// ============ 初始化 ============
onMounted(async () => {
  // 從 Breadcrumb Context 獲取站長值並初始化
  const masterAgent = selectedMasterAgent.value;
  if (masterAgent) {
    await handleMasterAgentChange(masterAgent);
  }
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

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  // 原因：
  // - '100%': 表示有 flexible 欄位，表格會自動適應容器寬度，不需要外層滾動
  //           這樣可以確保初始進入頁面時，不論資料量多少，都不會出現橫向 scrollbar
  // - undefined: 表示沒有固定寬度欄位或固定寬度總和為 0，表格會自適應容器，不需要滾動
  //              這樣可以確保關閉欄位到 1~2 欄時，table 寬度會自適應容器
  return 'hidden';
});

/**
 * SearchMode 狀態顯示（僅標示，不影響任何行為）
 *
 * 本頁查詢條件（masterAgent、agent、memberID、missionName、時間區間）皆直接傳給後端 API，
 * 不做前端過濾或混合模式，因此標示為 BACKEND。
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
</script>

<template>
  <div class="app-container mission-record-table">
    <div class="filter-container">
      <div class="wrap">
        <!-- ARCH03-01：代理商選擇器已移至 DynamicTable 搜尋區 -->
      </div>
    </div>

    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :columns="columns"
        :data-request="loadTableData"
        :scroll="{ x: tableConfig.scrollX.value }"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          showAdvancedButton: true,
          submitOnReset: false,
        }"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>任務紀錄</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>
    </div>

    <!-- 任務詳情對話框 -->
    <a-modal
      v-model:open="isDialogVisible"
      :title="t('dialog.title') || '任務詳情'"
      width="800px"
      :footer="null"
      @cancel="closeDialog"
    >
      <div v-if="dialogData" class="dialog-content">
        <a-descriptions :column="2" bordered>
          <a-descriptions-item :label="t('tables.settingID') || 'ID'">
            {{ dialogData.settingID }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.memberID') || '會員ID'">
            {{ dialogData.memberID }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.taskId') || '任務ID'">
            {{ dialogData.taskId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionVip') || 'VIP'">
            {{ dialogData.missionVip || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionName') || '任務名稱'">
            {{ dialogData.missionName || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missTypeStr') || '任務類型'">
            {{ dialogData.missTypeStr || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionCreatedTime') || '任務建立時間'">
            {{ dialogData.missionCreatedTime ? dayjs(dialogData.missionCreatedTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionCompletedTime') || '任務完成時間'">
            {{ dialogData.missionCompletedTime ? dayjs(dialogData.missionCompletedTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.missionCompleted') || '完成狀態'">
            {{ dialogData.missionCompleted ? '完成' : '未完成' }}
          </a-descriptions-item>
          <a-descriptions-item :label="t('tables.awardItemsArr') || '獎勵項目'" :span="2">
            {{ getAwardItemsStr(dialogData.awardItemsArr) || '-' }}
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.mission-record-table {
  .filter-container {
    margin-bottom: 16px;
    background-color: #fff;
    padding: 24px 24px 0;
  }

  .wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 0;

    .item {
      margin-top: 10px;
    }

    .input_btn {
      margin: 0;
    }
  }

  .input_group {
    display: flex;
    padding: 0;
    align-items: center;
    gap: 8px;

    .txt {
      width: auto;
      min-width: 80px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      margin-right: 8px;

      label {
        margin: 0;
        white-space: nowrap;
      }
    }

    .my_input {
      width: 200px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .my_select {
      width: 200px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .my_jcCenter {
      display: flex;
      align-items: center;
    }

    .input_btn {
      margin: 0;

      & + .input_btn {
        margin-left: 8px;
      }
    }
  }

  .dialog-content {
    padding: 20px 0;
  }
}
</style>
