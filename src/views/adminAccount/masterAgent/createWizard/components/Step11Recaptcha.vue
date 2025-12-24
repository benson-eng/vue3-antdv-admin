<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- reCAPTCHA 金鑰設定 -->
    <a-divider orientation="left">reCAPTCHA 金鑰設定</a-divider>

    <a-form-item label="reCAPTCHA Secret Key" name="reCaptcha_secretKey">
      <a-input
        v-model:value="formModel.reCaptcha_secretKey"
        placeholder="請輸入 reCAPTCHA Secret Key"
        @blur="handleKeyFieldBlur"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">當所有金鑰資訊填寫完成後，才可啟用人機驗證</span>
      </template>
    </a-form-item>

    <a-form-item label="reCAPTCHA Site Key" name="reCaptcha_siteKey">
      <a-input
        v-model:value="formModel.reCaptcha_siteKey"
        placeholder="請輸入 reCAPTCHA Site Key"
        @blur="handleKeyFieldBlur"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">當所有金鑰資訊填寫完成後，才可啟用人機驗證</span>
      </template>
    </a-form-item>

    <a-form-item label="reCAPTCHA 名稱" name="reCaptcha_name">
      <a-input
        v-model:value="formModel.reCaptcha_name"
        placeholder="請輸入 reCAPTCHA 名稱"
        @blur="handleKeyFieldBlur"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">當所有金鑰資訊填寫完成後，才可啟用人機驗證</span>
      </template>
    </a-form-item>

    <!-- 啟用設定（條件顯示） -->
    <template v-if="canEnableRecaptcha">
      <a-divider orientation="left">啟用設定</a-divider>

      <a-form-item label="啟用 reCAPTCHA" name="reCaptcha_enabled">
        <a-switch v-model:checked="formModel.reCaptcha_enabled" />
        <template #extra>
          <span style="color: #999; font-size: 12px">當所有金鑰資訊填寫完成後，才可啟用人機驗證</span>
        </template>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step11Recaptcha' });

interface Props {
  formModel: {
    reCaptcha_secretKey: string;
    reCaptcha_name: string;
    reCaptcha_siteKey: string;
    reCaptcha_enabled: boolean;
  };
}

const props = defineProps<Props>();

const formRef = ref<FormInstance>();

/**
 * 計算是否可以啟用 reCAPTCHA
 * 只有當 secretKey、name、siteKey 都有值時，才顯示啟用開關
 */
const canEnableRecaptcha = computed(() => {
  return (
    Boolean(props.formModel.reCaptcha_secretKey?.trim())
    && Boolean(props.formModel.reCaptcha_name?.trim())
    && Boolean(props.formModel.reCaptcha_siteKey?.trim())
  );
});

/**
 * 處理金鑰欄位失焦事件
 * 如果任一欄位被清空，自動將 enabled 設為 false
 */
const handleKeyFieldBlur = () => {
  if (!canEnableRecaptcha.value) {
    props.formModel.reCaptcha_enabled = false;
  }
};

/**
 * 監聽 canEnableRecaptcha 變化
 * 如果從 true 變為 false，自動將 enabled 設為 false
 */
watch(canEnableRecaptcha, (newVal) => {
  if (!newVal) {
    props.formModel.reCaptcha_enabled = false;
  }
});

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 11 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


