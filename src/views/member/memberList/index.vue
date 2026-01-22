<script setup lang="ts">
import type { DefaultOptionType } from 'ant-design-vue/es/select';
import type { IAccountInfo, IQueryAccountParams } from '@/api/backend/adminSystem/accountSystem';
import type { IMemberVipInfo } from '@/api/backend/member/vipServer';
import type { PlayerPackItem } from '@/api/backend/treasureChestSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';

import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, inject, nextTick, onMounted, ref, watch } from 'vue';

import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import {
  createMemberAccount,
  fuzzyQueryUser,
  getMemberAccount,
  logoutAction4Platform,
  unbindPhoneNumber,
  updateMemberAccount,
} from '@/api/backend/adminSystem/accountSystem';
import { memberWallets } from '@/api/backend/adminSystem/cashRecordServer';
import { EPunishStatus, getPunishDetail } from '@/api/backend/adminSystem/suspension';
import { getMembersVip } from '@/api/backend/member/vipServer';
import { getPlayerPackV2 } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'MemberIndex',
});

// CDN Base URL（對齊 Vue2：從環境變數獲取）
const cdnBaseURL = import.meta.env.VITE_APP_CDN_BASE_URL || '';

const { t } = useI18n('routes.member.indexPage');
const commonT = useI18n('common').t;
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

// ============ DynamicTable 初始化 ============
const [DynamicTable, tableInstance] = useTable({
  search: true, // 使用 DynamicTable 內建搜尋表單（Submit 才觸發）
});

// ============ 查詢條件 ============
interface QueryState {
  agent: string;
}

const query = ref<QueryState>({
  agent: '',
});

// agent options
const agentOptions = ref<DefaultOptionType[]>([]);
const agentRawList = ref<any[]>([]);

// 從 Layout provide 取得站長選單狀態（Breadcrumb 站長 Context）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

const selectedMasterAgent = computed(() => {
  // 優先使用 Layout 提供的站長值
  const v = masterAgentCtx?.selectedMasterAgent.value;
  if (v) {
    return String(v).trim();
  }
  // fallback：Level 4 以上用戶固定站長（既有系統狀態）
  if (userStore.level >= 4) {
    return String(userStore.masterAgent || '').trim();
  }
  return '';
});

const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

const isAgentDisabled = computed(() => userStore.level >= 5 || !selectedMasterAgent.value);

const fetchAgents = async (masterAgent: string) => {
  if (!masterAgent) {
    agentRawList.value = [];
    agentOptions.value = [];
    return;
  }
  const list = await getAgentListByMasterAgent({ masterAgent });
  agentRawList.value = list || [];
  agentOptions.value = (list || []).map((i) => {
    const agentText = i.account.includes('.') ? i.account.split('.')[0] : i.account;
    return { label: agentText, value: i.account };
  });
};

// ============ 會員（Vue2：模糊搜尋下拉，不會觸發查詢）===========
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: any }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;

const _resetMemberSelector = () => {
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
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
      masterAgent,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? (memberLastAccountID.value || undefined) : undefined,
    });

    const list = res || [];
    const mapped = list
      .map(item => ({
        raw: item,
        value: String(item.account ?? ''),
        label: `${item.accountID} - ${item.nickName}`,
      }))
      .filter(i => i.value);

    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? String(list[list.length - 1].accountID ?? '') : memberLastAccountID.value;
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
  if (!memberLastQueryText.value || !memberLastAccountID.value) {
    return;
  }
  await fetchMemberOptions(memberLastQueryText.value, true);
};

const buildAgentID = (agent: string, masterAgent: string) => {
  if (!agent || !masterAgent) {
    return '';
  }
  if (agent.includes('.')) {
    return agent;
  }
  return `${agent}.${masterAgent}`;
};

const _onAgentChanged = (val: string) => {
  query.value.agent = val;
};

/**
 * DynamicTable dataRequest（Submit 才觸發）
 * - 保留既有 Breadcrumb 站長參數（masterAgent）
 * - 合併搜尋表單參數：account、phoneNumber
 */
