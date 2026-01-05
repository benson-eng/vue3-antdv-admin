<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';
import { onMounted, reactive, ref, watch } from 'vue';

defineOptions({ name: 'Step8PaymentSettings' });

const props = defineProps<Props>();

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
}>({
  myCard_facServiceID: props.formModel.myCard_facServiceID,
  myCard_secretKey: props.formModel.myCard_secretKey,
  myCard_allowIPs: props.formModel.myCard_allowIPs,
  myCard_topUpSecretKeyA: props.formModel.myCard_topUpSecretKeyA,
  myCard_topUpSecretKeyB: props.formModel.myCard_topUpSecretKeyB,
  myCard_topUpFacId: props.formModel.myCard_topUpFacId,
  paymentMode: props.formModel.paymentMode,
  topUpRate: props.formModel.topUpRate,
  myCardWebsite: props.formModel.myCardWebsite,
  myCardRedirectVerifyWebsite: props.formModel.myCardRedirectVerifyWebsite,
  myCardCallbackDomain: props.formModel.myCardCallbackDomain,
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  Object.assign(props.formModel, {
    myCard_facServiceID: localForm.myCard_facServiceID,
    myCard_secretKey: localForm.myCard_secretKey,
    myCard_allowIPs: localForm.myCard_allowIPs,
    myCard_topUpSecretKeyA: localForm.myCard_topUpSecretKeyA,
    myCard_topUpSecretKeyB: localForm.myCard_topUpSecretKeyB,
    myCard_topUpFacId: localForm.myCard_topUpFacId,
    paymentMode: localForm.paymentMode,
    topUpRate: localForm.topUpRate,
    myCardWebsite: localForm.myCardWebsite,
    myCardRedirectVerifyWebsite: localForm.myCardRedirectVerifyWebsite,
    myCardCallbackDomain: localForm.myCardCallbackDomain,
  });
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.myCard_facServiceID = props.formModel.myCard_facServiceID;
  localForm.myCard_secretKey = props.formModel.myCard_secretKey;
  localForm.myCard_allowIPs = props.formModel.myCard_allowIPs;
  localForm.myCard_topUpSecretKeyA = props.formModel.myCard_topUpSecretKeyA;
  localForm.myCard_topUpSecretKeyB = props.formModel.myCard_topUpSecretKeyB;
  localForm.myCard_topUpFacId = props.formModel.myCard_topUpFacId;
  localForm.paymentMode = props.formModel.paymentMode;
  localForm.topUpRate = props.formModel.topUpRate;
  localForm.myCardWebsite = props.formModel.myCardWebsite;
  localForm.myCardRedirectVerifyWebsite = props.formModel.myCardRedirectVerifyWebsite;
  localForm.myCardCallbackDomain = props.formModel.myCardCallbackDomain;
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
    localForm.myCard_facServiceID,
    localForm.myCard_secretKey,
    localForm.myCard_allowIPs,
    localForm.myCard_topUpSecretKeyA,
    localForm.myCard_topUpSecretKeyB,
    localForm.myCard_topUpFacId,
    localForm.paymentMode,
    localForm.topUpRate,
    localForm.myCardWebsite,
    localForm.myCardRedirectVerifyWebsite,
    localForm.myCardCallbackDomain,
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
  /** Step 8 不需要驗證，所有欄位都是選填 */
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
    <!-- 金流設定 -->
    <a-divider orientation="left">
      金流設定
    </a-divider>

    <!-- Level 2 欄位 -->
    <a-form-item label="MyCard FacServiceID" name="myCard_facServiceID">
      <a-input
        v-model:value="localForm.myCard_facServiceID"
        placeholder="請輸入 MyCard FacServiceID"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="MyCard 廠商Key" name="myCard_secretKey">
      <a-input
        v-model:value="localForm.myCard_secretKey"
        placeholder="請輸入 MyCard 廠商Key"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="MyCard正式環境IP提供" name="myCard_allowIPs">
      <a-input
        v-model:value="localForm.myCard_allowIPs"
        placeholder="請輸入 MyCard 正式環境 IP 提供"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="MyCard Key1" name="myCard_topUpSecretKeyA">
      <a-input
        v-model:value="localForm.myCard_topUpSecretKeyA"
        placeholder="請輸入 MyCard Key1"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="MyCardKey2" name="myCard_topUpSecretKeyB">
      <a-input
        v-model:value="localForm.myCard_topUpSecretKeyB"
        placeholder="請輸入 MyCard Key2"
        :disabled="props.isReadonly"
      />
    </a-form-item>

    <a-form-item label="MyCard FatoryId" name="myCard_topUpFacId">
      <a-input
        v-model:value="localForm.myCard_topUpFacId"
        placeholder="請輸入 MyCard FatoryId"
        :disabled="props.isReadonly"
      />
    </a-form-item>
  </a-form>
</template>
