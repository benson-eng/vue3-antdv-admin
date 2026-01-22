<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { Dayjs } from 'dayjs';

import type { TableColumnItem } from './columns';
import type { AgentItem } from '@/api/backend/adminAccount/agent';
import type { DateType, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { PlayerPackItem } from '@/api/backend/treasureChestSystem';
import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { debounce } from 'lodash-es';
import { computed, h, inject, nextTick, onMounted, ref, watch } from 'vue';

import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';

import { fuzzyQueryUser, queryAccountPersonalInfo } from '@/api/backend/adminSystem/accountSystem';
import { memberWallets } from '@/api/backend/adminSystem/cashRecordServer';
import { getPlayerPackV2 } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';
import { getColumns } from './columns';

defineOptions({
  name: 'MemberPersonalInfo',
});

const { t } = useI18n('routes.member.memberPersonalInfoPage');
const userStore = useUserStore();

// CDN Base URL（對齊 memberList：從環境變數獲取）
const cdnBaseURL = import.meta.env.VITE_APP_CDN_BASE_URL || '';

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

// 使用 computed 取得當前選取的站長值
const selectedMasterAgent = computed(() => {
  const v = masterAgentCtx?.selectedMasterAgent.value;
  if (v) {
    return String(v).trim();
  }
  return '';
});
// 使用 computed 取得 contextVersion
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// ============ Phase 1：對齊 Vue2「查詢區」結構/行為 ============
// - 總代理（masterAgent）下拉
// - 代理（agent）依總代理變動
// - 會員（member）輸入即查詢 + 下拉選單（autocomplete）
// - 日期類別（createdAt / lastLoginTime）
// - 日期區間
// - 快捷時間（昨日/今日/本週/上週/本月/上月）

const buildTodayRange = (): [Dayjs, Dayjs] => [dayjs().startOf('day'), dayjs().endOf('day')];

interface QueryState {
  agent: string;
  /**
   * 會員選項的 value（純 account，對齊 memberList 頁面）
   */
  memberID: string;
  memberAccount: string; /**
                          * 實際送 API：account（從 memberOptions 的 raw.account 取得）
                          */
  dateType: DateType; /**
                       * createdAt | lastLoginTime（對齊 Vue2）
                       */
  dateRange: [Dayjs, Dayjs];
}

const query = ref<QueryState>({
  agent: '',
  memberID: '',
  memberAccount: '',
  dateType: 'createdAt',
  dateRange: buildTodayRange(),
});

// ARCH03：搜尋主控權已轉移至 DynamicTable formSchemas
// 不再需要 appliedQuery，搜尋條件由 DynamicTable 搜尋表單管理

/**
 * 保留與 Vue2 相容的 agentID 組字規則（避免重複拼接）
 */
const buildAgentID = (agent: string, masterAgent: string) => {
  if (!agent || !masterAgent) {
    return '';
  }
  if (agent.includes('.')) {
    return agent;
  }
  return `${agent}.${masterAgent}`;
};

// agent options（站長由 Breadcrumb 提供，不再需要頁面自管）
const agentOptions = ref<DefaultOptionType[]>([]);
const agentRawList = ref<AgentItem[]>([]);

const isAgentDisabled = computed(() => userStore.level >= 5 || !selectedMasterAgent.value);

const fetchAgents = async (masterAgent: string) => {
  if (!masterAgent) {
    agentRawList.value = [];
    agentOptions.value = [];
    return;
  }
  const list = await getAgentListByMasterAgent({ masterAgent });
  agentRawList.value = list || [];
  // 對齊需求：若後端回傳 `代理.總代`，下拉顯示只要 `代理`
  agentOptions.value = (list || []).map((i) => {
    const agentText = i.account.includes('.') ? i.account.split('.')[0] : i.account;
    return { label: agentText, value: i.account };
  });
};

// ============ 會員輸入即查詢（對齊 Vue2 SearchMemberID remoteMethod）===========

const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const resetMemberSelector = () => {
  query.value.memberID = '';
  query.value.memberAccount = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!selectedMasterAgent.value) {
    message.error(t('filters.masterAgentRequired'));
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
      masterAgent: selectedMasterAgent.value,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });

    const list = res || [];
    const mapped = list.map(item => ({
      raw: item,
      value: String(item.account ?? ''), // 對齊 memberList：使用純 account 作為 value
      label: `${item.accountID} - ${item.nickName}`,
    }));

    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => fetchMemberOptions(text, false), 250);

