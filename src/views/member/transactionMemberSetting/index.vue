<template>
  <div>
    <DynamicTable
      row-key="memberID"
      :header-title="t('title')"
      :data-request="loadTableData"
      :columns="columns"
      :pagination="false"
    >
      <template #toolbar>
        <a-space>
          <template v-if="userStore.level < 4">
            <AdminAccountSelector
              v-model="masterAgent"
              value-type="account"
              :auto-select-first="true"
              style="width: 240px"
              :placeholder="t('filters.masterAgentPlaceholder')"
            />
          </template>
          <template v-else>
            <a-input :value="masterAgent" style="width: 240px" disabled />
          </template>

          <a-button type="primary" :disabled="!masterAgent || tableLoading" @click="openModal('add')">
            {{ t('add') }}
          </a-button>
        </a-space>
      </template>
    </DynamicTable>

    <a-modal
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

        <a-form-item :label="t('form.serviceTariff')" required>
          <a-input-number v-model:value="form.serviceTariff" :min="0" :max="100" :step="1" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { debounce } from 'lodash-es';

import { useTable } from '@/components/core/dynamic-table';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';

import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { fuzzyQueryUser, type FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import {
  queryTransactionMemberSettings,
  removeTransactionMemberSetting,
  setTransactionMemberSetting,
  type TransactionMemberSettingItem,
} from '@/api/backend/transactionSystem';

defineOptions({
  name: 'TransactionMemberSetting',
});

const { t } = useI18n('routes.member.transactionMemberSettingPage');
const userStore = useUserStore();

const masterAgent = ref<string>('');
const tableLoading = ref(false);
const currentList = ref<TransactionMemberSettingItem[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

// =========================
// Member remote options
// =========================

type MemberOption = { label: string; value: string; disabled?: boolean; raw?: FuzzyQueryUserItem };

const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

const unselectableSet = computed(() => new Set(currentList.value.map((i) => i.memberID)));

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

  if (!masterAgent.value) {
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
      masterAgent: masterAgent.value,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });
    const list = Array.isArray(res) ? res : [];
    const mapped = mapMemberOptions(list);
    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  } finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => fetchMemberOptions(text, false), 250);

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom) return;
  if (!memberLastQueryText.value) return;
  if (!memberLastAccountID.value) return;
  await fetchMemberOptions(memberLastQueryText.value, true);
};

// =========================
// Table + CRUD
// =========================

const loadTableData = async (_params: LoadDataParams) => {
  if (!masterAgent.value) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await queryTransactionMemberSettings({ masterAgent: masterAgent.value });
    const items = Array.isArray(list) ? list : [];
    currentList.value = items;
    return { items, meta: { totalItems: items.length } };
  } finally {
    tableLoading.value = false;
  }
};

const formatPercent = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${Math.round(n * 10000) / 100}%`;
};

const columns = ref<TableColumn<TransactionMemberSettingItem>[]>([
  { title: 'ID', dataIndex: 'id', width: 120, hideInSearch: true },
  { title: t('columns.memberID'), dataIndex: 'memberID', hideInSearch: true },
  {
    title: t('columns.serviceTariff'),
    dataIndex: 'serviceTariff',
    width: 160,
    hideInSearch: true,
    customRender: ({ text }) => formatPercent(text),
  },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 180,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
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

type ModalMode = 'add' | 'edit';

const modalOpen = ref(false);
const modalSubmitting = ref(false);
const modalMode = ref<ModalMode>('add');

const form = ref<{ memberID: string; serviceTariff: number | undefined }>({
  memberID: '',
  serviceTariff: undefined,
});

const modalTitle = computed(() => (modalMode.value === 'edit' ? t('titleEdit') : t('titleAdd')));

const openModal = (mode: ModalMode, record?: TransactionMemberSettingItem) => {
  modalMode.value = mode;
  modalOpen.value = true;
  modalSubmitting.value = false;

  form.value = { memberID: '', serviceTariff: undefined };
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  if (mode === 'edit' && record) {
    form.value.memberID = String(record.memberID ?? '');
    form.value.serviceTariff = Math.round(Number(record.serviceTariff || 0) * 100);
    // 確保編輯時有顯示選項 label（即使沒有再次搜尋）
    memberOptions.value = [{ label: form.value.memberID, value: form.value.memberID, disabled: false }];
  }
};

const closeModal = () => {
  modalOpen.value = false;
};

const validateForm = () => {
  if (!masterAgent.value) {
    throw new Error(t('notify.masterAgentRequired'));
  }
  if (!form.value.memberID) {
    throw new Error(t('notify.required'));
  }
  const n = Number(form.value.serviceTariff);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new Error(t('notify.serviceTariff'));
  }
};

const submitModal = async () => {
  try {
    validateForm();
    modalSubmitting.value = true;

    const percent = Number(form.value.serviceTariff || 0);
    await setTransactionMemberSetting({
      masterAgent: masterAgent.value,
      memberID: form.value.memberID,
      serviceTariff: percent > 0 ? percent / 100 : 0,
    });

    message.success(modalMode.value === 'edit' ? t('editSuccess') : t('addSuccess'));
    closeModal();
    tableInstance?.reload?.();
  } catch (e: any) {
    message.error(e?.message || t('saveFailed'));
  } finally {
    modalSubmitting.value = false;
  }
};

const onDelete = async (record: TransactionMemberSettingItem) => {
  if (!masterAgent.value) return;
  Modal.confirm({
    title: t('confirmDelete'),
    content: `${t('confirmDeleteContent')} ${record.memberID}`,
    okText: t('delete'),
    okType: 'danger',
    cancelText: t('cancel'),
    async onOk() {
      await removeTransactionMemberSetting({
        masterAgent: masterAgent.value,
        memberID: record.memberID,
      });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
};

watch(
  () => masterAgent.value,
  () => {
    // masterAgent 變更時，清掉 modal 內會員選單（避免跨總代殘留）
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    tableInstance?.reload?.();
  },
);

onMounted(async () => {
  // 對齊 Vue2：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
});
</script>

