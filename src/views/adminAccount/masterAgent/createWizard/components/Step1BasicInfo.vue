<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { onMounted, ref, watch } from 'vue';

defineOptions({ name: 'Step1BasicInfo' });

const props = defineProps<Props>();

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
    boSmsAccount: string;
    boSmsPassWord: string;
    accountPointsWarningValue?: number;
  };
  isEdit?: boolean;
  level?: number;
}

const formRef = ref<FormInstance>();

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

// 當 accountType 變更為 masterAgentX 時，清空 website
watch(
  () => props.formModel.accountType,
  (newVal) => {
    if (newVal === 'masterAgentX') {
      props.formModel.website = '';
    }
  },
);

onMounted(() => {
  // [DEBUG] 確認元件是否有被掛載
  console.log('[Step1BasicInfo][DEBUG] 元件已掛載，formModel 當前值:', props.formModel);
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
      v-if="formModel.accountType === 'masterAgent' && !props.isEdit"
      label="網站名稱"
      name="website"
      :rules="[{ required: formModel.accountType === 'masterAgent', message: '請輸入網站名稱' }]"
    >
      <a-input
        v-model:value="formModel.website"
        placeholder="例如：example.com（不要包含 http/https）"
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

    <a-form-item label="三竹簡訊商帳號" name="boSmsAccount">
      <a-input
        v-model:value="formModel.boSmsAccount"
        placeholder="請輸入三竹簡訊商帳號"
      />
    </a-form-item>

    <a-form-item label="三竹簡訊商密碼" name="boSmsPassWord">
      <a-input-password
        v-model:value="formModel.boSmsPassWord"
        placeholder="請輸入三竹簡訊商密碼"
      />
    </a-form-item>

    <a-form-item
      v-if="props.level === 1"
      label="簡訊帳號點數不足告警水位"
      name="accountPointsWarningValue"
    >
      <a-input-number
        v-model:value="formModel.accountPointsWarningValue"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入簡訊帳號點數不足告警水位"
      />
    </a-form-item>
  </a-form>
</template>