// ARCH03：member 選擇邏輯已整合至 formItemProps 的 onChange
// 不再需要獨立的 onMemberSelectChanged 函數

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }

  // 接近底部 -> load more（對齊 Vue2 v-loadmore）
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

// agent 變更時，清空 member（對齊 Vue2 Watch agent 行為）
watch(
  () => query.value.agent,
  () => resetMemberSelector(),
);

// ARCH03：agent 變更邏輯已整合至 formItemProps 的 onChange
// 不再需要獨立的 onAgentChanged 函數

// ARCH03：快捷時間功能已移除，未來可整合至 DatePicker presets

// ============ 表格（DynamicTable）===========

const [DynamicTable, dynamicTableInstance] = useTable({
  search: true, // 使用 DynamicTable 內建搜尋表單（Submit 才觸發）
});

// ============ 背包對話框 ============
const isDialogForm = ref(false);
const playerPack = ref<PlayerPackItem[]>([]);
const [PackDynamicTable] = useTable({
  search: false, // 背包視窗不需要搜尋功能
});

const packColumns: TableColumnItem[] = [
  { title: t('packColumns.treasureItemID'), dataIndex: 'treasureItemID', key: 'treasureItemID' },
  { title: t('packColumns.itemType'), dataIndex: 'itemType', key: 'itemType' },
  { title: t('packColumns.itemName'), dataIndex: 'itemNameStr', key: 'itemNameStr' },
  {
    title: t('packColumns.iconUrl'),
    dataIndex: 'iconUrl',
    key: 'iconUrl',
    customRender: ({ text }: any) => {
      if (!text) {
        return '-';
      }
      // 調整圖示資料的網址組成：如果 text 已經包含 http，直接使用；否則拼接 cdnBaseURL
      const iconUrl = text.startsWith('http') ? text : `${cdnBaseURL}${text}`;
      return h('img', {
        src: iconUrl,
        style: {
          height: '50px',
          width: '50px',
          objectFit: 'contain',
        },
        alt: 'icon',
      });
    },
  },
  { title: t('packColumns.isVipExclusive'), dataIndex: 'isVipExclusive', key: 'isVipExclusive' },
  { title: t('packColumns.sourceTypeStr'), dataIndex: 'sourceTypeStr', key: 'sourceTypeStr' },
  { title: t('packColumns.noteStr'), dataIndex: 'noteStr', key: 'noteStr' },
  {
    title: t('packColumns.sendedAt'),
    dataIndex: 'sendedAt',
    key: 'sendedAt',
    customRender: ({ text }: any) => {
      if (!text) {
        return '-';
      }
      try {
        return dayjs(text).format('YYYY-MM-DD HH:mm:ss');
      }
      catch (error) {
        return text;
      }
    },
  },
  {
    title: t('packColumns.firstUseTime'),
    dataIndex: 'firstUseTime',
    key: 'firstUseTime',
    customRender: ({ text }: any) => {
      if (!text) {
        return '-';
      }
      try {
        return dayjs(text).format('YYYY-MM-DD HH:mm:ss');
      }
      catch (error) {
        return text;
      }
    },
  },
  {
    title: t('packColumns.validFrom'),
    dataIndex: 'validFrom',
    key: 'validFrom',
    customRender: ({ text }: any) => {
      if (!text) {
        return '-';
      }
      try {
        return dayjs(text).format('YYYY-MM-DD HH:mm:ss');
      }
      catch (error) {
        return text;
      }
    },
  },
  {
    title: t('packColumns.validUntil'),
    dataIndex: 'validUntil',
    key: 'validUntil',
    customRender: ({ text }: any) => {
      if (!text) {
        return '-';
      }
      try {
        return dayjs(text).format('YYYY-MM-DD HH:mm:ss');
      }
      catch (error) {
        return text;
      }
    },
  },
];

