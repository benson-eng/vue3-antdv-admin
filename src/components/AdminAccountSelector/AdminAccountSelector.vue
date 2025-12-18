<template>
    <a-select
      v-model:value="innerValue"
      :options="options"
      :disabled="disabled"
      :placeholder="placeholder"
      allow-clear
      style="width: 100%"
    />
  </template>
  
<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import type { AdminAccountItem } from '@/api/backend/adminAccount/admin';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';

/**
 * props
 * valueType:
 *  - 'id'      => 回傳 adminAccountId:number（表單用，預設）
 *  - 'account' => 回傳 masterAgent:string（查詢用）
 */
const props = defineProps<{
  modelValue?: number | string;
  valueType?: 'id' | 'account';
  disabled?: boolean;
  placeholder?: string;
  autoSelectFirst?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value?: number | string): void;
  (e: 'update:selectedAgent', value?: AdminAccountItem): void;
}>();

/** 預設輸出型別 */
const valueType = computed(() => props.valueType ?? 'id');

/** 內部綁定值（AntD Select 不接受 null） */
const innerValue = ref<number | string | undefined>(undefined);

/** 目前 Master Agent 清單 */
const agentList = ref<AdminAccountItem[]>([]);

/** 選項 */
const options = ref<
  Array<{
    label: string;
    value: number | string;
  }>
>([]);

const updateSelectedAgent = (value?: number | string) => {
  const agent = agentList.value.find((item) =>
    valueType.value === 'id' ? item.id === value : item.account === value,
  );
  emit('update:selectedAgent', agent);
};

/** 同步外部 v-model → 內部 */
watch(
  () => props.modelValue,
  (val) => {
    innerValue.value = val;
  },
  { immediate: true },
);

/** 同步內部 → 外部 v-model */
watch(
  innerValue,
  (val) => {
    emit('update:modelValue', val);
    updateSelectedAgent(val);
  },
  { immediate: true },
);

onMounted(async () => {
  const list = await getMasterAgentList();
  /**
   * list: { id: number; account: string }[]
   */
  agentList.value = list;
  options.value = list.map((item) => ({
    label: item.account,
    value: valueType.value === 'id' ? item.id : item.account,
  }));

  // 自動選第一個
  if (
    props.autoSelectFirst &&
    innerValue.value === undefined &&
    options.value.length > 0
  ) {
    innerValue.value = options.value[0].value;
  }
  updateSelectedAgent(innerValue.value);
});
</script>
  