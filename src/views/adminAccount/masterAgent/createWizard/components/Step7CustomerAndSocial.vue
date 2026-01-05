<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
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
  /** 是否為唯讀模式（Level 4 檢視模式） */
  isReadonly?: boolean;
}

const formRef = ref<FormInstance>();

/**
 * 本地表單副本（用於 readonly 模式下隔離寫入）
 * 在 readonly 模式下，所有變更僅影響 localForm，不會寫回父層
 * 在非 readonly 模式下，變更會同步回父層 formModel
 */
const localForm = reactive<{
  lineOfficialAccount: string;
  liffID: string;
  lineClientID: string;
  lineClientSecret: string;
  facebookID: string;
  reCaptcha_secretKey: string;
  reCaptcha_name: string;
  reCaptcha_siteKey: string;
  reCaptcha_enabled: boolean;
}>({
  lineOfficialAccount: props.formModel.lineOfficialAccount,
  liffID: props.formModel.liffID,
  lineClientID: props.formModel.lineClientID,
  lineClientSecret: props.formModel.lineClientSecret,
  facebookID: props.formModel.facebookID,
  reCaptcha_secretKey: props.formModel.reCaptcha_secretKey,
  reCaptcha_name: props.formModel.reCaptcha_name,
  reCaptcha_siteKey: props.formModel.reCaptcha_siteKey,
  reCaptcha_enabled: props.formModel.reCaptcha_enabled,
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  Object.assign(props.formModel, {
    lineOfficialAccount: localForm.lineOfficialAccount,
    liffID: localForm.liffID,
    lineClientID: localForm.lineClientID,
    lineClientSecret: localForm.lineClientSecret,
    facebookID: localForm.facebookID,
    reCaptcha_secretKey: localForm.reCaptcha_secretKey,
    reCaptcha_name: localForm.reCaptcha_name,
    reCaptcha_siteKey: localForm.reCaptcha_siteKey,
    reCaptcha_enabled: localForm.reCaptcha_enabled,
  });
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.lineOfficialAccount = props.formModel.lineOfficialAccount;
  localForm.liffID = props.formModel.liffID;
  localForm.lineClientID = props.formModel.lineClientID;
  localForm.lineClientSecret = props.formModel.lineClientSecret;
  localForm.facebookID = props.formModel.facebookID;
  localForm.reCaptcha_secretKey = props.formModel.reCaptcha_secretKey;
  localForm.reCaptcha_name = props.formModel.reCaptcha_name;
  localForm.reCaptcha_siteKey = props.formModel.reCaptcha_siteKey;
  localForm.reCaptcha_enabled = props.formModel.reCaptcha_enabled;
};

// 監聽父層 formModel 變化，同步到 localForm（僅在 readonly 模式下）
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
    localForm.lineOfficialAccount,
    localForm.liffID,
    localForm.lineClientID,
    localForm.lineClientSecret,
    localForm.facebookID,
    localForm.reCaptcha_secretKey,
    localForm.reCaptcha_name,
    localForm.reCaptcha_siteKey,
    localForm.reCaptcha_enabled,
  ],
  () => {
    syncToParent();
  },
  { deep: true },
);

onMounted(() => {
  syncFromParent();
});

/**
 * 計算是否可以啟用 reCAPTCHA
 * 只有當 secretKey、name、siteKey 都有值時，才能啟用開關
 */
const canEnableRecaptcha = computed(() => {
  return (
    Boolean(localForm.reCaptcha_secretKey?.trim())
    && Boolean(localForm.reCaptcha_name?.trim())
    && Boolean(localForm.reCaptcha_siteKey?.trim())
  );
});

/**
 * 檢查並自動關閉啟用開關（如果設定不完全）
 */
const checkAndDisableIfIncomplete = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不執行
  }
  if (!canEnableRecaptcha.value && localForm.reCaptcha_enabled) {
    localForm.reCaptcha_enabled = false;
    syncToParent();
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
  if (props.isReadonly) {
    return; // readonly 模式下不執行
  }
  if (!newVal) {
    localForm.reCaptcha_enabled = false;
    syncToParent();
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
    :model="localForm"
    layout="horizontal"
    :label-col="{ style: { width: '200px' } }"
    :wrapper-col="{ style: { flex: 1 } }"
  >
    <!-- LINE 登入設定 -->
    <!-- <a-divider orientation="left">
      LINE 登入設定
    </a-divider> -->

    <!-- <a-form-item label="Line 官方帳號" name="lineOfficialAccount">
      <a-input
        v-model:value="localForm.lineOfficialAccount"
        placeholder="請輸入 Line 官方帳號"
        :disabled="props.isReadonly"
      />
    </a-form-item> -->

    <!-- <a-form-item label="LIFF ID" name="liffID">
      <a-input
        v-model:value="localForm.liffID"
        placeholder="請輸入 LIFF ID"
        :disabled="props.isReadonly"
      />
    </a-form-item> -->

    <!-- <a-form-item label="Line登入ID" name="lineClientID">
      <a-input
        v-model:value="localForm.lineClientID"
        placeholder="請輸入 Line 登入 ID"
        :disabled="props.isReadonly"
      />
    </a-form-item> -->

    <!-- <a-form-item label="line登入密鑰" name="lineClientSecret">
      <a-input
        v-model:value="localForm.lineClientSecret"
        placeholder="請輸入 Line 登入 密鑰"
        :disabled="props.isReadonly"
      />
    </a-form-item> -->

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
        v-model:value="localForm.reCaptcha_secretKey"
        :placeholder="t('recaptcha.secretKeyPlaceholder')"
        :disabled="props.isReadonly"
        @input="handleKeyFieldChange"
        @blur="handleKeyFieldBlur"
      />
    </a-form-item>

    <a-form-item :label="t('recaptcha.siteKey')" name="reCaptcha_siteKey">
      <a-input
        v-model:value="localForm.reCaptcha_siteKey"
        :placeholder="t('recaptcha.siteKeyPlaceholder')"
        :disabled="props.isReadonly"
        @input="handleKeyFieldChange"
        @blur="handleKeyFieldBlur"
      />
    </a-form-item>

    <a-form-item :label="t('recaptcha.name')" name="reCaptcha_name">
      <a-input
        v-model:value="localForm.reCaptcha_name"
        :placeholder="t('recaptcha.namePlaceholder')"
        :disabled="props.isReadonly"
        @input="handleKeyFieldChange"
        @blur="handleKeyFieldBlur"
      />
    </a-form-item>

    <!-- 啟用設定（一直顯示） -->
    <a-divider orientation="left">{{ t('recaptcha.enableSettings') }}</a-divider>

    <a-form-item :label="t('recaptcha.enabled')" name="reCaptcha_enabled">
      <a-switch
        v-model:checked="localForm.reCaptcha_enabled"
        :disabled="props.isReadonly || !canEnableRecaptcha"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">{{ t('recaptcha.extraHint') }}</span>
      </template>
    </a-form-item>
  </a-form>
</template>

