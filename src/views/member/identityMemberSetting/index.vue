<script setup lang="ts">
import type { MemberIdentityItem } from '@/api/backend/activitySystem';
import type { AccountBaseInfoItem, FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal, Tag } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, h, inject, ref, watch } from 'vue';
import {
  getMemberActivity,
  IdentityType,

  queryMemberIdentities,
  removeMemberIdentity,
  setMemberIdentity,
} from '@/api/backend/activitySystem';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';

import { useTable } from '@/components/core/dynamic-table';

import { useI18n } from '@/hooks/useI18n';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

defineOptions({
  name: 'IdentityMemberSetting',
});

const i18n = useI18n('routes.member.identityMemberSettingPage');
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

// 擴展資料類型，包含會員顯示資訊
interface ExtendedMemberIdentityItem extends MemberIdentityItem {
  accountID?: string;
  nickName?: string;
}

const tableLoading = ref(false);
const currentList = ref<ExtendedMemberIdentityItem[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

const unselectableSet = computed(() => new Set(currentList.value.map(i => String(i.memberID ?? ''))));

const identityOptions = computed(() => [
  { label: t('identityTypes.fraudulentOrRefund'), value: IdentityType.FRAUDULENT_OR_REFUND },
  { label: t('identityTypes.lowCredibility'), value: IdentityType.LOW_CREDIBILITY },
]);

const formatIdentityLabel = (identity: unknown) => {
  const n = Number(identity);
  if (n === IdentityType.FRAUDULENT_OR_REFUND) {
    return t('identityTypes.fraudulentOrRefund');
  }
  if (n === IdentityType.LOW_CREDIBILITY) {
    return t('identityTypes.lowCredibility');
  }
  return String(identity ?? '');
};

// STEP C: 使用 label-in-value 結構
interface MemberFormValue {
  value: string;
  label: string;
}

const form = ref<{ memberID: MemberFormValue | string; identity: IdentityType | undefined; nowIdentityLabel: string }>({
  memberID: '',
  identity: IdentityType.FRAUDULENT_OR_REFUND,
  nowIdentityLabel: '',
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
    // 取得當前表單的 memberID 值（處理 label-in-value 結構）
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
  // 使用從 LayoutBreadcrumb provide 取得的站長值
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await queryMemberIdentities({ masterAgent });
    const items = Array.isArray(list) ? list : [];

    // STEP B: 合併會員資料
    // 依 memberID 批次取得帳戶ID與暱稱（對齊 fixedVipMemberSetting 方式）
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

    // 合併資料
    const extendedItems: ExtendedMemberIdentityItem[] = items.map((item) => {
      const info = accountInfoMap[item.memberID] || accountOnlyMap[String(item.memberID || '').split('@')[0]] || {};
      return {
        ...item,
        accountID: info.id || '',
        nickName: info.nickName || '',
      };
    });

    currentList.value = extendedItems;
    return { items: extendedItems, meta: { totalItems: extendedItems.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

const baseColumns = ref<TableColumn<ExtendedMemberIdentityItem>[]>([
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
  {
    title: t('columns.identity'),
    dataIndex: 'identity',
    width: 200,
    hideInSearch: true,
    customRender: ({ text }) => formatIdentityLabel(text),
  },
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
    actions: ({ record }: { record: ExtendedMemberIdentityItem }) => [
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
// 使用類型斷言，因為 useTableConfig 期望 TableColumnItem，但我們使用的是 TableColumn<MemberIdentityItem>
// 兩者在運行時結構相同，只是類型定義不同
// @ts-expect-error - useTableConfig 期望 TableColumnItem，但我們使用的是 TableColumn<MemberIdentityItem>，運行時結構相同
const tableConfig = useTableConfig(baseColumns);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
const columns = computed<TableColumn<ExtendedMemberIdentityItem>[]>(() => {
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
    const processedCol: TableColumn<ExtendedMemberIdentityItem> = {
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

  type ModalMode = 'add' | 'edit';

const modalOpen = ref(false);
const modalSubmitting = ref(false);
const modalMode = ref<ModalMode>('add');
const originalIdentity = ref<number | undefined>(undefined);
// STEP D: 編輯準備狀態，確保 Modal 開啟時已有正確的 label
const isEditReady = ref(false);

const modalTitle = computed(() => (modalMode.value === 'edit' ? t('titleEdit') : t('titleAdd')));

const fetchNowIdentity = async (memberID: string) => {
  if (!memberID) {
    form.value.nowIdentityLabel = '';
    return;
  }
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    form.value.nowIdentityLabel = '';
    return;
  }
  try {
    const res = await getMemberActivity({ memberID });
    form.value.nowIdentityLabel = res?.identity !== undefined ? formatIdentityLabel(res.identity) : '';
  }
  catch {
    form.value.nowIdentityLabel = '';
  }
};

async function openModal(mode: ModalMode, record?: ExtendedMemberIdentityItem) {
  modalMode.value = mode;
  modalSubmitting.value = false;
  isEditReady.value = false;

  form.value = {
    memberID: '',
    identity: IdentityType.FRAUDULENT_OR_REFUND,
    nowIdentityLabel: '',
  };
  originalIdentity.value = undefined;

  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  if (mode === 'edit' && record) {
    // STEP D: 編輯模式下，先 preload 會員顯示資料
    const memberID = String(record.memberID ?? '');
    form.value.identity = Number(record.identity) as IdentityType;
    originalIdentity.value = Number(record.identity);

    // =========================
    // STEP 1: Context 可用性判斷
    // =========================
    // 1. 編輯入口來自資料表 row（非新建/非空白）✓ - mode === 'edit' && record 已滿足
    // 2. row/context 已包含可直接顯示的會員資訊（accountID + nickName 或等價欄位）
    const hasAccountID = Boolean(record.accountID);
    /**
     * 必須有 accountID 才能使用 Context-first
     */
    const hasDisplayableContext = hasAccountID;
    // 3. 編輯 Modal 中「會員」欄位為唯讀（不可切換）✓ - :disabled="modalMode === 'edit'" 已滿足
    const isMemberFieldReadonly = true;

    const canUseContextFirst = hasDisplayableContext && isMemberFieldReadonly;

    if (canUseContextFirst) {
      // =========================
      // CASE A: Context 可用 - Context-first 流程
      // =========================
      // 不呼叫任何會員查詢 API
      // 直接由 row/context 重組會員 Select option
      const accountID = record.accountID || '';
      const nickName = record.nickName || '';
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
      form.value.memberID = {
        value: memberID,
        label: displayLabel,
      };
      isEditReady.value = true;
      await fetchNowIdentity(memberID);
    }
    else {
      // =========================
      // CASE B: Context 不可用 - 退回 ARCH-02（Base）流程
      // =========================
      // 完全退回 ARCH-02（Base）流程：preload queryAccountBaseInfo / fallback fuzzyQueryUser
      const masterAgent = String(selectedMasterAgent.value || '').trim();
      if (masterAgent) {
        try {
          // 提取 account 部分進行查詢
          const account = memberID.split('@')[0];
          const memberRes = await fuzzyQueryUser({
            masterAgent,
            queryText: account,
            limit: 100,
          });
          const memberList = Array.isArray(memberRes) ? memberRes : [];
          const matchedMember = memberList.find((m: FuzzyQueryUserItem) =>
            `${m.account}@${m.agentID}` === memberID,
          );

          if (matchedMember) {
            form.value.memberID = {
              value: memberID,
              label: `${matchedMember.accountID} - ${matchedMember.nickName}`,
            };
            memberOptions.value = [{
              label: `${matchedMember.accountID} - ${matchedMember.nickName}`,
              value: memberID,
              disabled: false,
            }];
          }
          else {
            // 如果查詢不到，使用 memberID 作為 fallback
            form.value.memberID = {
              value: memberID,
              label: memberID,
            };
            memberOptions.value = [{
              label: memberID,
              value: memberID,
              disabled: false,
            }];
          }
        }
        catch {
          // 查詢失敗時使用 memberID 作為 fallback
          form.value.memberID = {
            value: memberID,
            label: memberID,
          };
          memberOptions.value = [{
            label: memberID,
            value: memberID,
            disabled: false,
          }];
        }
      }
      else {
        // 沒有 masterAgent 時使用 memberID 作為 fallback
        form.value.memberID = {
          value: memberID,
          label: memberID,
        };
        memberOptions.value = [{
          label: memberID,
          value: memberID,
          disabled: false,
        }];
      }

      isEditReady.value = true;
      await fetchNowIdentity(memberID);
    }
  }
  else {
    // 新增模式下直接開啟
    isEditReady.value = true;
  }

  // 確認準備完成後才開啟 Modal
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
  // STEP C: 從 label-in-value 結構中提取 value
  const memberIDValue = typeof form.value.memberID === 'string'
    ? form.value.memberID
    : form.value.memberID?.value || '';
  if (!memberIDValue) {
    throw new Error(t('notify.required'));
  }
  const identity = Number(form.value.identity);
  if (!Number.isFinite(identity)) {
    throw new TypeError(t('notify.required'));
  }
};

const submitModal = async () => {
  try {
    validateForm();
    modalSubmitting.value = true;

    // STEP C: 從 label-in-value 結構中提取 value（memberID）
    const memberID = typeof form.value.memberID === 'string'
      ? form.value.memberID
      : form.value.memberID?.value || '';
    const identity = Number(form.value.identity) as IdentityType;

    // 對齊 Vue2：編輯時先移除舊身分再設定新身分
    if (modalMode.value === 'edit' && Number.isFinite(Number(originalIdentity.value))) {
      await removeMemberIdentity({ memberID, identity: Number(originalIdentity.value) });
    }
    await setMemberIdentity({ memberID, type: identity });

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

async function onDelete(record: ExtendedMemberIdentityItem) {
  const masterAgent = String(selectedMasterAgent.value || '').trim();
  if (!masterAgent) {
    message.error(t('notify.masterAgentRequired'));
    return;
  }
  const memberID = String(record.memberID ?? '');
  const identity = Number(record.identity);

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
      try {
        await removeMemberIdentity({ memberID, identity });
        message.success(t('deleteSuccess'));
        tableInstance?.reload?.();
      }
      catch (e: any) {
        message.error(e?.message || t('saveFailed'));
      }
    },
  });
}

/**
 * 監聽 contextVersion 變更，當站長切換時自動重置並刷新表格
 */
watch(
  () => contextVersion.value,
  () => {
    // masterAgent 變更時，清掉 modal 內會員選單（避免跨總代殘留）
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    // 清空表格資料並自動重新載入
    tableInstance?.reload(true);
  },
);

watch(
  () => form.value.memberID,
  (v) => {
    // member 變更時更新「目前身分」
    if (!v) {
      form.value.nowIdentityLabel = '';
      return;
    }
    // 處理 label-in-value 結構
    const memberIDValue = typeof v === 'string' ? v : v?.value || '';
    if (!memberIDValue) {
      form.value.nowIdentityLabel = '';
      return;
    }
    fetchNowIdentity(memberIDValue);
  },
);

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
</script>

<template>
  <div class="agent-page">
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
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="modalSubmitting"
      :mask-closable="false"
      :destroy-on-close="true"
      width="720px"
      @ok="submitModal"
      @cancel="closeModal"
    >
      <!-- STEP D: 使用 v-if 確保編輯時資料已準備完成 -->
      <a-form v-if="isEditReady || modalMode === 'add'" layout="vertical">
        <a-form-item :label="t('form.member')" required>
          <!-- STEP C: 使用 label-in-value -->
          <a-select
            v-model:value="form.memberID"
            show-search
            :filter-option="false"
            :options="memberOptions"
            :loading="memberLoading"
            :disabled="modalMode === 'edit'"
            :placeholder="t('form.memberPlaceholder')"
            style="width: 100%"
            label-in-value
            allow-clear
            @search="onMemberSearch"
            @popup-scroll="onMemberPopupScroll"
          />
        </a-form-item>

        <a-form-item :label="t('form.nowIdentity')">
          <a-input :value="form.nowIdentityLabel" disabled />
        </a-form-item>

        <a-form-item :label="t('form.identity')" required>
          <a-radio-group v-model:value="form.identity" :options="identityOptions" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
