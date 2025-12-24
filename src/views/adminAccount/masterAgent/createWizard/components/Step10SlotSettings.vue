<template>
  <a-form
    ref="formRef"
    :model="formModel"
    layout="vertical"
  >
    <!-- 老虎機結算設定 -->
    <a-divider orientation="left">老虎機結算設定</a-divider>

    <a-form-item label="老虎機等待結算時間（秒）" name="slot_waitingSettleTime">
      <a-input-number
        v-model:value="formModel.slot_waitingSettleTime"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">以下設定影響老虎機遊戲的結算與安全行為</span>
      </template>
    </a-form-item>

    <a-form-item label="拉彩金位數" name="slot_prizeDecimalPlaces">
      <a-input-number
        v-model:value="formModel.slot_prizeDecimalPlaces"
        :min="0"
        :precision="0"
        style="width: 100%"
      />
      <template #extra>
        <span style="color: #999; font-size: 12px">以下設定影響老虎機遊戲的結算與安全行為</span>
      </template>
    </a-form-item>

    <!-- 安全機制（僅 masterAgent） -->
    <template v-if="isMasterAgent">
      <a-divider orientation="left">安全機制</a-divider>

      <a-form-item label="老虎機連結單次有效" name="slot_oneTimeToken">
        <a-switch v-model:checked="formModel.slot_oneTimeToken" />
        <template #extra>
          <span style="color: #999; font-size: 12px">以下設定影響老虎機遊戲的結算與安全行為</span>
        </template>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FormInstance } from 'ant-design-vue';

defineOptions({ name: 'Step10SlotSettings' });

interface Props {
  formModel: {
    accountType: 'masterAgent' | 'masterAgentX' | undefined;
    slot_waitingSettleTime: number;
    slot_oneTimeToken: boolean;
    slot_prizeDecimalPlaces: number;
  };
}

const props = defineProps<Props>();

const formRef = ref<FormInstance>();

/**
 * 計算是否為 masterAgent
 */
const isMasterAgent = computed(() => props.formModel.accountType === 'masterAgent');

// 暴露方法給父元件
defineExpose({
  formRef,
  /** Step 10 不需要驗證，所有欄位都是選填 */
  validate: async () => true,
});
</script>


