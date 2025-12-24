<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- 金流開關 -->
    <a-divider orientation="left">金流開關</a-divider>

    <a-form-item label="MyCard" name="myCardShowType">
      <a-switch v-model:checked="formModel.myCardShowType" />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="SoNet" name="soNetShowType">
      <a-switch v-model:checked="formModel.soNetShowType" />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="NganLuong" name="nganLuongShowType">
      <a-switch v-model:checked="formModel.nganLuongShowType" />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="MoPay" name="moPayShowType">
      <a-switch v-model:checked="formModel.moPayShowType" />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <a-form-item label="BtPay" name="btPayShowType">
      <a-switch v-model:checked="formModel.btPayShowType" />
      <template #extra>
        <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
      </template>
    </a-form-item>

    <!-- 金流設定（條件顯示） -->
    <template v-if="anyPaymentEnabled">
      <a-divider orientation="left">金流設定</a-divider>

      <a-form-item label="金流模式" name="paymentMode">
        <a-select
          v-model:value="formModel.paymentMode"
          :options="paymentModeOptions"
        />
        <template #extra>
          <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
        </template>
      </a-form-item>

      <a-form-item label="金流倍率" name="topUpRate">
        <a-input-number
          v-model:value="formModel.topUpRate"
          :min="0"
          :precision="0"
          style="width: 100%"
        />
        <template #extra>
          <span style="color: #999; font-size: 12px">此設定可於後續補齊，不影響帳戶建立</span>
        </template>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step8PaymentSettings' });

interface Props {
  formModel: {
    myCardShowType: boolean;
    soNetShowType: boolean;
    nganLuongShowType: boolean;
    moPayShowType: boolean;
    btPayShowType: boolean;
    paymentMode: string;
    topUpRate: number;
  };
}

const props = defineProps<Props>();

const formRef = ref<FormInstance>();

/**
 * 計算是否有任何金流開啟
 */
const anyPaymentEnabled = computed(() => {
  return (
    props.formModel.myCardShowType
    || props.formModel.soNetShowType
    || props.formModel.nganLuongShowType
    || props.formModel.moPayShowType
    || props.formModel.btPayShowType
  );
});

/**
 * 金流模式選項
 */
const paymentModeOptions = [
  { label: 'Real', value: 'Real' },
  { label: 'Fake', value: 'Fake' },
];

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 8 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


