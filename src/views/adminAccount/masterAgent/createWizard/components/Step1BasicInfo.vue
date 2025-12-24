<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { message } from 'ant-design-vue';
import { onMounted, ref, watch } from 'vue';
import ShareholderApi from '@/api/backend/adminAccount/shareholder';
import { useFormModal } from '@/hooks/useModal';
import { useUserStore } from '@/store/modules/user';
import { baseSchemas } from '@/views/adminAccount/shareholder/formSchemas';

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
    shareholderAccount: string;
  };
}

const formRef = ref<FormInstance>();
const shareholderOptions = ref<Array<{ label: string; value: string }>>([]);
const loadingShareholders = ref(false);
const userStore = useUserStore();
const [showModal] = useFormModal();

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

/**
 * 生成後端密鑰（用於新增股東）
 */
const toBase32 = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
};

const generateBackendKey = () => {
  /**
   * 160-bit
   */
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

/**
 * 開啟新增股東 dialog
 */
const openAddShareholderModal = async () => {
  const [formRef] = await showModal({
    modalProps: {
      title: '新增股東',
      width: 700,
      async onFinish(values) {
        const payloadRoles = Array.isArray(values.roles)
          ? values.roles.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
          : [];

        await ShareholderApi.createShareholderAccount({
          account: String(values.account),
          password: '123456',
          name: String(values.name),
          roles: payloadRoles,
          backendKey: generateBackendKey(),
        });
        message.success('新增成功');

        // 重新載入歸屬股東清單
        await loadShareholders();
      },
    },
    formProps: {
      labelWidth: 120,
      schemas: baseSchemas,
    },
  });

  // 設置角色欄位的禁用狀態
  formRef?.updateSchema([
    { field: 'account', componentProps: { disabled: false } },
    { field: 'roles', componentProps: { disabled: userStore.level !== 2 } },
  ]);
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
  // [DEBUG] 確認元件是否有被掛載
  console.log('[Step1BasicInfo][DEBUG] 元件已掛載，formModel 當前值:', props.formModel);
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
      <div style="display: flex; gap: 8px; align-items: center">
        <a-select
          v-model:value="formModel.shareholderAccount"
          :options="shareholderOptions"
          allow-clear
          placeholder="請選擇股東（可選）"
          :loading="loadingShareholders"
          style="flex: 1"
        />
        <a-button type="primary" @click="openAddShareholderModal">
          增加股東
        </a-button>
      </div>
    </a-form-item>
  </a-form>
</template>
