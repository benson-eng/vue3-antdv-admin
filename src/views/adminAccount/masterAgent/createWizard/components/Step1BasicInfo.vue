<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import RolesApi from '@/api/backend/adminAccount/roles';

defineOptions({ name: 'Step1BasicInfo' });

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:roles': [value: number[]];
}>();

// [DEBUG] 印出接收到的 props（特別是 formModel）
console.log('[Step1BasicInfo][DEBUG] 接收到的 props:', props);
console.log('[Step1BasicInfo][DEBUG] formModel 內容:', props.formModel);

interface Props {
  formModel: {
    accountType: 'masterAgent' | 'masterAgentX' | undefined;
    account: string;
    name: string;
    website: string;
    currencyCode: string;
    apiDomain: string;
    serviceEmail: string;
    onePhoneNumberToAccountCounts: number;
    roles: number[];
  };
  isEdit?: boolean;
  level?: number;
  /** 編輯模式下的完整角色對象數組（用於檢查不在清單中的角色） */
  editRecordRoles?: Array<{ id: number; name: string; [key: string]: any }>;
  /** 是否為唯讀模式（Level 4 檢視模式） */
  isReadonly?: boolean;
}

const formRef = ref<FormInstance>();
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
const loadingRoles = ref(false);

/**
 * 本地表單副本（用於 readonly 模式下隔離寫入）
 * 在 readonly 模式下，所有變更僅影響 localForm，不會寫回父層
 * 在非 readonly 模式下，變更會同步回父層 formModel
 */
