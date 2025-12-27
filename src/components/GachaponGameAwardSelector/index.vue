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
    <a-select
      v-if="isCurrencyTypeSelected"
      v-model:value="form.currencyType"
      :placeholder="t('labels.currencyType')"
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
    <a-input-number
      v-if="isCurrencyTypeSelected"
      v-model:value="form.balance"
      :placeholder="t('labels.balance')"
      style="width: 120px; margin-right: 8px"
    />
    <!-- item -->
    <a-select
      v-if="isItemSelected"
      v-model:value="form.itemID"
      :placeholder="t('labels.item')"
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
    <a-select
      v-if="isTokenSelected"
      v-model:value="form.tokenID"
      :placeholder="t('labels.token')"
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
    // 當類型改變時，清空不相關的字段
    if (oldValue && newValue !== oldValue) {
      if (newValue === 'Currency') {
        // 只保留 Currency 相關字段
        form.value = {
          currencyType: form.value.currencyType,
          balance: form.value.balance,
        };
      }
      else if (newValue === 'Treasures') {
        // 只保留 Treasures 相關字段
        form.value = {
          itemID: form.value.itemID,
        };
      }
      else if (newValue === 'Token') {
        // 只保留 Token 相關字段
        form.value = {
          tokenID: form.value.tokenID,
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

