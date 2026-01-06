<template>
  <div class="chain-selector">
    <!-- root level -->
    <template
      v-for="(rootValue, rootKey) in schema"
      :key="rootKey"
    >
      <div class="inline-element">
        <label class="txt-label">{{ rootValue.label }}</label>
        <a-select
          v-model:value="selectedValue[rootKey]"
          class="select-element"
          allow-clear
          @change="handleRootChange(rootKey, $event)"
        >
          <a-select-option
            v-for="(chainValue, chainKey) in rootValue.value"
            :key="chainKey"
            :value="chainKey"
          >
            {{ getKeyI18n(chainKey) }}
          </a-select-option>
        </a-select>
      </div>

      <!-- child level (動態顯示) -->
      <template
        v-for="(childValue, childKey) in getChildSchema(rootKey)"
        :key="childKey"
      >
        <div class="inline-element">
          <label class="txt-label">{{ childValue.label }}</label>
          <a-select
            v-model:value="selectedValue[childKey]"
            class="select-element"
            allow-clear
          >
            <a-select-option
              v-for="input in childValue.values"
              :key="input.value"
              :value="input.value"
            >
              {{ input.label }}
            </a-select-option>
          </a-select>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  schema: {
    [key: string]: {
      label: string;
      value: {
        [key: string]: {
          [key: string]: {
            label: string;
            values: Array<{ value: string; label: string }>;
          };
        };
      };
    };
  };
  keyLabelI18nMap?: Map<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  keyLabelI18nMap: () => new Map(),
});

const emit = defineEmits<{
  (e: 'handleSelectedValue', value: Record<string, any>): void;
}>();

const selectedValue = ref<Record<string, any>>({});

const getKeyI18n = (key: string): string => {
  return props.keyLabelI18nMap?.get(key) || key;
};

const handleRootChange = (rootKey: string, value: string | null) => {
  // 清除子層選擇
  const keys = Object.keys(selectedValue.value);
  keys.forEach((key) => {
    if (key !== rootKey) {
      delete selectedValue.value[key];
    }
  });

  if (value) {
    selectedValue.value[rootKey] = value;
  }
  else {
    delete selectedValue.value[rootKey];
  }
};

const getChildSchema = (rootKey: string) => {
  if (!selectedValue.value[rootKey]) {
    return {};
  }
  const rootSchema = props.schema[rootKey];
  if (!rootSchema) {
    return {};
  }
  const selectedRootValue = selectedValue.value[rootKey];
  return rootSchema.value[selectedRootValue] || {};
};

// 監聽選擇變化
watch(
  () => selectedValue.value,
  (newValue) => {
    emit('handleSelectedValue', { ...newValue });
  },
  { deep: true },
);
</script>

<style lang="less" scoped>
.chain-selector {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.inline-element {
  display: inline-block;
  padding: 10px;
}

.txt-label {
  display: inline-block;
  width: 100px;
  text-align: center;
  margin-right: 8px;
}

.select-element {
  width: 200px;
}
</style>


