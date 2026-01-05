<template>
  <a-form
    ref="formRef"
    :model="localForm"
    layout="vertical"
  >
    <!-- 老虎機結算設定 -->
    <a-divider orientation="left">老虎機結算設定</a-divider>

    <a-form-item label="老虎機等待結算時間（秒）" name="slot_waitingSettleTime">
      <a-input-number
        v-model:value="localForm.slot_waitingSettleTime"
        :min="0"
        :precision="0"
        style="width: 100%"
        :disabled="props.isReadonly"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">以下設定影響老虎機遊戲的結算與安全行為</span>
      </template>
    </a-form-item>

    <a-form-item label="拉彩金位數" name="slot_prizeDecimalPlaces">
      <a-input-number
        v-model:value="localForm.slot_prizeDecimalPlaces"
        :min="0"
        :precision="0"
        style="width: 100%"
        :disabled="props.isReadonly"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">以下設定影響老虎機遊戲的結算與安全行為</span>
      </template>
    </a-form-item>

    <!-- 安全機制（僅 masterAgent） -->
    <template v-if="isMasterAgent">
      <a-divider orientation="left">安全機制</a-divider>

      <a-form-item label="老虎機連結單次有效" name="slot_oneTimeToken">
        <a-switch v-model:checked="localForm.slot_oneTimeToken" :disabled="props.isReadonly" />
        <template #extra>
          <span style="color: #999; font-size: 12px">以下設定影響老虎機遊戲的結算與安全行為</span>
        </template>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step10SlotSettings' });

interface Props {
  formModel: {
    accountType: 'masterAgent' | 'masterAgentX' | undefined;
    slot_waitingSettleTime: number;
    slot_oneTimeToken: boolean;
    slot_prizeDecimalPlaces: number;
  };
  /** 是否為唯讀模式（Level 4 檢視模式） */
  isReadonly?: boolean;
}

const props = defineProps<Props>();

const formRef = ref<FormInstance>();

/**
 * 本地表單副本（用於 readonly 模式下隔離寫入）
 * 在 readonly 模式下，所有變更僅影響 localForm，不會寫回父層
 * 在非 readonly 模式下，變更會同步回父層 formModel
 */
const localForm = reactive<{
  accountType: 'masterAgent' | 'masterAgentX' | undefined;
  slot_waitingSettleTime: number;
  slot_oneTimeToken: boolean;
  slot_prizeDecimalPlaces: number;
}>({
  accountType: props.formModel.accountType,
  slot_waitingSettleTime: props.formModel.slot_waitingSettleTime,
  slot_oneTimeToken: props.formModel.slot_oneTimeToken,
  slot_prizeDecimalPlaces: props.formModel.slot_prizeDecimalPlaces,
});

/**
 * 同步 localForm 到父層 formModel（僅在非 readonly 模式下執行）
 */
const syncToParent = () => {
  if (props.isReadonly) {
    return; // readonly 模式下不寫回父層
  }
  Object.assign(props.formModel, {
    slot_waitingSettleTime: localForm.slot_waitingSettleTime,
    slot_oneTimeToken: localForm.slot_oneTimeToken,
    slot_prizeDecimalPlaces: localForm.slot_prizeDecimalPlaces,
  });
};

/**
 * 從父層 formModel 同步到 localForm（用於初始化或外部更新）
 */
const syncFromParent = () => {
  localForm.accountType = props.formModel.accountType;
  localForm.slot_waitingSettleTime = props.formModel.slot_waitingSettleTime;
  localForm.slot_oneTimeToken = props.formModel.slot_oneTimeToken;
  localForm.slot_prizeDecimalPlaces = props.formModel.slot_prizeDecimalPlaces;
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
    localForm.slot_waitingSettleTime,
    localForm.slot_oneTimeToken,
    localForm.slot_prizeDecimalPlaces,
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
 * 計算是否為 masterAgent
 */
const isMasterAgent = computed(() => localForm.accountType === 'masterAgent');

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 10 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