const getPlayerPack = async (memberID: string) => {
  try {
    const res = await getPlayerPackV2({ memberID });
    if (res && Array.isArray(res)) {
      playerPack.value = res.reduce((pack: PlayerPackItem[], d: any) => {
        return [...pack, ...(d.items || [])];
      }, []);

      // 過濾狀態
      playerPack.value = playerPack.value.filter((p) => {
        const state = itemState(p);
        return ['unused', 'using', 'active', 'Equip', 'notEquip'].includes(state);
      });

      // 處理顯示欄位
      playerPack.value.forEach((item: any) => {
        item.itemNameStr = item.itemName;
        item.state = itemState(item);
        item.sourceTypeStr = playerSourceType(item);
        item.noteStr = playerPackNote(item);
      });
    }
  }
  catch (error) {
    console.error('Failed to get player pack:', error);
    message.error(t('error') || '獲取背包資料失敗');
  }
};

function itemState(item: PlayerPackItem): string {
  const now = new Date();
  if (!item.enabled || (item.validUntil && new Date(item.validUntil) < now)) {
    return 'invalid';
  }
  if (item.validFrom && new Date(item.validFrom) > now) {
    return 'unused';
  }
  switch (item.useState) {
    case 0:
      return 'unused';
    case 1:
      return 'invalid';
    case 2:
      if (item.itemType === 'badge' || item.itemType === 'personalFrame') {
        return 'Equip';
      }
      return 'using';
    case 3:
    case 4:
      if (item.itemType === 'badge' || item.itemType === 'personalFrame') {
        return 'notEquip';
      }
      return 'active';
    default:
      return 'unknown';
  }
}

function playerSourceType(item: PlayerPackItem) {
  const sourceTypeMap: Record<string, string> = {
    forceBingo: t('packSourceType.forceBingo'),
    Mission: t('packSourceType.Mission'),
    userBought: t('packSourceType.userBought'),
    Event: t('packSourceType.Event'),
    LobbyGame: t('packSourceType.LobbyGame'),
    OpenMail: t('packSourceType.OpenMail'),
    Redeem: t('packSourceType.Redeem'),
    badge: t('packSourceType.badge'),
    purchase: t('packSourceType.purchase'),
    levelUp: t('packSourceType.levelUp'),
  };
  return sourceTypeMap[item.sourceType || ''] || item.sourceType || '';
}

function playerPackNote(item: PlayerPackItem) {
  if (item.sourceType === 'levelUp' && item.note) {
    try {
      const note = JSON.parse(item.note);
      return `level: ${note.level}`;
    }
    catch {
      return '';
    }
  }
  return '';
}

/**
 * 隱藏背包視窗中的全屏按鈕
 */
const hideFullscreenButton = () => {
  const modal = document.querySelector('.pack-dialog-modal');
  if (!modal) {
    return;
  }

  // 查找所有全屏相關的圖標
  const fullscreenIcons = modal.querySelectorAll('.anticon-fullscreen, .anticon-fullscreen-exit');
  fullscreenIcons.forEach((icon) => {
    const element = icon as HTMLElement;
    element.style.display = 'none';
    element.style.visibility = 'hidden';
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';

    // 隱藏父元素
    let parent = element.parentElement;
    while (parent && parent !== modal) {
      if (parent.classList.contains('ant-tooltip') || parent.classList.contains('ant-space-item')) {
        parent.style.display = 'none';
        parent.style.visibility = 'hidden';
      }
      parent = parent.parentElement;
    }
  });
};

const clickPackBtn = async (record: any) => {
  const memberID = `${record.account}@${record.agentID}`;
  await getPlayerPack(memberID);
  isDialogForm.value = true;

  // 等待 Modal 和表格渲染完成後，隱藏全屏按鈕
  await nextTick();
  setTimeout(() => {
    hideFullscreenButton();
  }, 100);
};

// 監聽 Modal 打開狀態，確保全屏按鈕被隱藏
watch(isDialogForm, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    setTimeout(() => {
      hideFullscreenButton();
    }, 100);
  }
});

// ============ 錢包對話框 ============
const isDialogForm2 = ref(false);
const playerWallets = ref<any[]>([]);
const walletColumns: any[] = [
  { title: t('walletColumns.currencyType'), dataIndex: 'currencyType', key: 'currencyType' },
  {
    title: t('walletColumns.balance'),
    dataIndex: 'balance',
    key: 'balance',
    customRender: ({ text }: any) => {
      if (!text && text !== '0') {
        return '-';
      }
      try {
        // balance 是字串格式，需要轉換為數字後格式化
        const num = Number.parseFloat(String(text));
        return Number.isNaN(num) ? text : num.toLocaleString();
      }
      catch (error) {
        return text;
      }
    },
  },
];