const localForm = reactive<{
  accountType: 'masterAgent' | 'masterAgentX' | undefined;
  account: string;
  name: string;
  website: string;
  currencyCode: string;
  apiDomain: string;
  serviceEmail: string;
  onePhoneNumberToAccountCounts: number;
  roles: number[];
}>({
  accountType: props.formModel.accountType,
  account: props.formModel.account,
  name: props.formModel.name,
  website: props.formModel.website,
  currencyCode: props.formModel.currencyCode,
  apiDomain: props.formModel.apiDomain,
  serviceEmail: props.formModel.serviceEmail,
  onePhoneNumberToAccountCounts: props.formModel.onePhoneNumberToAccountCounts,
  roles: [...props.formModel.roles],
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  // 同步所有欄位到父層
  Object.assign(props.formModel, {
    account: localForm.account,
    name: localForm.name,
    website: localForm.website,
    currencyCode: localForm.currencyCode,
    apiDomain: localForm.apiDomain,
    serviceEmail: localForm.serviceEmail,
    onePhoneNumberToAccountCounts: localForm.onePhoneNumberToAccountCounts,
  });
  // roles 透過 emit 更新
  emit('update:roles', [...localForm.roles]);
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.accountType = props.formModel.accountType;
  localForm.account = props.formModel.account;
  localForm.name = props.formModel.name;
  localForm.website = props.formModel.website;
  localForm.currencyCode = props.formModel.currencyCode;
  localForm.apiDomain = props.formModel.apiDomain;
  localForm.serviceEmail = props.formModel.serviceEmail;
  localForm.onePhoneNumberToAccountCounts = props.formModel.onePhoneNumberToAccountCounts;
  localForm.roles = [...props.formModel.roles];
};

// 監聽父層 formModel 變化，同步到 localForm（僅在 readonly 模式下，因為非 readonly 模式下是單向的）
watch(
  () => props.formModel,
  () => {
    if (props.isReadonly) {
      syncFromParent();
    }
  },
  { deep: true },
);

// 在非 readonly 模式下，監聽 localForm 變化並同步回父層
watch(
  () => [
    localForm.account,
    localForm.name,
    localForm.website,
    localForm.currencyCode,
    localForm.apiDomain,
    localForm.serviceEmail,
    localForm.onePhoneNumberToAccountCounts,
  ],
  () => {
    syncToParent();
  },
  { deep: true },
);

// 監聽 localForm.roles 變化並同步回父層（僅在非 readonly 模式下）
watch(
  () => localForm.roles,
  () => {
    if (!props.isReadonly) {
      emit('update:roles', [...localForm.roles]);
    }
  },
  { deep: true },
);

// 使用 computed 的 getter/setter，綁定到 localForm
const rolesValue = computed({
  get: () => localForm.roles,
  set: (value: number[]) => {
    localForm.roles = value;
    // 在非 readonly 模式下，立即同步
    if (!props.isReadonly) {
      emit('update:roles', [...value]);
    }
  },
});

// 暴露驗證方法給父元件
defineExpose({
  validate: async () => {
    try {
      await formRef.value?.validate();
      return true;
    }
    catch {
      return false;
    }
  },
  formRef,
});

/**
 * 載入角色列表
 */
const loadRoles = async () => {
  try {
    loadingRoles.value = true;
    // 先清空角色選項，避免上次編輯的角色殘留
    roleOptions.value = [];

    const res = await RolesApi.getlocalRoles({});
    const roles = res?.roles ?? [];
    roleOptions.value = roles.map((r: any) => ({
      label: `${r.name} (${r.id})`,
      value: r.id,
    }));

    // Vue2 對齊：檢查已設定的角色是否在角色清單中，如果不在則加入
    if (props.editRecordRoles && props.editRecordRoles.length > 0) {
      const rolesIDList = roleOptions.value.map(role => role.value);
      props.editRecordRoles.forEach((role: any) => {
        if (role.id && !rolesIDList.includes(role.id)) {
          // 如果角色不在清單中，將其加入到選項列表中
          roleOptions.value.push({
            label: `${role.name || `角色 ${role.id}`} (${role.id})`,
            value: role.id,
          });
        }
      });
    }
  }
  catch (error) {
    console.error('載入角色列表失敗:', error);
  }
  finally {
    loadingRoles.value = false;
  }
};

// 當 accountType 變更為 masterAgentX 時，清空 website
watch(
  () => props.formModel.accountType,
  (newVal) => {
    if (newVal === 'masterAgentX') {
      localForm.website = '';
      // 在非 readonly 模式下，同步回父層
      if (!props.isReadonly) {
        props.formModel.website = '';
      }
    }
  },
);

// 監聽 editRecordRoles 變化，當編輯記錄改變時重新載入角色列表
watch(
  () => props.editRecordRoles,
  () => {
    loadRoles();
  },
  { deep: true },
);

/**
 * 驗證網域（不能包含 http:// 或 https://）
 */
const validateWebsite = (_rule: any, value: string) => {
  if (value && /^(http:\/\/|https:\/\/)/i.test(value)) {
    return Promise.reject(new Error('網域不能包含 http:// 或 https://'));
  }
  return Promise.resolve();
};

onMounted(() => {
  // [DEBUG] 確認元件是否有被掛載
  console.log('[Step1BasicInfo][DEBUG] 元件已掛載，formModel 當前值:', props.formModel);
  // 初始化時同步父層資料到 localForm
  syncFromParent();
  loadRoles();
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="localForm"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <!--
      帳戶類型由 Wizard 入口決定，Step1 不提供選擇
      保留 formModel.accountType 和驗證規則，但隱藏 UI 讓使用者無法選擇
    -->
    <!--
    <a-form-item
      label="帳戶類型"
      name="accountType"
      :rules="[{ required: true, message: '請選擇帳戶類型' }]"
    >
      <a-radio-group v-model:value="formModel.accountType">
        <a-radio value="masterAgent">
          總代理
        </a-radio>
        <a-radio value="masterAgentX">
          總代理（遊戲）
        </a-radio>
      </a-radio-group>
    </a-form-item>
    -->

    <a-form-item
      label="後台帳號"
      name="account"
      :rules="[{ required: true, message: '請輸入帳號' }]"
    >
      <a-input
        v-model:value="localForm.account"
        placeholder="請輸入帳號"
        :readonly="props.isEdit || props.isReadonly"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item
      label="名稱"
      name="name"
      :rules="[{ required: true, message: '請輸入名稱' }]"
    >
      <a-input v-model:value="localForm.name" placeholder="請輸入名稱" :disabled="props.isReadonly" />
    </a-form-item>

    <a-form-item
      v-if="!props.isEdit && localForm.accountType === 'masterAgent'"
      label="網域"
      name="website"
      :rules="[
        { required: !props.isEdit && localForm.accountType === 'masterAgent', message: '請輸入網域' },
        { validator: validateWebsite, trigger: 'blur' },
      ]"
    >
      <a-input
        v-model:value="localForm.website"
        placeholder="例如：example.com（不要包含 http/https）"
        :readonly="props.isEdit || props.isReadonly"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item
      v-if="false"
      label="網域"
      name="apiDomain"
      :rules="[{ required: true, message: '請輸入網域' }]"
    >
      <a-input
        v-model:value="localForm.apiDomain"
        placeholder="請輸入網域"
      />
    </a-form-item>

    <a-form-item
      label="角色"
      name="roles"
      :rules="[
        { required: true, type: 'array', min: 1, message: '請至少選擇一個角色' },
      ]"
    >
      <a-select
        v-model:value="rolesValue"
        :options="roleOptions"
        mode="multiple"
        placeholder="請選擇角色"
        :loading="loadingRoles"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="客服信箱" name="serviceEmail">
      <a-input
        v-model:value="localForm.serviceEmail"
        placeholder="請輸入客服信箱"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item
      label="單一手機號碼可綁定帳號數"
      name="onePhoneNumberToAccountCounts"
      :rules="[
        { required: true, message: '請輸入單一手機號碼可綁定帳號數' },
        { type: 'number', min: 1, message: '最小值為1' },
      ]"
    >
      <a-input-number
        v-model:value="localForm.onePhoneNumberToAccountCounts"
        :min="1"
        :precision="0"
        placeholder="請輸入整數,最小值為1"
        style="width: 100%"
        :disabled="props.isReadonly"
      />
    </a-form-item>
  </a-form>
</template>
