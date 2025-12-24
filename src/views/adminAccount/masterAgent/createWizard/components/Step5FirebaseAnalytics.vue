<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
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
 * 輕量驗證 JSON（僅檢查，不阻擋）
 */
const validateJson = (value: string): boolean => {
  if (!value || !value.trim()) { return true; } // 空值視為有效
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) { return true; } // 不是 JSON 格式，不檢查
  try {
    JSON.parse(trimmed);
    return true;
  }
  catch {
    return false;
  }
};

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 5 不需要驗證，所有欄位都是選填 */
  validate: async () => {
    // 輕量檢查 JSON 格式（僅警告，不阻擋）
    const fields: Array<'firebaseSdkConfig' | 'firebaseAdminSdkConfig' | 'firebaseConfig'> = [
      'firebaseSdkConfig',
      'firebaseAdminSdkConfig',
      'firebaseConfig',
    ];
    let hasWarning = false;
    fields.forEach((field) => {
      if (!validateJson(props.formModel[field])) {
        hasWarning = true;
      }
    });
    if (hasWarning) {
      message.warning('部分欄位 JSON 格式可能有誤，但不影響繼續');
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
    <a-form-item label="GA 金鑰" name="gaKey">
      <a-textarea
        v-model:value="formModel.gaKey"
        :rows="2"
        placeholder="請輸入 Google Analytics 金鑰（可稍後補）"
      />
    </a-form-item>

    <a-form-item label="Firebase SDK 配置" name="firebaseSdkConfig">
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
        :rows="6"
        placeholder="請輸入 Firebase SDK 配置（JSON 格式或文字）&#10;例如：{&#10;  &quot;apiKey&quot;: &quot;...&quot;,&#10;  &quot;authDomain&quot;: &quot;...&quot;&#10;}"
      />
    </a-form-item>

    <a-form-item label="Firebase 管理員 SDK 配置" name="firebaseAdminSdkConfig">
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
        placeholder="請輸入 Firebase 管理員 SDK 配置（JSON 格式或文字）&#10;可稍後補齊"
      />
    </a-form-item>

    <a-form-item label="Firebase 設定" name="firebaseConfig">
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
        placeholder="請輸入 Firebase 設定（JSON 格式或文字）&#10;可稍後補齊"
      />
    </a-form-item>
  </a-form>
</template>
