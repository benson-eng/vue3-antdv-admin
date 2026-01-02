<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/hooks/useI18n';

defineOptions({ name: 'Step7CustomerAndSocial' });

const props = defineProps<Props>();

// 多語系
const pageI18n = useI18n('page.adminAccount');
const t = pageI18n.t;

interface Props {
  formModel: {
    lineOfficialAccount: string;
    liffID: string;
    lineClientID: string;
    lineClientSecret: string;
    facebookID: string;
    reCaptcha_secretKey: string;
    reCaptcha_name: string;
    reCaptcha_siteKey: string;
    reCaptcha_enabled: boolean;
  };
}

const formRef = ref<FormInstance>();

/**
 * 計算是否可以啟用 reCAPTCHA
 * 只有當 secretKey、name、siteKey 都有值時，才能啟用開關
 */
const canEnableRecaptcha = computed(() => {
  return (
    Boolean(props.formModel.reCaptcha_secretKey?.trim())
    && Boolean(props.formModel.reCaptcha_name?.trim())
    && Boolean(props.formModel.reCaptcha_siteKey?.trim())
  );
});

/**
 * 檢查並自動關閉啟用開關（如果設定不完全）
 */
const checkAndDisableIfIncomplete = () => {
  if (!canEnableRecaptcha.value && props.formModel.reCaptcha_enabled) {
    props.formModel.reCaptcha_enabled = false;
  }
};

/**
 * 處理金鑰欄位輸入事件
 * 即時檢查設定是否完全，如果不完全則自動關閉
 */
const handleKeyFieldChange = () => {
  checkAndDisableIfIncomplete();
};

/**
 * 處理金鑰欄位失焦事件
 * 如果任一欄位被清空，自動將 enabled 設為 false
 */
const handleKeyFieldBlur = () => {
  checkAndDisableIfIncomplete();
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
  /** Step 7 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
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
    <!-- LINE 登入設定 -->
    <a-divider orientation="left">
      LINE 登入設定
    </a-divider>

    <a-form-item label="Line 官方帳號" name="lineOfficialAccount">
      <a-input
        v-model:value="formModel.lineOfficialAccount"
        placeholder="請輸入 Line 官方帳號"
      />
    </a-form-item>

    <a-form-item label="LIFF ID" name="liffID">
      <a-input
        v-model:value="formModel.liffID"
        placeholder="請輸入 LIFF ID"
      />
    </a-form-item>

    <a-form-item label="Line登入ID" name="lineClientID">
      <a-input
        v-model:value="formModel.lineClientID"
        placeholder="請輸入 Line 登入 ID"
      />
    </a-form-item>

    <a-form-item label="line登入密鑰" name="lineClientSecret">
      <a-input
        v-model:value="formModel.lineClientSecret"
        placeholder="請輸入 Line 登入 密鑰"
      />
    </a-form-item>

    <!-- Facebook 登入 -->
    <!-- <a-divider orientation="left">
      Facebook 登入
    </a-divider> -->

    <!-- <a-form-item label="Facebook 登入 ID" name="facebookID">
      <a-input
        v-model:value="formModel.facebookID"
        placeholder="請輸入 Facebook 登入 ID"
      />
    </a-form-item> -->

    <!-- reCAPTCHA 金鑰設定 -->
    <a-divider orientation="left">{{ t('recaptcha.keySettings') }}</a-divider>

    <a-form-item :label="t('recaptcha.secretKey')" name="reCaptcha_secretKey">
      <a-input
        v-model:value="formModel.reCaptcha_secretKey"
        :placeholder="t('recaptcha.secretKeyPlaceholder')"
        @input="handleKeyFieldChange"
        @blur="handleKeyFieldBlur"
      />
    </a-form-item>

    <a-form-item :label="t('recaptcha.siteKey')" name="reCaptcha_siteKey">
      <a-input
        v-model:value="formModel.reCaptcha_siteKey"
        :placeholder="t('recaptcha.siteKeyPlaceholder')"
        @input="handleKeyFieldChange"
        @blur="handleKeyFieldBlur"
      />
    </a-form-item>

    <a-form-item :label="t('recaptcha.name')" name="reCaptcha_name">
      <a-input
        v-model:value="formModel.reCaptcha_name"
        :placeholder="t('recaptcha.namePlaceholder')"
        @input="handleKeyFieldChange"
        @blur="handleKeyFieldBlur"
      />
    </a-form-item>

    <!-- 啟用設定（一直顯示） -->
    <a-divider orientation="left">{{ t('recaptcha.enableSettings') }}</a-divider>

    <a-form-item :label="t('recaptcha.enabled')" name="reCaptcha_enabled">
      <a-switch
        v-model:checked="formModel.reCaptcha_enabled"
        :disabled="!canEnableRecaptcha"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">{{ t('recaptcha.extraHint') }}</span>
      </template>
    </a-form-item>
  </a-form>
</template>

