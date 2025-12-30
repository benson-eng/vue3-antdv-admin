<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { ref } from 'vue';

defineOptions({ name: 'Step3WalletAndFormula' });

defineProps<Props>();

interface Props {
  formModel: {
    minTransactionBalance: number;
    sendSmsOTPIntervals: number;
    authExpireTime: number;
    spinUnfreezeRatio: number;
  };
}

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 3 不需要驗證，所有欄位都有預設值 */
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
    <!-- 交易設定 -->
    <a-divider orientation="left">
      交易設定
    </a-divider>

    <a-form-item label="贈禮最小交易金額" name="minTransactionBalance">
      <a-input-number
        v-model:value="formModel.minTransactionBalance"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item label="OTP 發送間隔(分鐘)" name="sendSmsOTPIntervals">
      <a-input-number
        v-model:value="formModel.sendSmsOTPIntervals"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item label="OTP 驗證相關過期時間(分鐘)" name="authExpireTime">
      <a-input-number
        v-model:value="formModel.authExpireTime"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item label="押注解鎖倍率 (數值)" name="spinUnfreezeRatio">
      <a-input-number
        v-model:value="formModel.spinUnfreezeRatio"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
    </a-form-item>
  </a-form>
</template>
