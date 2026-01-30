<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { SMQueryStatusParams, SMSRecordItem } from '@/api/backend/adminSystem/smsSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { SMProviderName, smQueryStatus } from '@/api/backend/adminSystem/smsSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'SmsRecordTable',
});

const { t } = useI18n('page.smsRecordTable');
const route = useRoute();
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

// 從 Layout 根元件 provide 取得站長選單狀態（Breadcrumb Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（來自 Breadcrumb）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion（用於監聽站長切換）
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

function transStatusCode(code: number, provider: string): number {
  let re = code;
  if (provider === SMProviderName.BO) {
    switch (code) {
      case 2:
        re = 9;
        break;
      case 3:
        re = 10;
        break;
      case 4:
        re = 11;
        break;
      case 5:
        re = 12;
        break;
    }
  }
  return re;
}

// 用於儲存當前查詢時的會員暱稱（僅用於顯示）
const currentNickname = ref('');

// ============ 總代理和代理商 ============
const agentList = ref<{ label: string; value: string }[]>([]);
const selectedAgent = ref<string>('');

const isAgentDisabled = computed(() => userStore.level >= 5);

/**
 * 當前 agentID（用於會員搜尋和 API payload）
 */
const getAgentID = (masterAgent: string, agent?: string) => {
  if (!masterAgent) {
    return '';
  }
  if (agent) {
    const agentAccount = agent.includes('.') ? agent.split('.')[0] : agent;
    return `${agentAccount}.${masterAgent}`;
  }
  return masterAgent;
};

// 定義 currentAgentID（需要在 fetchMemberOptions 之前定義）
const currentAgentID = computed(() => {
  return getAgentID(selectedMasterAgent.value, selectedAgent.value);
});

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!currentAgentID.value) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const masterAgent = getMasterAgentByAgentID(currentAgentID.value);
    const res = await fuzzyQueryUser({
      masterAgent,
      agentID: currentAgentID.value,
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
}, 300);

const onMemberSelectChanged = (value: string) => {
  if (!value) {
    currentNickname.value = '';
    return;
  }

  const selected = memberOptions.value.find(opt => opt.value === value);
  if (selected) {
    currentNickname.value = selected.raw.nickName;
  }
};

const onMemberPopupScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    if (memberLastQueryText.value && memberLastQueryText.value.length >= 2) {
      fetchMemberOptions(memberLastQueryText.value, true);
    }
  }
};

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: true,
});

type ColumnsRowData = SMSRecordItem & {
  id: string;
  nickName?: string;
};

const formatProvider = (provider: string): string => {
  return t(`Provider.${provider}`) || provider;
};

const formatStatusCode = (statusCode: number): string => {
  return t(`statusCode.${statusCode}`) || statusCode.toString();
};

