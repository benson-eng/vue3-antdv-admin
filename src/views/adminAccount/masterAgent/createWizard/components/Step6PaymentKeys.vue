<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- 支付金鑰 -->
    <a-divider orientation="left">支付金鑰</a-divider>

    <a-form-item label="iOS 支付金鑰" name="iosPaymentKey">
      <a-input
        v-model:value="formModel.iosPaymentKey"
        placeholder="請輸入 iOS 支付金鑰"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">可於後續再設定，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="Android 支付金鑰" name="androidPaymentKey">
      <a-input
        v-model:value="formModel.androidPaymentKey"
        placeholder="請輸入 Android 支付金鑰"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">可於後續再設定，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="EC 支付金鑰" name="ecPaymentKey">
      <a-input
        v-model:value="formModel.ecPaymentKey"
        placeholder="請輸入 EC 支付金鑰"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">可於後續再設定，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="GCP 金鑰" name="gcpKey">
      <a-input
        v-model:value="formModel.gcpKey"
        placeholder="請輸入 GCP 金鑰"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">可於後續再設定，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <!-- 應用包識別碼 -->
    <a-divider orientation="left">應用包識別碼</a-divider>

    <a-form-item label="Android 應用包識別碼" name="androidBundleID">
      <a-input
        v-model:value="formModel.androidBundleID"
        placeholder="請輸入 Android 應用包識別碼"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">可於後續再設定，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="iOS 應用包識別碼" name="iosBundleID">
      <a-input
        v-model:value="formModel.iosBundleID"
        placeholder="請輸入 iOS 應用包識別碼"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">可於後續再設定，不影響帳戶建立</span>
      </template>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step6PaymentKeys' });

interface Props {
  formModel: {
    iosPaymentKey: string;
    androidPaymentKey: string;
    ecPaymentKey: string;
    gcpKey: string;
    androidBundleID: string;
    iosBundleID: string;
  };
}

defineProps<Props>();

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 6 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


