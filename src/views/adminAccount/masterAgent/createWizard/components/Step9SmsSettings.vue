<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import { onMounted, reactive, ref, watch } from 'vue';

defineOptions({ name: 'Step9SmsSettings' });

const props = defineProps<Props>();

interface Props {
  formModel: {
    smsAccount: string;
    smsPassWord: string;
    boSmsAccount: string;
    boSmsPassWord: string;
    cloudSmsAccount?: string;
    cloudSmsPassWord?: string;
    isOpenOtherSMS?: string;
    useSMSPlatforms?: string;
    sendSmsOTPIntervals: number;
    authExpireTime: number;
    otpMode?: string;
    accountPointsWarningValue?: number;
  };
  level?: number;
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
  smsAccount: string;
  smsPassWord: string;
  boSmsAccount: string;
  boSmsPassWord: string;
  cloudSmsAccount?: string;
  cloudSmsPassWord?: string;
  isOpenOtherSMS?: string;
  useSMSPlatforms?: string;
  sendSmsOTPIntervals: number;
  authExpireTime: number;
  otpMode?: string;
  accountPointsWarningValue?: number;
}>({
  smsAccount: props.formModel.smsAccount,
  smsPassWord: props.formModel.smsPassWord,
  boSmsAccount: props.formModel.boSmsAccount,
  boSmsPassWord: props.formModel.boSmsPassWord,
  cloudSmsAccount: props.formModel.cloudSmsAccount,
  cloudSmsPassWord: props.formModel.cloudSmsPassWord,
  isOpenOtherSMS: props.formModel.isOpenOtherSMS,
  useSMSPlatforms: props.formModel.useSMSPlatforms,
  sendSmsOTPIntervals: props.formModel.sendSmsOTPIntervals,
  authExpireTime: props.formModel.authExpireTime,
  otpMode: props.formModel.otpMode,
  accountPointsWarningValue: props.formModel.accountPointsWarningValue,
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  Object.assign(props.formModel, {
    smsAccount: localForm.smsAccount,
    smsPassWord: localForm.smsPassWord,
    boSmsAccount: localForm.boSmsAccount,
    boSmsPassWord: localForm.boSmsPassWord,
    cloudSmsAccount: localForm.cloudSmsAccount,
    cloudSmsPassWord: localForm.cloudSmsPassWord,
    isOpenOtherSMS: localForm.isOpenOtherSMS,
    useSMSPlatforms: localForm.useSMSPlatforms,
    sendSmsOTPIntervals: localForm.sendSmsOTPIntervals,
    authExpireTime: localForm.authExpireTime,
    otpMode: localForm.otpMode,
    accountPointsWarningValue: localForm.accountPointsWarningValue,
  });
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.smsAccount = props.formModel.smsAccount;
  localForm.smsPassWord = props.formModel.smsPassWord;
  localForm.boSmsAccount = props.formModel.boSmsAccount;
  localForm.boSmsPassWord = props.formModel.boSmsPassWord;
  localForm.cloudSmsAccount = props.formModel.cloudSmsAccount;
  localForm.cloudSmsPassWord = props.formModel.cloudSmsPassWord;
  localForm.isOpenOtherSMS = props.formModel.isOpenOtherSMS;
  localForm.useSMSPlatforms = props.formModel.useSMSPlatforms;
  localForm.sendSmsOTPIntervals = props.formModel.sendSmsOTPIntervals;
  localForm.authExpireTime = props.formModel.authExpireTime;
  localForm.otpMode = props.formModel.otpMode;
  localForm.accountPointsWarningValue = props.formModel.accountPointsWarningValue;
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
    localForm.smsAccount,
    localForm.smsPassWord,
    localForm.boSmsAccount,
    localForm.boSmsPassWord,
    localForm.cloudSmsAccount,
    localForm.cloudSmsPassWord,
    localForm.isOpenOtherSMS,
    localForm.useSMSPlatforms,
    localForm.sendSmsOTPIntervals,
    localForm.authExpireTime,
    localForm.otpMode,
    localForm.accountPointsWarningValue,
  ],
  () => {
    syncToParent();
  },
  { deep: true },
);

onMounted(() => {
  syncFromParent();
});

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 9 不需要驗證，所有欄位都是選填 */
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
    <!-- 三竹簡訊商 -->
    <a-divider orientation="left">
      三竹簡訊商
    </a-divider>

    <a-form-item label="三竹簡訊商帳號" name="boSmsAccount">
      <a-input
        v-model:value="localForm.boSmsAccount"
        placeholder="請輸入三竹簡訊商帳號"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="三竹簡訊商密碼" name="boSmsPassWord">
      <a-input-password
        v-model:value="localForm.boSmsPassWord"
        placeholder="請輸入三竹簡訊商密碼"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <!-- OTP 設定 -->
    <!-- <a-divider orientation="left">
      OTP 設定
    </a-divider> -->

    <!-- <a-form-item label="交易 OTP 發送間隔(分鐘)" name="sendSmsOTPIntervals">
      <a-input-number
        v-model:value="formModel.sendSmsOTPIntervals"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入 OTP 發送間隔"
      />
    </a-form-item> -->

    <!-- <a-form-item label="交易 OTP 驗證過期時間(分鐘)" name="authExpireTime">
      <a-input-number
        v-model:value="formModel.authExpireTime"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入 OTP 驗證相關過期時間"
      />
    </a-form-item> -->

    <!-- <a-form-item
      label="交易 OTP 模式"
      name="otpMode"
    >
      <a-select
        v-model:value="formModel.otpMode"
        style="width: 100%"
      >
        <a-select-option value="Real">
          Real
        </a-select-option>
        <a-select-option value="Fake">
          Fake
        </a-select-option>
      </a-select>
    </a-form-item> -->

    <!-- 其他設定 -->
    <!-- <a-divider orientation="left">
      其他設定
    </a-divider> -->

    <!-- <a-form-item
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
    </a-form-item> -->
  </a-form>
</template>
