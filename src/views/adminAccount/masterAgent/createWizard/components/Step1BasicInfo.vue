<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import { onMounted, ref, watch } from 'vue';
import ShareholderApi from '@/api/backend/adminAccount/shareholder';

defineOptions({ name: 'Step1BasicInfo' });

const props = defineProps<Props>();

interface Props {
  formModel: {
    accountType: 'masterAgent' | 'masterAgentX' | undefined;
    account: string;
    name: string;
    website: string;
    currencyCode: string;
    shareholderAccount: string;
  };
}

const formRef = ref<FormInstance>();
const shareholderOptions = ref<Array<{ label: string; value: string }>>([]);
const loadingShareholders = ref(false);

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
 * 載入股東列表
 */
const loadShareholders = async () => {
  try {
    loadingShareholders.value = true;
    const list = await ShareholderApi.getShareholderList({});
    const items = (Array.isArray(list) ? list : []).filter((i: any) => Boolean(i?.isMasterAccount));
    shareholderOptions.value = items.map((i: any) => ({
      label: `${i.name ?? ''} (${i.account})`,
      value: i.account,
    }));
  }
  catch (error) {
    console.error('載入股東列表失敗:', error);
  }
  finally {
    loadingShareholders.value = false;
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

onMounted(() => {
  loadShareholders();
});
</script>

<template>
  <a-form
    ref="formRef"
    :model="formModel"
    :label-col="{ span: 6 }"
    :wrapper-col="{ span: 14 }"
  >
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

    <a-form-item
      label="後台帳號"
      name="account"
      :rules="[{ required: true, message: '請輸入帳號' }]"
    >
      <a-input v-model:value="formModel.account" placeholder="請輸入帳號" />
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
      />
    </a-form-item>

    <a-form-item
      label="幣別"
      name="currencyCode"
      :rules="[{ required: true, message: '請輸入幣別' }]"
    >
      <a-input v-model:value="formModel.currencyCode" placeholder="例如：gold" />
    </a-form-item>

    <a-form-item label="歸屬股東" name="shareholderAccount">
      <a-select
        v-model:value="formModel.shareholderAccount"
        :options="shareholderOptions"
        allow-clear
        placeholder="請選擇股東（可選）"
        :loading="loadingShareholders"
      />
    </a-form-item>
  </a-form>
</template>