const getPlayeWallets = async (memberID: string) => {
  try {
    const res = await memberWallets({ memberID });
    console.log('[MemberPersonalInfo][getPlayeWallets] response:', res);

    // 處理回傳格式：根據實際 API 回傳結構提取資料
    // API 回傳格式：{ data: [{ balance: string, currencyType: string }] }
    // request 函數對於 AdminSystem API 可能會返回不同的結構
    let walletsData: any[] = [];
    if (res && typeof res === 'object') {
      if ('data' in res && Array.isArray(res.data)) {
        // 如果格式是 { data: [...] }
        walletsData = res.data;
      }
      else if (Array.isArray(res)) {
        // 如果格式直接是 [...]
        walletsData = res;
      }
    }

    console.log('[MemberPersonalInfo][getPlayeWallets] extracted walletsData:', walletsData);
    playerWallets.value = walletsData;
    console.log('[MemberPersonalInfo][getPlayeWallets] playerWallets.value:', playerWallets.value);
  }
  catch (error) {
    console.error('Failed to get player wallets:', error);
    message.error(t('error') || '獲取錢包資料失敗');
  }
};

const clickWalletsBtn = async (record: any) => {
  const memberID = `${record.account}@${record.agentID}`;
  await getPlayeWallets(memberID);
  isDialogForm2.value = true;
};

// ============ 站長切換處理（受控型 Consumer）============
// 當 Breadcrumb 站長切換時：
// - 重置 agent / 搜尋表單
// - 清空資料表內容
// - 不自動觸發 API（需使用者點擊【查詢】）
watch(
  () => contextVersion.value,
  async () => {
    query.value.agent = '';
    agentOptions.value = [];
    agentRawList.value = [];
    resetMemberSelector();

    const masterAgent = String(selectedMasterAgent.value || '').trim();
    if (!masterAgent) {
      return;
    }

    await fetchAgents(masterAgent);

    if (agentRawList.value.length > 0) {
      query.value.agent = String(agentRawList.value[0]?.account ?? '');
    }

    // ❗這裡不要碰 searchFormRef（受控型 Consumer，不自動觸發查詢）
  },
);

watch(
  () => [contextVersion.value, query.value.agent],
  async ([, agent]) => {
    if (!agent) {
      return;
    }

    await nextTick();

    const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
    if (!searchFormRef) {
      return;
    }

    searchFormRef.setFieldsValue({
      agent,
    });
  },
);

// 監聽 selectedMasterAgent 變化，自動載入 agent 列表
watch(
  () => selectedMasterAgent.value,
  async (newVal) => {
    if (newVal) {
      await fetchAgents(newVal);

      // 對齊 Vue2 AgentIDSelector：選完 masterAgent 會自動選第一個 agent（非 agent-level）
      if (userStore.level <= 4 && agentRawList.value.length > 0) {
        query.value.agent = agentRawList.value[0].account;
      }
    }
    else {
      agentRawList.value = [];
      agentOptions.value = [];
      query.value.agent = '';
    }
  },
  { immediate: true },
);

// 定義所有欄位（包含操作欄）
const baseColumns = getColumns(t);

// 預設：此頁不使用「表格欄位自動生成的搜尋表單」，避免產生過多搜尋欄位
baseColumns.forEach((col: any) => {
  if (col.hideInSearch === undefined) {
    col.hideInSearch = true;
  }
});

// ============ DynamicTable Search Form（僅 Submit 觸發）===========
// 搜尋欄位 0：代理
const agentSearchCol = baseColumns.find((c: any) => c?.dataIndex === 'authProvider');
if (agentSearchCol) {
  agentSearchCol.hideInSearch = false;
  agentSearchCol.searchField = 'agent';
  agentSearchCol.formItemProps = {
    label: t('filters.agent'),
    component: 'Select',
    order: 0,
    componentProps: () => ({
      options: agentOptions.value,
      disabled: isAgentDisabled.value,
      placeholder: t('filters.agent'),
      allowClear: false,
      onChange: (val: string) => {
        query.value.agent = String(val || '');
        // agent 變更時，清空 member（對齊 Vue2 Watch agent 行為）
        resetMemberSelector();
      },
    }),
  };
}

