<script setup lang="ts">
import type { QueryTokenRecordsParams } from '@/api/backend/adminAccount/token';
import type { AccountBaseInfoItem } from '@/api/backend/adminSystem/accountSystem';
import type { LoadDataParams } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue';

import { getAgentListByMasterAgent } from '@/api/backend/adminAccount/agent';
import { queryTokenRecords, queryTokens } from '@/api/backend/adminAccount/token';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

import { createColumns } from './columns';
import { formSchemas } from './formSchemas';

/**
 * 最終穩定版說明
 * - SearchForm schema 僅初始化一次
 * - async Select (agent / token / member) 一律用 updateSearchFormSchema 更新
 * - member fuzzy search 的 onSearch 只註冊一次，後續不覆蓋
 */

const masterAgentCtx = inject<any>(MASTER_AGENT_SELECT_KEY);
const userStore = useUserStore();
const { t: tTokenRecords } = useI18n('page.tokenRecordTable');

const selectedMasterAgent = computed(() => {
  return (
    masterAgentCtx?.selectedMasterAgent?.value
    || (userStore.level >= 4 ? userStore.masterAgent : '')
  )?.trim() || '';
});

const contextVersion = computed(() => masterAgentCtx?.contextVersion?.value ?? 0);

const [DynamicTable, tableInstance] = useTable({
  search: true,
});

/* ================= Table Config ================= */

/* ================= Token ================= */

const tokenList = ref<any[]>([]);
const tokenObjList = ref<Record<number, string>>({});

// 建立映射物件（對齊 Vue2 邏輯）
const typeObjList = computed(() => ({
  Promote: tTokenRecords('type.Promote'),
  MailAttachment: tTokenRecords('type.MailAttachment'),
  Mission: tTokenRecords('type.Mission'),
}));

const subTypeObjList = computed(() => ({
  General: tTokenRecords('subType.General'),
  Award: tTokenRecords('subType.Award'),
  Transaction: tTokenRecords('subType.Transaction'),
  Reward: tTokenRecords('subType.Reward'),
}));

const sourceObjList: Record<string, string> = {
  'L007': 'gachpon',
  'mail-system': 'mail',
  'game-mission-system': 'mission',
  'L010': 'dailydraw',
  'marketing-event-system': 'event',
  'token-server': 'token',
};

// 建立 columns（傳入映射物件）
const columns = computed(() => createColumns({
  tokenObjList: tokenObjList.value,
  typeObjList: typeObjList.value,
  subTypeObjList: subTypeObjList.value,
  sourceObjList,
  getI18nText: (path: string) => tTokenRecords(path),
}));

// 過濾出非搜尋欄位（用於 useTableConfig，排除 hideInTable: true 的搜尋欄位）
const tableColumns = computed(() => {
  return columns.value.filter(col => !col.hideInTable);
});

// 使用表格配置 Hook（提供列設置、欄寬自適應等功能）
const tableConfig = useTableConfig(tableColumns as any);

// 根據 visibleColumnKeys 過濾欄位（不修改 hideInTable）
const finalColumns = computed(() => {
  return columns.value.filter((col) => {
    // 搜尋專用欄位永遠不顯示於表格
    if (col.hideInTable) {
      return false;
    }

    // 使用 visibleColumnKeys 作為唯一顯示控制來源
    const key = (col.dataIndex as string) || (col.key as string) || '';
    return tableConfig.visibleColumnKeys.value.includes(key);
  });
});

// 計算 scroll.x（僅在實際溢位時顯示橫向滾動條）
const tableScrollX = computed(() => {
  const scrollX = tableConfig.scrollX.value;
  // 當 scrollX 為 number（代表可能溢位）→ 使用 '100%'（僅在實際溢位時顯示）
  // 其他情況 → undefined（不顯示橫向滾動條）
  return typeof scrollX === 'number' ? '100%' : undefined;
});

/* ================= SearchMode ================= */

