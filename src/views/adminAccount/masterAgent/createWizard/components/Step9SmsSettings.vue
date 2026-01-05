<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { ref } from 'vue';

defineOptions({ name: 'Step9SmsSettings' });

defineProps<Props>();

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
}

const formRef = ref<FormInstance>();

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
    :model="formModel"
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