const loadTableData = async (params: LoadDataParams & Record<string, any>): Promise<API.TableListResult> => {
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
    message.error(t('filters.agentRequired'));
    return { items: [], meta: { totalItems: 0 } };
  }

  // 查詢條件驗證：會員與電話至少擇一輸入
  const account = String((params as any)?.account ?? '').trim();
  const phoneNumberRaw = (params as any)?.phoneNumber;
  const phoneNumber = String(phoneNumberRaw ?? '').trim();
  if (!account && !phoneNumber) {
    message.error('會員與電話至少擇一輸入');
    return { items: [], meta: { totalItems: 0 } };
  }

  const agentID = buildAgentID(agent, masterAgent);

  const payload: IQueryAccountParams = {
    agentID,
    page: 1,
    limit: 1000,
    account: account || undefined,
    isPersonalInfo: true,
  };

  if (phoneNumber) {
    // Vue2 對齊：至少 5 碼 + 必須為數字
    if (!/^[0-9]*$/.test(phoneNumber)) {
      message.error(t('notify.isNotNumber'));
      return { items: [], meta: { totalItems: 0 } };
    }
    if (phoneNumber.length < 5) {
      message.error(t('notify.phoneNumberLength'));
      return { items: [], meta: { totalItems: 0 } };
    }
    payload.phoneNumber = Number(phoneNumber);
  }

  // 暫時加入 console.log 確認點擊【查詢】時參數是否正確帶出
  console.log('[MemberList][loadTableData] payload:', payload);

  const response = await getMemberAccount(payload);
  console.log('[MemberList][loadTableData] response:', response);

  // 處理回傳格式：根據實際 API 回傳結構提取資料
  // API 回傳格式：{ data: { result: [], count: number } }
  // request 函數對於 AdminSystem API：
  // - interceptor 返回 response（整個 AxiosResponse）
  // - 如果 isReturnResult 為 true（預設），會返回 data.data
  // - 但 AdminSystem API 沒有 code 欄位，所以會返回整個 data
  // 所以 response 可能是 { data: { result: [], count: number } } 或直接是 { result: [], count: number }
  let data: { result: IAccountInfo[]; count: number } | undefined;
  if (response && typeof response === 'object') {
    if ('data' in response && response.data && typeof response.data === 'object' && 'result' in response.data) {
      // 如果格式是 { data: { result: [], count: number } }
      data = (response as any).data;
    }
    else if ('result' in response) {
      // 如果格式直接是 { result: [], count: number }
      data = response as any;
    }
  }

  console.log('[MemberList][loadTableData] extracted data:', data);

  let resultList: IAccountInfo[] = data?.result || [];
  const totalItems = Number(data?.count ?? resultList.length);

  console.log('[MemberList][loadTableData] resultList:', resultList);
  console.log('[MemberList][loadTableData] totalItems:', totalItems);

  // 確保 resultList 是陣列
  if (!Array.isArray(resultList)) {
    console.error('[MemberList][loadTableData] resultList is not an array:', resultList);
    resultList = [];
  }

  // 驗證資料格式，確保每筆資料都有必要的欄位
  if (resultList.length > 0) {
    console.log('[MemberList][loadTableData] First item:', resultList[0]);
    console.log('[MemberList][loadTableData] First item accountID:', resultList[0]?.accountID);
    console.log('[MemberList][loadTableData] First item account:', resultList[0]?.account);
    console.log('[MemberList][loadTableData] First item agentID:', resultList[0]?.agentID);

    // 過濾掉沒有 accountID 的資料
    const validItems = resultList.filter(item => item?.accountID);
    if (validItems.length !== resultList.length) {
      console.warn('[MemberList][loadTableData] Some items are missing accountID, filtered out');
      resultList = validItems;
    }
  }

  // 獲取停權狀態（站長參數不可移除）
  let suspensionStatus = t('suspension.normal');
  if (resultList.length > 0) {
    try {
      const punishRes = await getPunishDetail({ masterAgent });
      const punishList = (punishRes as any)?.data ?? punishRes;
      const punishData = (Array.isArray(punishList) ? punishList : [])
        .find((item: any) => item?.accountID === resultList[0].accountID);
      if (punishData) {
        switch (punishData.punishStatus) {
          case EPunishStatus.SUSPEND:
            suspensionStatus = t('suspension.platformSuspension');
            break;
          case EPunishStatus.MUTE:
            suspensionStatus = t('suspension.chatRoomBan');
            break;
          case EPunishStatus.BAN_GIFT:
            suspensionStatus = t('suspension.giftBan');
            break;
        }
      }
    }
    catch (error) {
      console.error('Failed to get punish detail:', error);
    }
  }

  resultList = resultList.map((item) => {
    const memberID = `${item.account}@${item.agentID}`;
    const processedItem = {
      ...item,
      memberID,
      accountStatusSwitch: Number(item.accountStatus) === 1,
      suspension: suspensionStatus,
    };

    // 確保 accountID 存在
    if (!processedItem.accountID) {
      console.warn('[MemberList][loadTableData] Item missing accountID:', processedItem);
    }

    return processedItem;
  });

  // 獲取 VIP 資訊
  if (resultList.length > 0) {
    const memberIDs = resultList.map(item => item.memberID!).filter(Boolean);
    try {
      const vipRes = await getMembersVip({ memberID: memberIDs });
      const vipList = (vipRes as any)?.data ?? vipRes ?? [];
      resultList = resultList.map((item) => {
        const vipItem = (Array.isArray(vipList) ? vipList : []).find((v: IMemberVipInfo) => v.memberID === item.memberID);
        return vipItem ? { ...item, vip: vipItem.vip, vipName: vipItem.vipName, lastMonthVip: vipItem.lastMonthVip } : item;
      });
    }
    catch (error) {
      console.error('Failed to get VIP info:', error);
    }
  }

  const returnData = {
    items: resultList,
    meta: { totalItems },
  };

  console.log('[MemberList][loadTableData] returnData:', returnData);
  console.log('[MemberList][loadTableData] returnData.items is array:', Array.isArray(returnData.items));
  console.log('[MemberList][loadTableData] returnData.items length:', returnData.items?.length);

  return returnData;
};

