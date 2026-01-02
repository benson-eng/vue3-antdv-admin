<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { computed, onMounted, ref, watch } from 'vue';
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
    serviceEmail: string;
    onePhoneNumberToAccountCounts: number;
    roles: number[];
  };
  isEdit?: boolean;
  level?: number;
  /** 編輯模式下的完整角色對象數組（用於檢查不在清單中的角色） */
  editRecordRoles?: Array<{ id: number; name: string; [key: string]: any }>;
}

const formRef = ref<FormInstance>();
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
const loadingRoles = ref(false);

// 使用 computed 的 getter/setter，通過 emit 更新父組件
const rolesValue = computed({
  get: () => props.formModel.roles,
  set: (value: number[]) => {
    emit('update:roles', value);
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
      props.formModel.website = '';
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

onMounted(() => {
  // [DEBUG] 確認元件是否有被掛載
  console.log('[Step1BasicInfo][DEBUG] 元件已掛載，formModel 當前值:', props.formModel);
  loadRoles();
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="formModel"
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
        v-model:value="formModel.account"
        placeholder="請輸入帳號"
        :readonly="props.isEdit"
      />
    </a-form-item>

    <a-form-item
      label="名稱"
      name="name"
      :rules="[{ required: true, message: '請輸入名稱' }]"
    >
      <a-input v-model:value="formModel.name" placeholder="請輸入名稱" />
    </a-form-item>

    <a-form-item
      v-if="formModel.accountType === 'masterAgent'"
      label="網站名稱"
      name="website"
      :rules="[{ required: formModel.accountType === 'masterAgent', message: '請輸入網站名稱' }]"
    >
      <a-input
        v-model:value="formModel.website"
        placeholder="例如：example.com（不要包含 http/https）"
        :readonly="props.isEdit"
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
      />
    </a-form-item>

    <a-form-item
      v-if="!props.isEdit"
      label="幣別"
      name="currencyCode"
      :rules="[{ required: true, message: '請輸入幣別' }]"
    >
      <a-input v-model:value="formModel.currencyCode" placeholder="例如：gold" />
    </a-form-item>

    <a-form-item label="客服信箱" name="serviceEmail">
      <a-input
        v-model:value="formModel.serviceEmail"
        placeholder="請輸入客服信箱"
      />
    </a-form-item>

    <a-form-item label="單一手機號碼可綁定帳號數" name="onePhoneNumberToAccountCounts">
      <a-input-number
        v-model:value="formModel.onePhoneNumberToAccountCounts"
        :min="1"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item label="允許會員暱稱重複" name="isAllowMemberNicknameDuplicate">
      <a-checkbox v-model:checked="(formModel as any).isAllowMemberNicknameDuplicate" />
    </a-form-item>
  </a-form>
</template>