// 基礎欄位定義（包含搜尋欄位和資料顯示欄位）
// 注意：masterAgent 已由 Breadcrumb Context 提供，不再作為搜尋欄位
const baseColumns = computed<TableColumn<ColumnsRowData>[]>(() => {
  return [
    // 搜尋欄位：代理商（僅在站長選擇後顯示）
    {
      title: t('labels.agent') || '代理商',
      dataIndex: '__agent_search__',
      hideInTable: true,
      // 確保 Context 就緒且有站長值時才顯示，避免首次 render 時狀態不穩定
      hideInSearch: !masterAgentCtx || !selectedMasterAgent.value,
      searchField: 'agent',
      formItemProps: {
        label: t('labels.agent') || '代理商',
        component: 'Slot',
        componentProps: {
          slotName: 'form-agent',
        },
      },
    },
    // 搜尋欄位：會員
    {
      title: t('labels.member') || '會員',
      dataIndex: '__memberID_search__',
      hideInTable: true,
      searchField: 'memberID',
      formItemProps: {
        label: t('labels.member') || '會員',
        component: 'Select',
        componentProps: () => ({
          options: memberOptions.value,
          loading: memberLoading.value,
          showSearch: true,
          filterOption: false,
          allowClear: true,
          disabled: !currentAgentID.value,
          placeholder: '00001314 - 王小明',
          onSearch: onMemberSearch,
          onPopupScroll: onMemberPopupScroll,
          onChange: (value: string) => {
            onMemberSelectChanged(value);
          },
        }),
      },
    },
    // 搜尋欄位：發送時間（必填）
    {
      title: t('labels.messageSendTime') || '發送時間',
      dataIndex: '__messageSendTime_search__',
      hideInTable: true,
      searchField: 'messageSendTime',
      formItemProps: {
        label: t('labels.messageSendTime') || '發送時間',
        component: 'RangePicker',
        required: true,
        rules: [{ required: true, message: t('notify.required') || '必填欄位未填' }],
        componentProps: {
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          placeholder: ['開始時間', '結束時間'],
          defaultTime: [dayjs('00:00:00', 'HH:mm:ss'), dayjs('23:59:59', 'HH:mm:ss')],
        },
        // 預設值：當週（週一 00:00:00 ~ 週日 23:59:59）
        initialValue: (() => {
          const today = dayjs();
          // 取得當週週一（day() 0=週日, 1=週一, ..., 6=週六）
          /**
           * 否則減去(day-1)天到週一
           */
          const startOfWeek = today.day() === 0
            ? today.subtract(6, 'day') // 如果是週日，往前推6天到週一
            : today.subtract(today.day() - 1, 'day');
          // 取得當週週日
          const endOfWeek = startOfWeek.add(6, 'day');
          // 返回 [週一 00:00:00, 週日 23:59:59]
          return [
            startOfWeek.startOf('day'),
            endOfWeek.endOf('day'),
          ];
        })(),
      },
    },
    // 資料顯示欄位
    {
      title: t('column.id') || 'ID',
      dataIndex: 'messageID',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('column.memberID') || '會員',
      dataIndex: 'memberID',
      width: 200,
      hideInSearch: true,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        if (record.nickName) {
          return `${record.memberID} - ${record.nickName}`;
        }
        return record.memberID;
      },
    },
    {
      title: t('column.provider') || '電訊商',
      dataIndex: 'provider',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return formatProvider(record.provider);
      },
    },
    {
      title: t('column.message') || '簡訊內容',
      dataIndex: 'message',
      flexible: true, // 彈性寬度欄位
      minWidth: 300, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('column.statusCode') || '狀態',
      dataIndex: 'statusCode',
      width: 200,
      hideInSearch: true,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return formatStatusCode(record.statusCode);
      },
    },
    {
      title: t('column.messageSendTime') || '發送時間',
      dataIndex: 'messageSendTime',
      width: 180,
      hideInSearch: true,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return record.messageSendTime ? dayjs(record.messageSendTime).format('YYYY-MM-DD HH:mm:ss') : '';
      },
    },
  ] as TableColumn<ColumnsRowData>[];
});

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumns as any);

// 初始化標記：用於防止初始化階段的錯誤同步
const isInitialized = ref(false);

/**
 * 提取所有應該顯示的欄位 keys（排除 hideInTable: true 的搜尋欄位）
 * 這些是 STEP 3 定型後應該預設顯示的欄位
 */
function getDefaultVisibleKeys(columns: TableColumn<ColumnsRowData>[]): string[] {
  const defaultVisibleKeys: string[] = [];
  columns.forEach((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    // 只包含不在表格中隱藏的欄位（hideInTable !== true）
    if (key && col.hideInTable !== true) {
      defaultVisibleKeys.push(key);
    }
  });
  return defaultVisibleKeys;
}