// ============ 表格列定義 ============
const baseColumns: TableColumn<IAccountInfo>[] = [
  {
    title: t('columns.authProvider'),
    dataIndex: 'authProvider',
    key: 'authProvider',
    flexible: true, // 彈性寬度欄位
    minWidth: 140, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.accountID'),
    dataIndex: 'accountID',
    key: 'accountID',
    flexible: true, // 彈性寬度欄位
    minWidth: 140, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.vipName'),
    dataIndex: 'vipName',
    key: 'vipName',
    flexible: true, // 彈性寬度欄位
    minWidth: 140, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.nickName'),
    dataIndex: 'nickName',
    key: 'nickName',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.guildName'),
    dataIndex: 'guildName',
    key: 'guildName',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.phoneNumber'),
    dataIndex: 'phoneNumber',
    key: 'phoneNumber',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.registDatetime'),
    dataIndex: 'registerTime',
    key: 'registerTime',
    flexible: true, // 彈性寬度欄位
    minWidth: 180, /**
                    * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
                    */
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
    title: t('columns.lastLoginDevice'),
    dataIndex: 'lastLoginDevice',
    key: 'lastLoginDevice',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.lastLoginDatetime'),
    dataIndex: 'lastLoginTime',
    key: 'lastLoginTime',
    flexible: true, // 彈性寬度欄位
    minWidth: 180, /**
                    * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
                    */
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
    title: t('columns.lastLoginIP'),
    dataIndex: 'lastLoginIP',
    key: 'lastLoginIP',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.suspension'),
    dataIndex: 'suspension',
    key: 'suspension',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
  },
  {
    title: t('columns.status'),
    dataIndex: 'accountStatus',
    key: 'accountStatus',
    width: 100, /**
                 * 固定寬度欄位
                 */
    customRender: ({ text }: any) => {
      return h(Tag, {
        color: text === 1 ? 'success' : 'error',
      }, () => text === 1 ? t('enable') : t('disable'));
    },
  },
  {
    title: commonT('action.operation'),
    dataIndex: 'ACTION',
    key: 'ACTION',
    width: 420, // 固定寬度欄位（已加寬）
    align: 'center' as const,
    fixed: 'right' as const,
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
  },
];

