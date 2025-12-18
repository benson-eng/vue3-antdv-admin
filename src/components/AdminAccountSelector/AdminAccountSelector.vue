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
  }>();
  
  /** 預設輸出型別 */
  const valueType = computed(() => props.valueType ?? 'id');
  
  /** 內部綁定值（AntD Select 不接受 null） */
  const innerValue = ref<number | string | undefined>(undefined);
  
  /** 選項 */
  const options = ref<
    Array<{
      label: string;
      value: number | string;
    }>
  >([]);
  
  /** 同步外部 v-model → 內部 */
  watch(
    () => props.modelValue,
    (val) => {
      innerValue.value = val;
    },
    { immediate: true }
  );
  
  /** 同步內部 → 外部 v-model */
  watch(innerValue, (val) => {
    emit('update:modelValue', val);
  });
  
  onMounted(async () => {
    const list = await getMasterAgentList();
    /**
     * list: { id: number; account: string }[]
     */
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
  });
  </script>
  