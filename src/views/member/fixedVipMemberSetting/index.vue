<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { FixedVipMemberInfo, VipSetting } from '@/api/backend/member/vipServer';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';
import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import VipApi from '@/api/backend/member/vipServer';

import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'FixedVipMemberSetting',
});

const i18n = useI18n('routes.member.fixedVipMemberSettingPage');
const t = i18n.t;
const userStore = useUserStore();

const masterAgent = ref<string>('');
const tableLoading = ref(false);
const currentList = ref<FixedVipMemberInfo[]>([]);
const vipList = ref<VipSetting[]>([]);

const [DynamicTable, tableInstance] = useTable({
  search: false,
});

const unselectableSet = computed(() => new Set(currentList.value.map(i => String(i.memberID ?? ''))));

const vipMap = computed(() => {
  const m = new Map<number, string>();
  (vipList.value || []).forEach(v => m.set(Number(v.vipLevel), v.name));
  return m;
});

const vipOptions = computed(() => (vipList.value || []).map(v => ({ label: v.name, value: Number(v.vipLevel) })));

const formatVipName = (vipLevel: unknown) => {
  const n = Number(vipLevel);
  if (!Number.isFinite(n)) {
    return '';
  }
  return vipMap.value.get(n) || String(vipLevel ?? '');
};

const form = ref<{ memberID: string; vip: number | undefined }>({
  memberID: '',
  vip: undefined,
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

const fetchVipList = async () => {
  if (!masterAgent.value) {
    vipList.value = [];
    return;
  }
  const list = await VipApi.listByMasterAgent({ masterAgent: masterAgent.value });
  vipList.value = Array.isArray(list) ? list : [];
};

const loadTableData = async (_params: LoadDataParams) => {
  if (!masterAgent.value) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await VipApi.getFixedVipMemberList({ masterAgent: masterAgent.value });
    const items = Array.isArray(list) ? list : [];
    currentList.value = items;
    return { items, meta: { totalItems: items.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

const columns = ref<TableColumn<FixedVipMemberInfo>[]>([
  { title: 'ID', dataIndex: 'id', width: 120, hideInSearch: true },
  { title: t('columns.memberID'), dataIndex: 'memberID', hideInSearch: true },
  {
    title: t('columns.vip'),
    dataIndex: 'vip',
    width: 200,
    hideInSearch: true,
    customRender: ({ text }) => formatVipName(text),
  },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 200,
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

const modalTitle = computed(() => (modalMode.value === 'edit' ? t('titleEdit') : t('titleAdd')));

function openModal(mode: ModalMode, record?: FixedVipMemberInfo) {
  modalMode.value = mode;
  modalOpen.value = true;
  modalSubmitting.value = false;

  form.value = { memberID: '', vip: undefined };
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';

  if (mode === 'edit' && record) {
    form.value.memberID = String(record.memberID ?? '');
    form.value.vip = record.vip === undefined ? undefined : Number(record.vip);
    // 編輯時確保 select 能顯示（避免沒搜尋時空白）
    memberOptions.value = [{ label: form.value.memberID, value: form.value.memberID, disabled: false }];
  }
}

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
  const vip = Number(form.value.vip);
  if (!Number.isFinite(vip)) {
    throw new TypeError(t('notify.required'));
  }
};

const submitModal = async () => {
  try {
    validateForm();
    modalSubmitting.value = true;

    await VipApi.setFixedVipMember({
      masterAgent: masterAgent.value,
      memberID: form.value.memberID,
      vip: Number(form.value.vip),
    });

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

async function onDelete(record: FixedVipMemberInfo) {
  if (!masterAgent.value) {
    return;
  }
  const memberID = String(record.memberID ?? '');
  Modal.confirm({
    title: t('confirmDelete'),
    content: `${t('confirmDeleteContent')} ${memberID}`,
    okText: t('delete'),
    okType: 'danger',
    cancelText: t('cancel'),
    async onOk() {
      await VipApi.removeFixedVipMember({ memberID });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
}

watch(
  () => masterAgent.value,
  async () => {
    // masterAgent 變更時，清掉 modal 內會員選單（避免跨總代殘留）
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    await fetchVipList();
    tableInstance?.reload?.();
  },
);

onMounted(async () => {
  // 對齊 Vue2：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
  if (masterAgent.value) {
    await fetchVipList();
  }
});
</script>

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

        <a-form-item :label="t('form.vip')" required>
          <a-select
            v-model:value="form.vip"
            :options="vipOptions"
            :placeholder="t('form.vipPlaceholder')"
            style="width: 100%"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