// ============ DynamicTable Search Form（僅 Submit 觸發）===========
// 預設：此頁不使用「表格欄位自動生成的搜尋表單」，避免產生過多搜尋欄位
baseColumns.forEach((col: any) => {
  if (col.hideInSearch === undefined) {
    col.hideInSearch = true;
  }
});

// 搜尋欄位 0：代理（放在搜尋區裡）
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
      allowClear: true,
      onChange: (val: string) => {
        query.value.agent = String(val || '');
      },
    }),
  };
}

// 搜尋欄位 1：會員（對應 API payload.account）
const accountSearchCol = baseColumns.find((c: any) => c?.dataIndex === 'accountID');
if (accountSearchCol) {
  accountSearchCol.hideInSearch = false;
  accountSearchCol.searchField = 'account';
  accountSearchCol.formItemProps = {
    label: t('filters.member'),
    component: 'Select',
    order: 1,
    componentProps: () => ({
      options: memberOptions.value,
      loading: memberLoading.value,
      placeholder: `${t('filters.member')}（與電話至少擇一）`,
      allowClear: true,
      showSearch: true,
      filterOption: false,
      onSearch: onMemberSearch,
      onPopupScroll: onMemberPopupScroll,
    }),
  };
}

// 搜尋欄位 1.5：手機（對應 API payload.phoneNumber）
const phoneSearchCol = baseColumns.find((c: any) => c?.dataIndex === 'phoneNumber');
if (phoneSearchCol) {
  phoneSearchCol.hideInSearch = false;
  phoneSearchCol.searchField = 'phoneNumber';
  phoneSearchCol.formItemProps = {
    label: t('columns.phoneNumber'),
    component: 'Input',
    order: 2,
    componentProps: {
      allowClear: true,
      placeholder: `${t('filters.phoneNumber5code')}（與會員至少擇一）`,
    },
  };
}

// 使用 useTableConfig 管理列顯示設定
const tableConfig = useTableConfig(baseColumns as any);

