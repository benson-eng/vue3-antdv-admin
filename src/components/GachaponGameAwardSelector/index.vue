<template>
  <div class="gachapon-game-award-selector">
    <!-- type -->
    <a-select
      v-model:value="type"
      :placeholder="t('labels.type')"
      allow-clear
      style="width: 120px; margin-right: 8px"
    >
      <a-select-option value="Currency">
        {{ t('awardType.Currency') }}
      </a-select-option>
      <a-select-option value="Treasures">
        {{ t('awardType.Treasures') }}
      </a-select-option>
      <a-select-option value="Token">
        {{ t('awardType.Token') }}
      </a-select-option>
    </a-select>
    <!-- currency type -->
    <!-- Vue3 模式：始終顯示，使用 disabled 控制可用性 -->
    <a-select
      v-model:value="form.currencyType"
      :placeholder="t('labels.currencyType')"
      :disabled="!isCurrencyTypeSelected"
      allow-clear
      style="width: 120px; margin-right: 8px"
    >
      <a-select-option
        v-for="currencyType in currencyTypeList"
        :key="currencyType.value"
        :value="currencyType.value"
      >
        {{ currencyType.name }}
      </a-select-option>
    </a-select>
    <!-- balance -->
    <!-- Vue3 模式：始終顯示，使用 disabled 控制可用性 -->
    <a-input-number
      v-model:value="form.balance"
      :placeholder="t('labels.balance')"
      :disabled="!isCurrencyTypeSelected"
      style="width: 120px; margin-right: 8px"
    />
    <!-- item -->
    <!-- Vue3 模式：始終顯示，使用 disabled 控制可用性 -->
    <a-select
      v-model:value="form.itemID"
      :placeholder="t('labels.item')"
      :disabled="!isItemSelected"
      allow-clear
      style="width: 200px; margin-right: 8px"
    >
      <a-select-option
        v-for="item in treasureItemList"
        :key="item.treasureItemID"
        :value="item.treasureItemID"
      >
        {{ item.itemName }}
      </a-select-option>
    </a-select>
    <!-- token type -->
    <!-- Vue3 模式：始終顯示，使用 disabled 控制可用性 -->
    <a-select
      v-model:value="form.tokenID"
      :placeholder="t('labels.token')"
      :disabled="!isTokenSelected"
      allow-clear
      style="width: 200px; margin-right: 8px"
    >
      <a-select-option
        v-for="item in tokenTypeList"
        :key="item.id"
        :value="item.id"
      >
        {{ item.name }}
      </a-select-option>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import type { TreasureItem } from '@/api/backend/treasureChestSystem';
import type { TokenItem } from '@/api/backend/adminAccount/token';
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/hooks/useI18n';

export type AwardDetails = {
  currencyType?: string;
  balance?: number;
  itemID?: string;
  tokenID?: number;
};

const props = defineProps<{
  treasureItemList: TreasureItem[];
  currencyTypeList: Array<{ name: string; value: string }>;
  tokenTypeList: TokenItem[];
}>();

const emit = defineEmits<{
  (e: 'onAwardDetailChanged', details: AwardDetails): void;
}>();

const { t } = useI18n('component.gachaponGameAwardSelector');

const type = ref<'Currency' | 'Treasures' | 'Token' | ''>('');
const form = ref<AwardDetails>({});

const isCurrencyTypeSelected = computed(() => type.value === 'Currency');
const isItemSelected = computed(() => type.value === 'Treasures');
const isTokenSelected = computed(() => type.value === 'Token');

const clear = () => {
  type.value = '';
  form.value = {};
};

const emitAwardDetail = () => {
  let details: AwardDetails = {};
  if (type.value === 'Currency') {
    details = { currencyType: form.value.currencyType, balance: form.value.balance };
  }
  else if (type.value === 'Treasures') {
    details = { itemID: form.value.itemID };
  }
  else if (type.value === 'Token') {
    details = { tokenID: form.value.tokenID };
  }
  emit('onAwardDetailChanged', details);
};

watch(
  form,
  () => {
    emitAwardDetail();
  },
  { deep: true },
);

watch(type, (newValue, oldValue) => {
  if (newValue === '') {
    clear();
  }
  else {
    // Vue3 模式：當類型改變時，清空不相關的字段（欄位始終顯示，但會被 disabled）
    if (oldValue && newValue !== oldValue) {
      if (newValue === 'Currency') {
        // 只保留 Currency 相關字段，清空其他字段
        form.value = {
          currencyType: form.value.currencyType,
          balance: form.value.balance,
          itemID: undefined,
          tokenID: undefined,
        };
      }
      else if (newValue === 'Treasures') {
        // 只保留 Treasures 相關字段，清空其他字段
        form.value = {
          itemID: form.value.itemID,
          currencyType: undefined,
          balance: undefined,
          tokenID: undefined,
        };
      }
      else if (newValue === 'Token') {
        // 只保留 Token 相關字段，清空其他字段
        form.value = {
          tokenID: form.value.tokenID,
          currencyType: undefined,
          balance: undefined,
          itemID: undefined,
        };
      }
    }
    emitAwardDetail();
  }
});
</script>

<style lang="less" scoped>
.gachapon-game-award-selector {
  display: flex;
  width: 400px;
  flex-wrap: nowrap;
  align-items: center;
}
</style>

