<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { UserPunishDetailItem } from '@/api/backend/adminSystem/suspension';
import type { LoadDataParams, TableColumn } from '@/components/core/dynamic-table';

import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';

import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { addPunish, deletePunish, EPunishStatus, getPunishDetail } from '@/api/backend/adminSystem/suspension';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'SuspensionList',
});

const i18n = useI18n('routes.member.suspensionListPage');
const t = i18n.t;

const userStore = useUserStore();
const masterAgent = ref<string>('');
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

const loadTableData = async (_params: LoadDataParams) => {
  if (!masterAgent.value) {
    currentList.value = [];
    return { items: [], meta: { totalItems: 0 } };
  }

  tableLoading.value = true;
  try {
    const list = await getPunishDetail({ masterAgent: masterAgent.value });
    const items = Array.isArray(list) ? list : [];
    currentList.value = items;
    return { items, meta: { totalItems: items.length } };
  }
  finally {
    tableLoading.value = false;
  }
};

const columns = ref<TableColumn<UserPunishDetailItem>[]>([
  { title: t('columns.id'), dataIndex: 'id', width: 120, hideInSearch: true },
  { title: t('columns.accountID'), dataIndex: 'accountID', width: 160, hideInSearch: true },
  { title: t('columns.nickName'), dataIndex: 'nickName', width: 180, hideInSearch: true },
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
    width: 200,
    hideInSearch: true,
    customRender: ({ text }) => {
      if (!text) {
        return '';
      }
      const d = dayjs(text as any);
      return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(text);
    },
  },
  { title: t('columns.punishReason'), dataIndex: 'punishReason', width: 260, hideInSearch: true },
  {
    title: t('columns.operation'),
    dataIndex: 'ACTION',
    width: 140,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
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
  if (!masterAgent.value) {
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

    await addPunish({
      masterAgent: masterAgent.value,
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
  if (!masterAgent.value) {
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
      await deletePunish({ masterAgent: masterAgent.value, id });
      message.success(t('deleteSuccess'));
      tableInstance?.reload?.();
    },
  });
}

watch(
  () => masterAgent.value,
  () => {
    memberOptions.value = [];
    memberLastQueryText.value = '';
    memberLastAccountID.value = '';
    tableInstance?.reload?.();
  },
);

onMounted(() => {
  // 對齊既有頁：level>=4 直接鎖定總代理
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
});
</script>

<template>
  <div>
    <DynamicTable
      row-key="id"
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

          <a-button
            v-if="canAdd"
            type="primary"
            :disabled="!masterAgent || tableLoading"
            @click="openModal"
          >
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