// 初始化完成標記，避免初始化時被 watch 覆寫
const isInitialized = ref(false);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;

  // Guard: 如果 visibleColumnKeys 尚未初始化完成（空或無效），維持全部顯示
  // 這確保初始載入時所有欄位都能正確顯示
  const shouldApplyVisibility = isInitialized.value && Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return baseColumns.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = shouldApplyVisibility ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol = {
      ...col,
      hideInTable: shouldApplyVisibility ? !isVisible : false,
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
    // Guard: 如果尚未初始化完成，不進行同步，避免覆寫初始值
    if (!isInitialized.value) {
      return;
    }

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

// 標記初始化完成（在首次 render 後）
// 使用 watch 監聽 visibleColumnKeys 的初始化，確保在首次有效值出現時標記為已初始化
watch(
  () => tableConfig.visibleColumnKeys.value,
  (keys) => {
    // 當 visibleColumnKeys 首次有有效值時，標記為已初始化
    if (!isInitialized.value && Array.isArray(keys) && keys.length > 0) {
      isInitialized.value = true;
    }
  },
  { immediate: true },
);

// 類型 B：有搜尋區頁面 - 使用 computed 組合 scroll 對象
// 只傳入 scroll.x，不傳入 scroll.y，讓 useScroll 根據 autoHeight 自動計算 scroll.y
// useScroll 會在 autoHeight 啟用時自動計算並設置 scroll.y
const tableScroll = computed(() => {
  return {
    x: tableConfig.scrollX.value,
    // 不傳入 y，讓 useScroll 根據 autoHeight: true 自動計算
  };
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

// ============ 對話框 ============
const DIALOG_STATUS_UPDATE = 'UPDATE';
const DIALOG_STATUS_CREATE = 'CREATE';

const dialogFormVisible = ref(false);
const dialogStatus = ref('');
const tempDialogData = ref<any>({
  accountID: '',
  account: '',
  agentID: '',
  prefix: '',
  nickName: '',
  password: '',
  activationDate: {
    startTime: undefined,
    dueTime: undefined,
  },
  registerTime: undefined,
  lastLoginTime: undefined,
  lastLoginIP: '',
  suspension: '',
  accountStatus: 0,
  tags: '',
  accountStatusSwitch: false,
});

const defaultTempDialogData = () => ({
  accountID: '',
  account: '',
  agentID: '',
  prefix: '',
  nickName: '',
  password: '',
  activationDate: {
    startTime: undefined,
    dueTime: undefined,
  },
  registerTime: undefined,
  lastLoginTime: undefined,
  lastLoginIP: '',
  suspension: '',
  accountStatus: 0,
  tags: '',
  accountStatusSwitch: false,
});

const textMap = computed(() => ({
  UPDATE: t('dialog.editMemberAccount'),
  CREATE: t('dialog.createMemberAccount'),
}));

const isMember = (payload: any) => {
  const { tags } = payload;
  if (tags) {
    const regExp = /Streamer/i;
    if (tags.match(regExp)) {
      return false;
    }
    return true;
  }
  return true;
};

const _openCreateDialog = () => {
  dialogStatus.value = DIALOG_STATUS_CREATE;
  tempDialogData.value = defaultTempDialogData();
  tempDialogData.value.agentID = buildAgentID(query.value.agent, selectedMasterAgent.value);
  dialogFormVisible.value = true;
};

const _openEditDialog = (row: IAccountInfo) => {
  dialogStatus.value = DIALOG_STATUS_UPDATE;
  tempDialogData.value = { ...row };
  dialogFormVisible.value = true;
};

const onDialogConfirm = async () => {
  if (dialogStatus.value === DIALOG_STATUS_CREATE) {
    await createAccount();
  }
  else if (dialogStatus.value === DIALOG_STATUS_UPDATE) {
    await updateAccount();
  }
};

async function createAccount() {
  const nickName = tempDialogData.value.nickName === ''
    ? tempDialogData.value.account
    : tempDialogData.value.nickName;

  const postData = {
    account: tempDialogData.value.account,
    nickName,
    password: tempDialogData.value.password,
    agentID: buildAgentID(query.value.agent, selectedMasterAgent.value),
    accountActivationDate: {},
    tags: '',
    infos: undefined,
  };

  const res = await createMemberAccount(postData);

  if (!res.error) {
    await tableInstance?.reload(true);
    dialogFormVisible.value = false;
    message.success(t('notify.createMemberAccountSuccess', [tempDialogData.value.account]));
  }
  else {
    let errorMsg = '';
    if (res.error.code === 'ACCOUNT_ALREADY_EXISTS') {
      errorMsg = t('notify.accountAlreadyExists');
    }
    else {
      errorMsg = res.error.message || t('error');
    }
    message.error(errorMsg);
  }
}

async function updateAccount() {
  const tempData = { ...tempDialogData.value };
  const res = await updateMemberAccount({
    memberID: `${tempData.account}@${tempData.agentID}`,
    newPassword: tempData.password || undefined,
    newNickname: tempData.nickName,
    newAccountStatus: tempData.accountStatus,
    newActivationDate: tempData.activationDate,
    newTags: tempData.tags,
  });

  if (!tempData.accountStatus) {
    await logoutAction4Platform({ memberID: `${tempData.account}@${tempData.agentID}` });
  }

  dialogFormVisible.value = false;

  if (!res.error) {
    await tableInstance?.reload(true);
    message.success(t('notify.updateMemberAccountSuccess', [tempData.nickName]));
  }
  else {
    message.error(res.error.message || t('error'));
  }
}

const switchAccountStatus = async (row: IAccountInfo) => {
  const tempData = { ...row };
  tempData.accountStatus = tempData.accountStatusSwitch === false ? 0 : 1;
  delete tempData.accountStatusSwitch;

  const res = await updateMemberAccount({
    memberID: `${tempData.account}@${tempData.agentID}`,
    newAccountStatus: tempData.accountStatus,
  });

  if (!tempData.accountStatus) {
    await logoutAction4Platform({ memberID: `${tempData.account}@${tempData.agentID}` });
  }

  if (!res.error) {
    await tableInstance?.reload(true);
    message.success(t('success'));
  }
  else {
    message.error(res.error.message || t('error'));
  }
};

// ============ 背包對話框 ============
const isDialogForm = ref(false);
const playerPack = ref<PlayerPackItem[]>([]);
const [PackDynamicTable] = useTable({
  search: false, // 背包視窗不需要搜尋功能
});

const packColumns: TableColumn<PlayerPackItem>[] = [
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
    message.error(t('error'));
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

const clickPackBtn = async (row: IAccountInfo) => {
  const memberID = `${row.account}@${row.agentID}`;
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
    // 使用 MutationObserver 監聽 DOM 變化，確保動態添加的元素也被隱藏
    const observer = new MutationObserver(() => {
      hideFullscreenButton();
    });
    const modal = document.querySelector('.pack-dialog-modal');
    if (modal) {
      observer.observe(modal, {
        childList: true,
        subtree: true,
      });
      // 當 Modal 關閉時停止觀察
      setTimeout(() => {
        if (!isDialogForm.value) {
          observer.disconnect();
        }
      }, 1000);
    }
  }
});

// ============ 錢包對話框 ============
const isDialogForm2 = ref(false);
const playerWallets = ref<any[]>([]);
const walletColumns = [
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
    console.log('[MemberList][getPlayeWallets] response:', res);

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

    console.log('[MemberList][getPlayeWallets] extracted walletsData:', walletsData);
    playerWallets.value = walletsData;
    console.log('[MemberList][getPlayeWallets] playerWallets.value:', playerWallets.value);
  }
  catch (error) {
    console.error('Failed to get player wallets:', error);
    message.error(t('error'));
  }
};

const clickWalletsBtn = async (row: IAccountInfo) => {
  const memberID = `${row.account}@${row.agentID}`;
  await getPlayeWallets(memberID);
  isDialogForm2.value = true;
};

/**
 * ============ 其他操作 ============
 */
const clickKickAllGameBtn = (row: IAccountInfo) => {
  Modal.confirm({
    title: t('warning'),
    content: t('notify.clickKickAllGame'),
    async onOk() {
      try {
        await logoutAction4Platform({ memberID: `${row.account}@${row.agentID}` });
        message.success(t('postfinish'));
      }
      catch (error) {
        console.error('Failed to kick all game:', error);
        message.error(t('error'));
      }
    },
  });
};

const clickUnbindPhoneNumberBtn = async (row: IAccountInfo) => {
  try {
    await unbindPhoneNumber({ memberID: row.memberID! });
    await tableInstance?.reload(true);
    message.success(t('success'));
  }
  catch (error) {
    console.error('Failed to unbind phone number:', error);
    message.error(t('error'));
  }
};

// ============ VIP 記錄對話框 ============
const isShowMemberVipRecordDialog = ref(false);
const parsedMemberVipRecordsByLast12Month = ref<{ month: string; vip: number | null }[]>([]);

const getLast12MonthTexts = (): string[] => {
  const months: string[] = [];
  const monthRequired = 12;
  for (let index = 0; index < monthRequired; index++) {
    months.push(dayjs().subtract(index, 'month').format('YYYY-MM'));
  }
  return months;
};

const _showVipRecordDialog = (_row: IAccountInfo) => {
  // TODO: 實現 VIP 記錄查詢
  parsedMemberVipRecordsByLast12Month.value = getLast12MonthTexts().map(month => ({ month, vip: null }));
  isShowMemberVipRecordDialog.value = true;
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

    const masterAgent = String(selectedMasterAgent.value || '').trim();
    if (!masterAgent) {
      return;
    }

    await fetchAgents(masterAgent);

    if (agentRawList.value.length > 0) {
      query.value.agent = String(agentRawList.value[0]?.account ?? '');
    }

    // ❗這裡不要碰 searchFormRef
  },
);

