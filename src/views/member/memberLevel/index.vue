<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';

import { message } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, onMounted, ref, watch } from 'vue';

import { fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { getMemberLevelInfo, setMemberLevel } from '@/api/backend/member/levelServer';
import AdminAccountSelector from '@/components/AdminAccountSelector/AdminAccountSelector.vue';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'MemberLevel',
});

const i18n = useI18n('routes.member.memberLevelPage');
const t = i18n.t;
const userStore = useUserStore();

const hasPermission = computed(() => userStore.level <= 3);

const masterAgent = ref<string>('');

// =========================
// Form
// =========================

const loading = ref(false);
const submitting = ref(false);

const form = ref<{
  memberID: string;
  nickName: string;
  level: string;
  changeLevel: number | undefined;
}>({
  memberID: '',
  nickName: '',
  level: '',
  changeLevel: undefined,
});

// =========================
// Member remote options（對齊其他 member 設定頁）
// =========================

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

const resetMemberSelector = () => {
  form.value.memberID = '';
  form.value.nickName = '';
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
};

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    return {
      raw: item,
      value,
      label: `${item.accountID} - ${item.nickName}`,
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
  if (!memberLastQueryText.value || !memberLastAccountID.value) {
    return;
  }
  await fetchMemberOptions(memberLastQueryText.value, true);
};

const onMemberChanged = (val: string) => {
  form.value.memberID = val;
  const matched = memberOptions.value.find(o => o.value === val);
  form.value.nickName = matched?.label || '';
};

watch(
  () => masterAgent.value,
  () => {
    resetMemberSelector();
    form.value.level = '';
    form.value.changeLevel = undefined;
  },
);

const isPositiveInt = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0;

const search = async () => {
  if (!form.value.memberID) {
    message.error(t('notify.memberRequired'));
    return;
  }
  loading.value = true;
  try {
    const list = await getMemberLevelInfo({ memberID: [form.value.memberID] });
    if (Array.isArray(list) && list.length > 0) {
      form.value.level = String(list[0].level ?? '');
    }
    else {
      form.value.level = '';
    }
  }
  finally {
    loading.value = false;
  }
};

const submit = async () => {
  if (!form.value.memberID) {
    message.error(t('notify.memberRequired'));
    return;
  }
  if (!isPositiveInt(form.value.changeLevel)) {
    message.error(t('notify.changeLevel'));
    return;
  }

  submitting.value = true;
  try {
    await setMemberLevel({
      memberID: form.value.memberID,
      level: Number(form.value.changeLevel),
    });
    form.value.changeLevel = undefined;
    await search();
    message.success(t('notify.success'));
  }
  catch {
    message.error(t('notify.failed'));
  }
  finally {
    submitting.value = false;
  }
};

onMounted(() => {
  // 對齊 Vue2：level>=4 直接鎖定總代理（但此頁本身限制 <=3）
  if (userStore.level >= 4) {
    masterAgent.value = userStore.masterAgent;
  }
});
</script>

<template>
  <div class="member-level-page">
    <a-result
      v-if="!hasPermission"
      status="403"
      :title="t('noPermission.title')"
      :sub-title="t('noPermission.subTitle')"
    />

    <a-card v-else :title="t('title')" :bordered="false" class="member-level-card">
      <a-form layout="vertical" class="member-level-form">
        <!-- 總代理 -->
        <div class="form-row">
          <a-form-item label="總代理" required class="form-item">
            <template v-if="userStore.level < 4">
              <AdminAccountSelector
                v-model="masterAgent"
                value-type="account"
                :auto-select-first="true"
                class="w-240"
                :placeholder="t('filters.masterAgentPlaceholder')"
              />
            </template>
            <template v-else>
              <a-input :value="masterAgent" class="w-240" disabled />
            </template>
          </a-form-item>
        </div>

        <!-- 查詢帳戶（同一行：左輸入、右按鈕） -->
        <div class="form-row">
          <a-form-item label="查詢帳戶" required class="form-item">
            <div class="inline-control">
              <a-select
                v-model:value="form.memberID"
                show-search
                :filter-option="false"
                :options="memberOptions"
                :loading="memberLoading"
                :disabled="!masterAgent"
                :placeholder="t('form.memberPlaceholder')"
                class="inline-flex-1"
                allow-clear
                @search="onMemberSearch"
                @popup-scroll="onMemberPopupScroll"
                @change="onMemberChanged"
              />

              <a-button
                type="primary"
                :disabled="!form.memberID || loading"
                :loading="loading"
                class="inline-btn"
                @click="search"
              >
                {{ t('search') }}
              </a-button>
            </div>
          </a-form-item>
        </div>

        <!-- 顯示欄位（唯讀） -->
        <div class="form-row form-row-two">
          <a-form-item :label="t('form.nickName')" class="form-item">
            <a-input :value="form.nickName" readonly />
          </a-form-item>

          <a-form-item :label="t('form.level')" class="form-item">
            <a-input :value="form.level" readonly />
          </a-form-item>
        </div>

        <!-- 變更等級（同一行：左輸入、右按鈕） -->
        <div class="form-row">
          <a-form-item :label="t('form.changeLevel')" required class="form-item">
            <div class="inline-control">
              <a-input-number
                v-model:value="form.changeLevel"
                :min="1"
                :precision="0"
                :placeholder="t('form.changeLevelPlaceholder')"
                class="level-input"
              />
              <a-button type="primary" :disabled="submitting" :loading="submitting" class="inline-btn" @click="submit">
                {{ t('confirm') }}
              </a-button>
            </div>
          </a-form-item>
        </div>
      </a-form>
    </a-card>
  </div>
</template>

<style scoped>
.member-level-page {
  display: flex;
  justify-content: flex-start;
}

.member-level-card {
  width: 100%;
  max-width: 760px;
}

.member-level-form {
  width: 100%;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.form-row + .form-row {
  margin-top: 8px;
}

.form-row-two .form-item {
  flex: 1 1 260px;
  min-width: 260px;
}

.form-item {
  flex: 1 1 auto;
  min-width: 260px;
  margin-bottom: 0;
}

.w-240 {
  width: 240px;
}

.inline-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.inline-flex-1 {
  flex: 1 1 auto;
  min-width: 240px;
}

.level-input {
  width: 160px;
}

/* 修正按鈕過大：高度與輸入一致，不撐高整列 */
.inline-btn {
  height: 32px;
  padding: 0 14px;
}

.inline-control :deep(.ant-select-selector) {
  height: 32px;
  align-items: center;
}

.inline-control :deep(.ant-select-selection-search-input) {
  height: 32px;
}

.inline-control :deep(.ant-input-number) {
  height: 32px;
}

.inline-control :deep(.ant-input-number-input) {
  height: 30px;
}
</style>