type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const searchMode = computed<SearchMode>(() => {
  // 所有搜尋條件都用於後端 API 查詢
  // 因此無論是否有搜尋條件，都顯示為 BACKEND
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

/* ================= Agent ================= */

const agentRawList = ref<any[]>([]);

const loadAgents = async () => {
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    return;
  }

  agentRawList.value = await getAgentListByMasterAgent({ masterAgent }) || [];

  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'agentID',
    componentProps: {
      options: agentRawList.value.map((i: any) => ({
        label: i.account.includes('.') ? i.account.split('.')[0] : i.account,
        value: i.account,
      })),
      disabled: userStore.level >= 5,
    },
  }]);

  if (agentRawList.value.length) {
    tableInstance.getSearchFormRef()?.setFieldsValue({
      agentID: agentRawList.value[0].account,
    });
  }
};

const loadTokens = async () => {
  console.log('loadTokens');
  const masterAgent = selectedMasterAgent.value;
  if (!masterAgent) {
    return;
  }

  const res = await queryTokens({ masterAgent });
  tokenList.value = (res as any)?.data ?? res ?? [];

  // 建立 tokenObjList 映射（用於 columns 顯示）
  tokenObjList.value = {};
  tokenList.value.forEach((item: any) => {
    if (item.id !== undefined && item.name) {
      tokenObjList.value[item.id] = item.name;
    }
  });

  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'tokenID',
    componentProps: {
      options: tokenList.value.map((t: any) => ({
        label: t.name,
        value: t.id,
      })),
      allowClear: true,
    },
  }]);
};

/* ================= Member (fuzzy) ================= */

const memberOptions = ref<any[]>([]);
const memberLoading = ref(false);
const sMemberID = ref('');

/** 後續只更新 options / loading */
const updateMemberOptions = async () => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'memberID',
    componentProps: {
      options: memberOptions.value,
      loading: memberLoading.value,
    },
  }]);
};

const onMemberSearch = debounce(async (text: string) => {
  if (!text || text.length < 2) {
    return;
  }

  const form = tableInstance.getSearchFormRef();
  const agentID = form?.getFieldsValue()?.agentID;
  if (!agentID) {
    message.error('請先選擇代理');
    return;
  }

  memberLoading.value = true;
  await updateMemberOptions();

  try {
    const res = await fuzzyQueryUser({
      masterAgent: selectedMasterAgent.value,
      agentID,
      queryText: text,
      limit: 10,
    });
    console.log('res', res);
    memberOptions.value = (res || []).map((i: any) => ({
      label: `${i.accountID} - ${i.nickName}`,
      value: `${i.account}@${i.agentID}`,
    }));
  }
  finally {
    memberLoading.value = false;
    await updateMemberOptions();
  }
}, 300);

/** 初始化一次 member schema（只註冊 handler） */
const initMemberSchema = async () => {
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  formRef?.updateSchema([{
    field: 'memberID',
    component: 'Select',
    componentProps: {
      showSearch: true,
      filterOption: false,
      allowClear: true,
      options: [],
      loading: false,
      placeholder: '請選擇或輸入會員',
      onSearch: onMemberSearch,
      onChange: (val: string) => {
        sMemberID.value = val || '';
      },
    },
  }]);
};

/* ================= DataRequest ================= */