// 搜尋欄位 1：會員（對應 API payload.account）
const memberSearchCol = baseColumns.find((c: any) => c?.dataIndex === 'accountID');
if (memberSearchCol) {
  memberSearchCol.hideInSearch = false;
  memberSearchCol.searchField = 'memberAccount';
  memberSearchCol.formItemProps = {
    label: t('filters.member'),
    component: 'Select',
    order: 1,
    componentProps: () => ({
      options: memberOptions.value,
      loading: memberLoading.value,
      placeholder: t('filters.member'),
      allowClear: true,
      showSearch: true,
      filterOption: false,
      onSearch: onMemberSearch,
      onPopupScroll: onMemberPopupScroll,
      onChange: (val: string) => {
        const matched = memberOptions.value.find(o => o.value === val);
        query.value.memberID = val || '';
        query.value.memberAccount = matched?.raw?.account || '';
      },
    }),
  };
}

// 搜尋欄位 2：日期類別
const dateTypeSearchCol = baseColumns.find((c: any) => c?.dataIndex === 'registerTime');
if (dateTypeSearchCol) {
  dateTypeSearchCol.hideInSearch = false;
  dateTypeSearchCol.searchField = 'dateType';
  dateTypeSearchCol.formItemProps = {
    label: t('filters.dateType'),
    component: 'Select',
    order: 2,
    componentProps: {
      allowClear: false,
      options: [
        { label: t('filters.dateTypeCreatedAt'), value: 'createdAt' },
        { label: t('filters.dateTypeLastLoginTime'), value: 'lastLoginTime' },
      ],
    },
  };
}

// 搜尋欄位 3：日期區間（使用 lastLoginTime 欄位作為基礎）
const dateRangeSearchCol = baseColumns.find((c: any) => c?.dataIndex === 'lastLoginTime');
if (dateRangeSearchCol) {
  dateRangeSearchCol.hideInSearch = false;
  dateRangeSearchCol.searchField = 'dateRange';
  dateRangeSearchCol.formItemProps = {
    label: t('columns.dateRange'),
    component: 'RangePicker',
    order: 3,
    componentProps: {
      allowClear: false,
      format: 'YYYY-MM-DD',
      style: { width: '100%' },
    },
  };
}

