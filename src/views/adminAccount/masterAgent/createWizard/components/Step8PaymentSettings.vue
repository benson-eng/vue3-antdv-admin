<!-- eslint-disable vue/no-mutating-props -->
<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
// 注意：父組件使用 reactive 創建 formModel，此組件作為表單子組件需要直接修改 props
// 以保持響應式綁定，這是 Vue 3 中 reactive 對象的常見使用模式
import type { FormInstance } from 'ant-design-vue';
import { ref } from 'vue';

defineOptions({ name: 'Step8PaymentSettings' });

defineProps<Props>();

interface Props {
  formModel: {
    myCard_facServiceID: string;
    myCard_secretKey: string;
    myCard_allowIPs: string;
    myCard_topUpSecretKeyA: string;
    myCard_topUpSecretKeyB: string;
    myCard_topUpFacId: string;
    paymentMode?: string;
    topUpRate?: number;
    myCardWebsite?: string;
    myCardRedirectVerifyWebsite?: string;
    myCardCallbackDomain?: string;
  };
}

const formRef = ref<FormInstance>();

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 8 不需要驗證，所有欄位都是選填 */
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
    <!-- 金流設定 -->
    <a-divider orientation="left">
      金流設定
    </a-divider>

    <a-form-item label="支付模式" name="paymentMode">
      <a-select
        v-model:value="formModel.paymentMode"
        style="width: 100%"
      >
        <a-select-option value="Real">
          Real
        </a-select-option>
        <a-select-option value="Fake">
          Fake
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item label="儲值比例" name="topUpRate">
      <a-input-number
        v-model:value="formModel.topUpRate"
        :min="0"
        :precision="0"
        style="width: 100%"
        placeholder="請輸入儲值比例"
      />
    </a-form-item>

    <a-form-item label="mycard網域" name="myCardWebsite">
      <a-input
        v-model:value="formModel.myCardWebsite"
        placeholder="請輸入 mycard網域"
      />
    </a-form-item>

    <a-form-item label="返回的網址" name="myCardRedirectVerifyWebsite">
      <a-input
        v-model:value="formModel.myCardRedirectVerifyWebsite"
        placeholder="請輸入返回的網址"
      />
    </a-form-item>

    <a-form-item label="callbackDomain" name="myCardCallbackDomain">
      <a-input
        v-model:value="formModel.myCardCallbackDomain"
        placeholder="請輸入 callbackDomain"
      />
    </a-form-item>
    <!-- Level 2 欄位 -->
    <a-form-item label="MyCard FacServiceID" name="myCard_facServiceID">
      <a-input
        v-model:value="formModel.myCard_facServiceID"
        placeholder="請輸入 MyCard FacServiceID"
      />
    </a-form-item>

    <a-form-item label="MyCard 廠商Key" name="myCard_secretKey">
      <a-input
        v-model:value="formModel.myCard_secretKey"
        placeholder="請輸入 MyCard 廠商Key"
      />
    </a-form-item>

    <a-form-item label="MyCard正式環境IP提供" name="myCard_allowIPs">
      <a-input
        v-model:value="formModel.myCard_allowIPs"
        placeholder="請輸入 MyCard 正式環境 IP 提供"
      />
    </a-form-item>

    <a-form-item label="MyCard Key1" name="myCard_topUpSecretKeyA">
      <a-input
        v-model:value="formModel.myCard_topUpSecretKeyA"
        placeholder="請輸入 MyCard Key1"
      />
    </a-form-item>

    <a-form-item label="MyCardKey2" name="myCard_topUpSecretKeyB">
      <a-input
        v-model:value="formModel.myCard_topUpSecretKeyB"
        placeholder="請輸入 MyCard Key2"
      />
    </a-form-item>

    <a-form-item label="MyCard FatoryId" name="myCard_topUpFacId">
      <a-input
        v-model:value="formModel.myCard_topUpFacId"
        placeholder="請輸入 MyCard FatoryId"
      />
    </a-form-item>
  </a-form>
</template>