const loadTableData = async (params: LoadDataParams & any) => {
  console.log('loadTableData called with params:', params);
  const { agentID, memberID, tokenID, type, date } = params;

  if (!selectedMasterAgent.value) {
    message.error('請先選擇站長');
    return { items: [], meta: { totalItems: 0 } };
  }
  if (!agentID) {
    message.error('代理不可空白');
    return { items: [], meta: { totalItems: 0 } };
  }
  if (!date?.[0] || !date?.[1]) {
    message.error('時間不可空白');
    return { items: [], meta: { totalItems: 0 } };
  }

  // 確保 date 是 dayjs 物件
  const dateStart = dayjs(date[0]);
  const dateEnd = dayjs(date[1]);

  if (!dateStart.isValid() || !dateEnd.isValid()) {
    message.error('時間格式錯誤');
    return { items: [], meta: { totalItems: 0 } };
  }

  const query: QueryTokenRecordsParams = {
    agentID,
    page: 1,
    limit: 1000,
    memberID: sMemberID.value || memberID,
    tokenID,
    type,
    date: [
      dateStart.format('YYYY-MM-DD HH:mm:ss'),
      dateEnd.format('YYYY-MM-DD HH:mm:ss'),
    ],
  };

  console.log('queryTokenRecords with query:', query);
  try {
    const res = await queryTokenRecords(query);
    console.log('queryTokenRecords response:', res);
    const items = res?.records || [];

    // =========================
    // STEP B: 資料合併（批量優先、精準為主）
    // =========================
    // 從 items 中抽取 accounts（去重）
    const accounts = Array.from(
      new Set(
        items
          .map((item: any) => {
            const memberID = String(item.memberID || '');
            return memberID.split('@')[0];
          })
          .filter(Boolean),
      ),
    );

    // 建立 mapping
    let accountInfoMap: Record<string, { id?: string; nickName?: string }> = {};
    let accountOnlyMap: Record<string, { id?: string; nickName?: string }> = {};

    if (accounts.length && selectedMasterAgent.value) {
      try {
        const baseRes = await queryAccountBaseInfo({
          masterAgent: selectedMasterAgent.value,
          accounts,
        });
        const baseListRaw = baseRes as { data?: AccountBaseInfoItem[] } | AccountBaseInfoItem[] | undefined;
        const baseList = Array.isArray(baseListRaw) ? baseListRaw : baseListRaw?.data ?? [];

        // accountInfoMap: key = `${account}@${agentID}`（完整匹配）
        accountInfoMap = baseList.reduce((acc, cur) => {
          const key = `${cur.account}@${cur.agentID}`;
          acc[key] = { id: cur.id, nickName: cur.nickName };
          return acc;
        }, {} as Record<string, { id?: string; nickName?: string }>);

        // accountOnlyMap: key = `account`（fallback）
        accountOnlyMap = baseList.reduce((acc, cur) => {
          acc[cur.account] = { id: cur.id, nickName: cur.nickName };
          return acc;
        }, {} as Record<string, { id?: string; nickName?: string }>);
      }
      catch (error) {
        console.warn('queryAccountBaseInfo failed:', error);
        // 查詢失敗時，accountInfoMap 和 accountOnlyMap 保持為空物件
      }
    }

    // merge 回 items
    const merged = items.map((item: any) => {
      const memberID = String(item.memberID || '');
      const info = accountInfoMap[memberID] || accountOnlyMap[memberID.split('@')[0]] || {};
      return {
        ...item,
        accountID: info.id || '',
        nickName: info.nickName || '',
      };
    });

    message.success('查詢完成');
    return {
      items: merged,
      meta: { totalItems: merged.length },
    };
  }
  catch (error) {
    console.error('queryTokenRecords error:', error);
    message.error('查詢失敗');
    return { items: [], meta: { totalItems: 0 } };
  }
};

/* ================= Lifecycle ================= */

watch(contextVersion, async () => {
  await loadAgents();
  await loadTokens();
});

onMounted(async () => {
  await loadAgents();
  await loadTokens();
  await initMemberSchema();

  // 確保表單值已正確設置
  await nextTick();
  const formRef = tableInstance.getSearchFormRef();
  if (formRef) {
    const values = formRef.getFieldsValue();
    console.log('Form values after init:', values);
  }
});
</script>

<template>
  <DynamicTable
    :columns="finalColumns"
    :form-props="{ schemas: formSchemas }"
    :data-request="loadTableData"
    :scroll="{ x: tableScrollX }"
    :immediate="false"
  >
    <template #headerTitle>
      <div style="display: flex; align-items: center; gap: 8px">
        <span>代幣記錄</span>
        <Tag :color="searchModeConfig.color" style="margin: 0">
          SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
        </Tag>
      </div>
    </template>
  </DynamicTable>
</template>