const baseColumnsWithAction = computed<TableColumnItem[]>(() => {
  return [
    ...baseColumns,
    {
      title: t('columns.operation'),
      width: 240,
      dataIndex: 'ACTION',
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      /**
       * 防止內容換行（對齊 agent 頁操作欄行為）
       */
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap', // 禁止換行
          },
        };
      },
      actions: ({ record }) => [
        // {
        //   label: t('columns.viewVipRecord'),
        //   type: 'link',
        //   onClick: () => {
        //     message.info(t('featureDeveloping'));
        //   },
        // },
        {
          label: t('columns.viewPack'),
          type: 'link',
          onClick: () => {
            clickPackBtn(record);
          },
        },
        {
          label: t('columns.viewWallet'),
          type: 'link',
          onClick: () => {
            clickWalletsBtn(record);
          },
        },
      ],
    },
  ];
});

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumnsWithAction as any);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumnItem[]>(() => {
  const allColumns = baseColumnsWithAction.value;
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  // Guard: 確保 visibleColumnKeys 已初始化完成（非空且包含至少一個欄位）
  // 若 visibleColumnKeys 尚未初始化完成，不套用 hideInTable（維持全部顯示）
  const isVisibleKeysValid = Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return allColumns.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
    const isVisible = isVisibleKeysValid ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumnItem = {
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
    newColumns.forEach((col: TableColumnItem) => {
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
 * DynamicTable dataRequest（Submit 才觸發）
 * - 保留既有 Breadcrumb 站長參數（masterAgent）
 * - 合併搜尋表單參數：agent、memberAccount、dateType、dateRange
 */
const loadTableData = async (params: any) => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  const agent = String((params as any)?.agent ?? query.value.agent ?? '').trim();
  if (agent) {
    query.value.agent = agent;
  }

  if (!masterAgent) {
    message.error(t('filters.masterAgentRequired'));
    return { items: [], meta: { totalItems: 0 } };
  }

  if (!agent) {
    // 對齊 Vue2：未選 agentID 不查（直接回空，避免誤打 API）
    return { items: [], meta: { totalItems: 0 } };
  }

  // 從搜尋表單獲取參數
  const memberAccount = String((params as any)?.memberAccount ?? '').trim();
  const dateType = String((params as any)?.dateType ?? query.value.dateType ?? 'createdAt');
  const dateRange = (params as any)?.dateRange ?? query.value.dateRange;

  // 檢查日期範圍是否有效
  if (!dateRange || !Array.isArray(dateRange) || dateRange.length !== 2) {
    return { items: [], meta: { totalItems: 0 } };
  }

  const [startRaw, endRaw] = dateRange;

  // 型別防禦處理：無論 dateRange 內容來源為 Dayjs、Date 或字串，都先轉為 dayjs 物件
  const startDayjs = dayjs(startRaw);
  const endDayjs = dayjs(endRaw);

  // 檢查轉換後的 dayjs 是否為有效日期
  if (!startDayjs.isValid() || !endDayjs.isValid()) {
    return { items: [], meta: { totalItems: 0 } };
  }

  // 僅在有效的情況下，才轉為 Date 並傳入 API
  const appliedAgentID = buildAgentID(agent, masterAgent);

  const res = await queryAccountPersonalInfo({
    agentID: appliedAgentID,
    account: memberAccount,
    dateType: dateType as DateType,
    page: (params as any).page,
    limit: (params as any).pageSize,
    searchTime: {
      startTime: startDayjs.toDate(),
      dueTime: endDayjs.toDate(),
    },
  });

  // DynamicTable 預設抓 listField=items / totalField=meta.totalItems
  return {
    items: res?.result || [],
    meta: {
      totalItems: res?.count || 0,
    },
  };
};

/**
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料，使用當前選取的站長值
 */
const _handleFormSubmit = () => {
  dynamicTableInstance?.reload?.(true);
};

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent / agent：頁面級選擇器，用於構建查詢參數
 * - memberAccount / dateType / dateRange：查詢條件，直接傳遞給後端 API
 * - 所有查詢條件都通過 queryAccountPersonalInfo API 發送到後端
 * - 沒有前端過濾邏輯
 * 因此為 BACKEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  // 所有查詢條件都直接傳遞給後端 API，沒有前端過濾
  // 因此無論是否有查詢條件，都顯示為 BACKEND
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

onMounted(async () => {
  // 站長由 Breadcrumb 提供，不再需要 fetchMasterAgents
  // 初始化時，如果已有站長，自動載入 agent 列表
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (masterAgent) {
    await fetchAgents(masterAgent);

    if (userStore.level >= 5) {
      query.value.agent = userStore.agent;
    }
    else {
      query.value.agent = agentRawList.value[0]?.account || '';
    }
  }

  // 初始化搜尋表單預設值
  await nextTick();
  const searchFormRef = (dynamicTableInstance as any)?.getSearchFormRef?.();
  if (searchFormRef) {
    searchFormRef.setFieldsValue({
      agent: query.value.agent,
      dateType: query.value.dateType,
      dateRange: buildTodayRange(),
    });
  }
});
</script>

<template>
  <div class="member-personal-info-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="account"
        :columns="columns"
        :data-request="loadTableData"
        :scroll="{ x: tableConfig.scrollX.value }"
        :immediate="false"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          showAdvancedButton: true,
          submitOnReset: false,
        }"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ t('title') }}</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
      </DynamicTable>

      <!-- 背包對話框 -->
      <a-modal
        v-model:open="isDialogForm"
        :title="t('pack.title')"
        width="50%"
        :z-index="1000"
        :mask-style="{ zIndex: 1000 }"
        class="pack-dialog-modal"
      >
        <PackDynamicTable
          :columns="packColumns"
          :data-source="playerPack"
          :pagination="false"
          :search="false"
          :show-tool-bar="true"
          :show-table-setting="true"
          row-key="treasureItemID"
          class="pack-table-in-modal"
          :scroll="{ x: 'max-content' }"
        />
      </a-modal>

      <!-- 錢包對話框 -->
      <a-modal
        v-model:open="isDialogForm2"
        :title="t('wallet.title')"
        width="30%"
      >
        <a-table
          :data-source="playerWallets"
          :columns="walletColumns"
          :pagination="false"
          row-key="currencyType"
        />
      </a-modal>
    </div>
  </div>
</template>

<style scoped>
/* ARCH03：搜尋主控權已轉移至 DynamicTable formSchemas */
/* 頁面層搜尋表單樣式已移除 */
</style>

<style scoped>
/* 在 Modal 內禁用全屏功能 */
/* 隱藏背包視窗 Modal 內表格的全屏按鈕 - 使用多種選擇器確保完全隱藏 */

/* 方法 1: 通過 Modal 類名定位 */
.pack-dialog-modal :deep(.anticon-fullscreen),
.pack-dialog-modal :deep(.anticon-fullscreen-exit) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* 方法 2: 通過表格類名定位 */
.pack-table-in-modal :deep(.anticon-fullscreen),
.pack-table-in-modal :deep(.anticon-fullscreen-exit) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* 隱藏包含全屏圖標的父元素 - 使用更廣泛的選擇器 */
.pack-dialog-modal :deep(span:has(.anticon-fullscreen)),
.pack-dialog-modal :deep(span:has(.anticon-fullscreen-exit)),
.pack-dialog-modal :deep(.ant-tooltip:has(.anticon-fullscreen)),
.pack-dialog-modal :deep(.ant-tooltip:has(.anticon-fullscreen-exit)),
.pack-dialog-modal :deep(.ant-space-item:has(.anticon-fullscreen)),
.pack-dialog-modal :deep(.ant-space-item:has(.anticon-fullscreen-exit)),
.pack-table-in-modal :deep(span:has(.anticon-fullscreen)),
.pack-table-in-modal :deep(span:has(.anticon-fullscreen-exit)),
.pack-table-in-modal :deep(.ant-tooltip:has(.anticon-fullscreen)),
.pack-table-in-modal :deep(.ant-tooltip:has(.anticon-fullscreen-exit)),
.pack-table-in-modal :deep(.ant-space-item:has(.anticon-fullscreen)),
.pack-table-in-modal :deep(.ant-space-item:has(.anticon-fullscreen-exit)) {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* 如果 :has() 選擇器不支持，使用更直接的方式隱藏整個 Space 項目 */
.pack-dialog-modal :deep(.ant-space) > .ant-space-item:nth-child(3),
.pack-table-in-modal :deep(.ant-space) > .ant-space-item:nth-child(3) {
  display: none !important;
}

/* 確保全屏時表格在 Modal 之上 */
:deep(.ant-modal-wrap) {
  z-index: 1000 !important;
}

:deep(.ant-modal) {
  z-index: 1001 !important;
}

/* 修復全屏時 Modal 內容被隱藏的問題 */
/* 當全屏時，防止 app 容器被隱藏導致 Modal 內容消失 */
#app[style*='opacity: 0'] .ant-modal-wrap,
#app[style*='visibility: hidden'] .ant-modal-wrap {
  opacity: 1 !important;
  visibility: visible !important;
}

#app[style*='opacity: 0'] .ant-modal,
#app[style*='visibility: hidden'] .ant-modal {
  opacity: 1 !important;
  visibility: visible !important;
}

/* 防止背包視窗內滾動時觸發外層滾動（滾動穿透） */
.pack-dialog-modal :deep(.ant-modal-body) {
  overscroll-behavior: contain;
  overflow-x: auto;
}

/* 確保背包視窗內的表格滾動不會影響外層 */
.pack-table-in-modal :deep(.ant-table-body),
.pack-table-in-modal :deep(.ant-table-wrapper),
.pack-table-in-modal :deep(.ant-table-container) {
  overscroll-behavior: contain;
}

/* 防止背包視窗表格內容換行 */
.pack-table-in-modal :deep(.ant-table-cell) {
  white-space: nowrap !important;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 確保表格欄位內容不換行 */
.pack-table-in-modal :deep(.ant-table-tbody > tr > td),
.pack-table-in-modal :deep(.ant-table-thead > tr > th) {
  white-space: nowrap !important;
}
</style>
