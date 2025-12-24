<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- 警告訊息 -->
    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 24px"
    >
      <template #message>
        <span>此區塊為進階設定，僅限系統管理員使用。錯誤設定可能導致系統異常。</span>
      </template>
    </a-alert>

    <!-- JSON 設定欄位 -->
    <a-divider orientation="left">JSON 設定</a-divider>

    <a-form-item label="系統內部設定（internalSettings）" name="internalSettings">
      <a-textarea
        v-model:value="formModel.internalSettings"
        :rows="10"
        placeholder='請輸入 JSON 格式，例如：{"key": "value"}'
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">系統內部設定（僅限管理員使用）</span>
      </template>
    </a-form-item>

    <a-form-item label="遠端設定檔 URL（remoteConfigURLs）" name="remoteConfigURLs">
      <a-textarea
        v-model:value="formModel.remoteConfigURLs"
        :rows="8"
        placeholder='請輸入 JSON 格式，例如：{"key": "value"}'
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">遠端設定檔 URL 設定（僅限管理員使用）</span>
      </template>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step12AdvancedSettings' });

interface Props {
  formModel: {
    internalSettings: string;
    remoteConfigURLs: string;
  };
}

defineProps<Props>();

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 12 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