watch(
  () => [contextVersion.value, query.value.agent],
  async ([, agent]) => {
    if (!agent) {
      return;
    }

    await nextTick();

    const searchFormRef = (tableInstance as any)?.getSearchFormRef?.();
    if (!searchFormRef) {
      return;
    }

    searchFormRef.setFieldsValue({
      agent,
    });
  },
);

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - masterAgent / agent：頁面級選擇器，用於構建查詢參數
 * - memberAccount / accountID / phoneNumber：查詢條件，直接傳遞給後端 API
 * - 所有查詢條件都通過 getMemberAccount API 發送到後端
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

// ============ 初始化 ============
onMounted(async () => {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (masterAgent) {
    await fetchAgents(masterAgent);
    // 預設選第一個 agent（但不自動查詢）
    // Level 5 以上優先使用 userStore.agent，如果為空則選擇第一個
    if (userStore.level >= 5 && userStore.agent) {
      query.value.agent = userStore.agent;
    }
    else if (agentRawList.value.length > 0) {
      query.value.agent = String(agentRawList.value[0]?.account ?? '');
    }

    // 同步預設 agent 到搜尋表單（不觸發 submit）
    await nextTick();
    const searchFormRef = (tableInstance as any)?.getSearchFormRef?.();
    searchFormRef?.setFieldsValue?.({
      agent: query.value.agent || undefined,
    });
  }

  // 類型 B：有搜尋區頁面 - 在 mounted + nextTick 後確保容器高度穩定
  // useScroll hook 會在 autoHeight 啟用時自動計算 scrollY
  // 使用雙重 nextTick 確保 DOM 完全渲染完成，讓 useScroll 能正確計算容器高度
  await nextTick();
  await nextTick();
  // 額外延遲一小段時間，確保容器高度計算完成
  // 注意：scrollY 保持為 undefined，useScroll 會根據 autoHeight: true 自動計算
  setTimeout(() => {
    // useScroll hook 會自動監聽容器變化並計算 scrollY
    // 這裡不需要手動設置 scrollY，因為 autoHeight: true 已啟用自動計算
  }, 100);
});
</script>