// 初始化 visibleColumnKeys：只包含應該顯示的欄位（排除 hideInTable: true 的欄位）
// 使用 watch 確保在 baseColumns 準備好後立即初始化
watch(
  () => baseColumns.value,
  (newColumns) => {
    if (!newColumns || newColumns.length === 0) {
      return;
    }

    // 僅在未初始化時執行初始化
    if (!isInitialized.value) {
      const defaultVisibleKeys = getDefaultVisibleKeys(newColumns);

      // 確保有有效的預設欄位才進行初始化
      if (defaultVisibleKeys.length > 0) {
        const currentKeys = tableConfig.visibleColumnKeys.value;
        // 如果當前 visibleColumnKeys 為空或包含搜尋欄位，進行初始化
        // 檢查是否包含搜尋欄位（以 __ 開頭且以 _search__ 結尾）
        const hasSearchFields = currentKeys.some(key => key.startsWith('__') && key.endsWith('_search__'));
        if (currentKeys.length === 0 || hasSearchFields || currentKeys.length !== defaultVisibleKeys.length) {
          tableConfig.updateVisibleColumns(defaultVisibleKeys);
        }
        isInitialized.value = true;
      }
    }
  },
  { immediate: true },
);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 參考 agent/index.vue 的實現，但保持搜尋欄位隱藏
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumn<ColumnsRowData>[]>(() => {
  const baseColumnsList = baseColumns.value;
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  return baseColumnsList.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 如果欄位原本就設定 hideInTable: true（如搜尋欄位），保持隱藏
    if (col.hideInTable === true) {
      return col;
    }

    // 根據 visibleColumnKeys 設置 hideInTable
    // Guard: 如果 visibleColumnKeys 尚未初始化完成，維持全部顯示
    const isVisible = isInitialized.value ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumn<ColumnsRowData> = {
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
// 但僅在初始化完成後才進行同步，避免初始化階段的反向覆寫
watch(
  () => {
    // 嘗試從 dynamicTableInstance 獲取實際的 columns 狀態
    const innerProps = (dynamicTableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    // Guard: 僅在初始化完成後才進行同步
    if (!isInitialized.value || !newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    // 只包含非搜尋欄位（排除 hideInTable: true 的欄位）
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumn<ColumnsRowData>) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      // 只包含未隱藏的欄位（hideInTable !== true）
      // 搜尋欄位在 baseColumns 中已設置 hideInTable: true，會被自動排除
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
const onAgentChanged = (val: string) => {
  selectedAgent.value = val;
  currentNickname.value = '';
  memberOptions.value = [];
};

const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
  // masterAgent 從 Breadcrumb Context 獲取，不再從 params 中讀取
  const masterAgent = selectedMasterAgent.value;
  const { agent, memberID, messageSendTime } = params;

  // Guard: 確保必填條件存在（重置後表單為空時，直接返回空結果，不發送 API 請求）
  if (!masterAgent || !messageSendTime) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // Guard: 確保 messageSendTime 陣列有兩個有效元素
  if (!Array.isArray(messageSendTime) || !messageSendTime[0] || !messageSendTime[1]) {
    return { items: [], meta: { totalItems: 0 } };
  }

  try {
    // 根據表單值更新 selectedAgent
    if (agent !== selectedAgent.value) {
      selectedAgent.value = agent || '';
    }

    // 如果代理商列表為空，獲取代理商列表
    if (agentList.value.length === 0) {
      await fetchAgentList(masterAgent);
    }

    const apiParams: SMQueryStatusParams = {
      masterAgent,
      memberID: memberID || undefined,
      date: [
        dayjs(messageSendTime[0]).toDate(),
        dayjs(messageSendTime[1]).toDate(),
      ],
      providers: [SMProviderName.Mitake],
    };

    const res = await smQueryStatus(apiParams);
    const records = (res?.data || []).map((item: SMSRecordItem) => ({
      ...item,
      id: item.messageID,
      memberID: item.memberID,
      nickName: currentNickname.value,
      statusCode: transStatusCode(item.statusCode, item.provider),
    }));

    return {
      items: records,
      meta: {
        totalItems: records.length,
      },
    };
  }
  catch (error) {
    console.error('Failed to load table data:', error);
    message.error('連接錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/**
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料，等同於 tableInstance.reload(true)
 */
const handleFormSubmit = () => {
  dynamicTableInstance?.reload?.(true);
};

/**
 * 重置本頁所有查詢條件狀態和表格資料（受控型 Consumer 行為）
 * 當站長切換時，清空狀態但不觸發 API 請求
 */
const resetPageState = () => {
  // 重置搜尋表單狀態
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.resetFields();
  }

  // 清空本地狀態
  selectedAgent.value = '';
  agentList.value = [];
  currentNickname.value = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  // 清空表格資料（通過設置空資料，不觸發 API）
  // 注意：不調用 reload，因為這是受控型 Consumer，不應自動觸發查詢
};

/**
 * 當站長變化時，獲取對應的代理商列表
 */
const updateAgentList = async () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    agentList.value = [];
    return;
  }

  await fetchAgentList(masterAgent);

  // 如果有代理商且用戶有權限，自動選擇第一個
  if (agentList.value.length > 0 && userStore.level <= 4) {
    selectedAgent.value = agentList.value[0].value;
    // 同步更新表單中的 agent 值
    const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
    if (searchFormRef) {
      searchFormRef.setFieldsValue({ agent: agentList.value[0].value });
    }
  }
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

/**
 * 初始化搜尋表單的預設值
 * 確保必填欄位「發送時間」在首次進入頁面時能正確套用預設值
 */
const initializeFormValues = () => {
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return;
  }

  try {
    const formValues = searchFormRef.getFieldsValue();

    // 如果發送時間欄位為空，設置預設值（當週）
    if (!formValues?.messageSendTime || !Array.isArray(formValues.messageSendTime) || formValues.messageSendTime.length !== 2) {
      const today = dayjs();
      // 取得當週週一（day() 0=週日, 1=週一, ..., 6=週六）
      const startOfWeek = today.day() === 0
        ? today.subtract(6, 'day') // 如果是週日，往前推6天到週一
        : today.subtract(today.day() - 1, 'day');
      // 取得當週週日
      const endOfWeek = startOfWeek.add(6, 'day');

      searchFormRef.setFieldsValue({
        messageSendTime: [
          startOfWeek.startOf('day'),
          endOfWeek.endOf('day'),
        ],
      });
    }
  }
  catch (error) {
    console.error('Failed to initialize form values:', error);
  }
};

/**
 * 監聽站長切換（受控型 Consumer 行為）
 * 當檢測到站長變化時（通過 contextVersion），重置頁面狀態但不觸發 API 請求
 */
watch(
  () => contextVersion.value,
  async () => {
    // 重置頁面狀態（清空查詢條件和表格資料，但不觸發 API）
    resetPageState();

    // 獲取新的代理商列表（但不觸發查詢）
    await updateAgentList();

    // 重置後重新初始化表單預設值
    await nextTick();
    initializeFormValues();
  },
);

/**
 * 監聽站長值變化，確保代理商欄位顯示狀態正確
 * 當站長值從空變為有值時，需要更新代理商列表
 */
watch(
  () => selectedMasterAgent.value,
  async (newVal, oldVal) => {
    // 僅在首次從空變為有值時觸發（避免重複觸發）
    if (newVal && !oldVal && masterAgentCtx) {
      await updateAgentList();
      // 確保表單預設值已設置
      await nextTick();
      initializeFormValues();
    }
  },
);

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent：後端 API 參數（Breadcrumb Context）
 * - agent、memberID、messageSendTime：搜尋表單欄位，全部在 loadTableData 中作為 API 參數使用
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 嘗試獲取搜尋表單的值
  const searchFormRef = dynamicTableInstance?.getSearchFormRef?.();
  if (!searchFormRef) {
    return 'BACKEND';
  }

  try {
    // 所有搜尋條件（agent、memberID、messageSendTime）都在 loadTableData 中作為 API 參數使用
    // 因此無論是否有搜尋條件，都顯示為 BACKEND
    return 'BACKEND';
  }
  catch {
    return 'BACKEND';
  }
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

// ============ 初始化 ============
onMounted(async () => {
  // 站長由 Breadcrumb Context 提供，無需初始化
  // 如果有站長值，獲取對應的代理商列表
  if (selectedMasterAgent.value) {
    await updateAgentList();
  }

  // 初始化搜尋表單的預設值（確保必填欄位有初始值）
  // 使用 nextTick 確保表單已完全初始化
  await nextTick();
  initializeFormValues();
});
</script>

<template>
  <div class="sms-record-table-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        :columns="columns"
        :data-request="loadTableData"
        :scroll="{ x: tableConfig.scrollX.value }"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          submitOnReset: false,
        }"
        @search="handleFormSubmit"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ '簡訊記錄查詢' }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
        <!-- 代理商選擇器 Slot -->
        <template #form-agent="{ formModel }">
          <a-select
            v-if="selectedMasterAgent"
            :model-value="formModel.agent"
            :options="agentList"
            :disabled="isAgentDisabled"
            placeholder="請選擇代理商"
            style="width: 100%"
            :allow-clear="!isAgentDisabled"
            @update:value="(val: string | undefined) => {
              formModel.agent = val;
              onAgentChanged(val || '');
            }"
          />
        </template>
      </DynamicTable>
    </div>
  </div>
</template>

<style lang="less" scoped>
.sms-record-table-page {
  width: 100%;
}

.table-container {
  width: 100%;
}
</style>
