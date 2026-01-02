<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import { message } from 'ant-design-vue';
import { ref } from 'vue';

defineOptions({ name: 'Step5FirebaseAnalytics' });

const props = defineProps<Props>();

interface Props {
  formModel: {
    gaKey: string;
    firebaseSdkConfig: string;
    firebaseAdminSdkConfig: string;
    firebaseConfig: string;
  };
}

const formRef = ref<FormInstance>();

/**
 * 格式化 JSON（輕量檢查）
 */
const formatJson = (fieldName: 'firebaseSdkConfig' | 'firebaseAdminSdkConfig' | 'firebaseConfig') => {
  const value = props.formModel[fieldName];
  if (!value || !value.trim()) {
    message.warning('欄位為空，無法格式化');
    return;
  }

  const trimmed = value.trim();
  // 檢查是否看起來像 JSON（以 { 或 [ 開頭）
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    message.warning('內容不是 JSON 格式（應以 { 或 [ 開頭）');
    return;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const formatted = JSON.stringify(parsed, null, 2);
    props.formModel[fieldName] = formatted;
    message.success('JSON 格式化成功');
  }
  catch (error) {
    message.warning('JSON 格式錯誤，無法格式化');
  }
};

/**
 * 驗證 JSON 格式
 * @param value 要驗證的值
 * @returns 如果為空或格式正確返回 true，否則返回 false
 */
const validateJson = (value: string): { valid: boolean; error?: string } => {
  if (!value || !value.trim()) {
    return { valid: true }; // 空值視為有效（選填欄位）
  }

  const trimmed = value.trim();

  // 檢查是否看起來像 JSON（以 { 或 [ 開頭）
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { valid: false, error: 'JSON 格式應以 { 或 [ 開頭' };
  }

  try {
    JSON.parse(trimmed);
    return { valid: true };
  }
  catch (error) {
    return { valid: false, error: 'JSON 格式錯誤，請檢查語法' };
  }
};

/**
 * 創建 JSON 驗證規則
 */
const createJsonValidator = (): Rule => ({
  validator: (_rule: any, value: string) => {
    const result = validateJson(value);
    if (!result.valid) {
      return Promise.reject(new Error(result.error || '格式錯誤'));
    }
    return Promise.resolve();
  },
});

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 5 驗證：如果有輸入，必須符合 JSON 格式 */
  validate: async () => {
    // 1️⃣ 先跑 ant-form 的 rules（如果有）
    if (formRef.value) {
      try {
        await formRef.value.validate();
      }
      catch (error) {
        console.log('[Step5] 表單規則驗證失敗:', error);
        return false;
      }
    }

    // 2️⃣ 再「強制驗證 JSON」（關鍵）
    const jsonFields: Array<{
      key: keyof Props['formModel'];
      label: string;
    }> = [
      { key: 'firebaseSdkConfig', label: 'Firebase SDK 配置' },
      { key: 'firebaseAdminSdkConfig', label: 'Firebase 管理員 SDK 配置' },
      { key: 'firebaseConfig', label: 'Firebase 設定' },
    ];

    for (const { key, label } of jsonFields) {
      const value = props.formModel[key];
      const result = validateJson(value);
      if (!result.valid) {
        message.error(`${label}：${result.error}`);
        // 確保表單也顯示錯誤狀態
        if (formRef.value) {
          try {
            await formRef.value.validateFields([key as string]).catch(() => {});
          }
          catch {
            // 忽略錯誤，已經顯示了 message.error
          }
        }
        return false; // 🔥 真正阻擋 Wizard
      }
    }

    return true;
  },

});
</script>

<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- <a-form-item label="GA 金鑰" name="gaKey">
      <a-textarea
        v-model:value="formModel.gaKey"
        :rows="2"
        placeholder="請輸入 Google Analytics 金鑰（可稍後補）"
      />
    </a-form-item> -->

    <a-form-item
      label="Firebase SDK 配置"
      name="firebaseSdkConfig"
      :rules="[createJsonValidator()]"
    >
      <template #extra>
        <a-button
          size="small"
          type="link"
          style="padding: 0"
          @click="formatJson('firebaseSdkConfig')"
        >
          格式化 JSON
        </a-button>
      </template>
      <a-textarea
        v-model:value="formModel.firebaseSdkConfig"
        :rows="5"
        placeholder="請輸入 Firebase SDK 配置（JSON 格式或文字）"
      />
    </a-form-item>

    <a-form-item
      label="Firebase 管理員 SDK 配置"
      name="firebaseAdminSdkConfig"
      :rules="[createJsonValidator()]"
    >
      <template #extra>
        <a-button
          size="small"
          type="link"
          style="padding: 0"
          @click="formatJson('firebaseAdminSdkConfig')"
        >
          格式化 JSON
        </a-button>
      </template>
      <a-textarea
        v-model:value="formModel.firebaseAdminSdkConfig"
        :rows="6"
        placeholder="請輸入 Firebase 管理員 SDK 配置（JSON 格式或文字）"
      />
    </a-form-item>

    <a-form-item
      label="Firebase 設定"
      name="firebaseConfig"
      :rules="[createJsonValidator()]"
    >
      <template #extra>
        <a-button
          size="small"
          type="link"
          style="padding: 0"
          @click="formatJson('firebaseConfig')"
        >
          格式化 JSON
        </a-button>
      </template>
      <a-textarea
        v-model:value="formModel.firebaseConfig"
        :rows="6"
        placeholder="請輸入 Firebase 設定（JSON 格式或文字）"
      />
    </a-form-item>
  </a-form>
</template>