<template>
  <div class="app-container member">
    <div class="agent-page">
      <!-- 表格 -->
      <div class="table-container" :style="{ overflowX: containerOverflowX }">
        <DynamicTable
          :key="contextVersion"
          :data-request="loadTableData"
          :columns="columns"
          :pagination="false"
          row-key="accountID"
          :scroll="tableScroll"
          :auto-height="true"
          :immediate="false"
          :form-props="{
            showSubmitButton: true,
            showResetButton: true,
            showAdvancedButton: true,
            submitOnReset: true,
          }"
        >
          <template #headerTitle>
            <div style="display: flex; align-items: center; gap: 8px">
              <span span>{{ t('index') }}</span>
              <Tag :color="searchModeConfig.color" style="margin: 0">
                SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
              </Tag>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'ACTION'">
              <div style="display: flex; gap: 8px; justify-content: center; white-space: nowrap;">
                <!-- 啟用/停用帳號 -->
                <a-button
                  type="link"
                  :danger="record.accountStatusSwitch"
                  size="small"
                  @click="switchAccountStatus(record)"
                >
                  {{ record.accountStatusSwitch ? commonT('action.disable') : commonT('action.enable') }}
                </a-button>
                <!-- 解綁手機號碼 -->
                <a-button
                  v-if="record.phoneNumber && record.authProvider !== 'sms'"
                  type="link"
                  size="small"
                  @click="clickUnbindPhoneNumberBtn(record)"
                >
                  {{ t('labels.unbindPhoneNumber') }}
                </a-button>
                <!-- 踢出所有遊戲 -->
                <a-button
                  type="link"
                  size="small"
                  @click="clickKickAllGameBtn(record)"
                >
                  {{ t('columns.kickAllGame') }}
                </a-button>
                <!-- 查看背包 -->
                <a-button
                  type="link"
                  size="small"
                  @click="clickPackBtn(record)"
                >
                  {{ t('columns.viewPack') }}
                </a-button>
                <!-- 查看錢包 -->
                <a-button
                  type="link"
                  size="small"
                  @click="clickWalletsBtn(record)"
                >
                  {{ t('columns.viewWallets') }}
                </a-button>
              </div>
            </template>
          </template>
        </DynamicTable>
      </div>

      <!-- 編輯/創建帳號對話框 -->
      <a-modal
        v-model:open="dialogFormVisible"
        :title="textMap[dialogStatus]"
        :width="500"
        @ok="onDialogConfirm"
      >
        <a-form
          :model="tempDialogData"
          :label-col="{ span: 6 }"
          :wrapper-col="{ span: 18 }"
        >
          <a-form-item :label="t('columns.account')">
            <a-input
              v-model:value="tempDialogData.account"
              :readonly="dialogStatus !== DIALOG_STATUS_CREATE"
            />
          </a-form-item>
          <a-form-item
            v-if="dialogStatus === DIALOG_STATUS_CREATE"
            :label="t('labels.password')"
          >
            <a-input-password v-model:value="tempDialogData.password" />
          </a-form-item>
          <a-form-item
            v-if="dialogStatus === DIALOG_STATUS_UPDATE && !isMember(tempDialogData)"
            :label="t('datePicker.startDate')"
          >
            <a-date-picker
              v-model:value="tempDialogData.activationDate.startTime"
              show-time
              :placeholder="t('datePicker.startDate')"
            />
          </a-form-item>
          <a-form-item
            v-if="dialogStatus === DIALOG_STATUS_UPDATE && !isMember(tempDialogData)"
            :label="t('datePicker.dueDate')"
          >
            <a-date-picker
              v-model:value="tempDialogData.activationDate.dueTime"
              show-time
              :placeholder="t('datePicker.dueDate')"
            />
          </a-form-item>
        </a-form>
        <template #footer>
          <a-button @click="dialogFormVisible = false">
            {{ t('cancel') }}
          </a-button>
          <a-button
            type="primary"
            @click="onDialogConfirm"
          >
            {{ t('confirm') }}
          </a-button>
        </template>
      </a-modal>

      <!-- VIP 記錄對話框 -->
      <a-modal
        v-model:open="isShowMemberVipRecordDialog"
        :title="t('vip.memberVipRecord')"
        :width="600"
      >
        <a-table
          :data-source="parsedMemberVipRecordsByLast12Month"
          :columns="[
            { title: t('columns.memberVipRecordMonth'), dataIndex: 'month', key: 'month' },
            { title: t('columns.memberVipRecordVipLevel'), dataIndex: 'vip', key: 'vip' },
          ]"
          :pagination="false"
        />
      </a-modal>

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
.member {
  .filter-container {
    margin-bottom: 16px;
    background: white;
    padding: 24px 24px 0 24px;
    border-radius: 4px;

    .wrap {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding-bottom: 24px;
    }

    /* 確保搜尋條件區與操作按鈕區之間有明確視覺間距 */
    /* 當按鈕換行時，頂部間距由 gap 處理，無需額外調整 */

    .hint-text {
      font-size: 12px;
      color: #999;
      margin-left: 10px;
    }
  }
}

/* Dark mode support */
:deep(.dark) .member .filter-container {
  background: #000;
}

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
