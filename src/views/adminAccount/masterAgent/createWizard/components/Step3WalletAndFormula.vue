<template>
  <a-form
    ref="formRef"
    :model="formModel"
    :label-col="{ span: 6 }"
    :wrapper-col="{ span: 14 }"
  >
    <!-- 錢包設定 -->
    <a-divider orientation="left">錢包設定</a-divider>

    <a-form-item label="單一錢包" name="isSingleWallet">
      <a-radio-group v-model:value="formModel.isSingleWallet">
        <a-radio :value="false">否</a-radio>
        <a-radio :value="true">是</a-radio>
      </a-radio-group>
    </a-form-item>

    <a-form-item
      v-if="formModel.isSingleWallet && isMasterAgent"
      label="單一錢包版本"
      name="singleWallerVersion"
    >
      <a-select v-model:value="formModel.singleWallerVersion" :options="walletVersionOptions" />
    </a-form-item>

    <!-- VIP / 等級 / 活躍值公式（僅 masterAgent） -->
    <template v-if="isMasterAgent">
      <a-divider orientation="left">VIP / 等級 / 活躍值公式</a-divider>

      <a-form-item label="VIP 降級公式" name="vipDowngradeFormula">
        <a-select v-model:value="formModel.vipDowngradeFormula" :options="vipDowngradeOptions" />
      </a-form-item>

      <a-form-item label="等級公式" name="levelFormula">
        <a-select v-model:value="formModel.levelFormula" :options="levelFormulaOptions" />
      </a-form-item>

      <a-form-item label="活躍值公式" name="activityFormulaRatio">
        <a-select v-model:value="formModel.activityFormulaRatio" :options="activityFormulaOptions" />
      </a-form-item>

      <a-form-item label="等級升級所需點數" name="levelUpNeedPoint">
        <a-input-number
          v-model:value="formModel.levelUpNeedPoint"
          :min="0"
          :precision="0"
          style="width: 100%"
        />
      </a-form-item>

      <a-form-item label="啟用排行榜功能" name="isRanking">
        <a-switch v-model:checked="formModel.isRanking" />
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step3WalletAndFormula' });

interface Props {
  formModel: {
    accountType: 'masterAgent' | 'masterAgentX' | undefined;
    isSingleWallet: boolean;
    singleWallerVersion: number;
    vipDowngradeFormula: number;
    levelFormula: number;
    activityFormulaRatio: number;
    levelUpNeedPoint: number;
    isRanking: boolean;
  };
}

const props = defineProps<Props>();

const formRef = ref<FormInstance>();

// 計算是否為 masterAgent
const isMasterAgent = computed(() => props.formModel.accountType === 'masterAgent');

// 選項定義
const walletVersionOptions = [
  { label: 'v1', value: 1 },
  { label: 'v2', value: 2 },
];

const vipDowngradeOptions = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
];

const levelFormulaOptions = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
];

const activityFormulaOptions = [
  { label: '1:100', value: 1 },
  { label: '1:1000', value: 10 },
];

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 3 不需要驗證，所有欄位都有預設值 */
  validate: async () => true,
});
</script>

