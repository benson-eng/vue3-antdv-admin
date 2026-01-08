<script lang="ts" setup>
import type { PropType } from 'vue';
import type { ColEx } from '../types/component';
import type { ButtonProps } from '@/components/basic/button';
import { Col, Form } from 'ant-design-vue';
import { computed } from 'vue';
import { BasicArrow } from '@/components/basic/basic-arrow';
import { useI18n } from '@/hooks/useI18n';
import { useFormContext } from '../hooks/useFormContext';

  type ButtonOptions = Partial<ButtonProps> & { text: string; icon?: any };

defineOptions({
  name: 'FormAction',
  inheritAttrs: false,
});

const props = defineProps({
  showActionButtonGroup: {
    type: Boolean,
    default: true,
  },
  showResetButton: {
    type: Boolean,
    default: true,
  },
  showSubmitButton: {
    type: Boolean,
    default: true,
  },
  showAdvancedButton: {
    type: Boolean,
    default: true,
  },
  resetButtonOptions: {
    type: Object as PropType<ButtonOptions>,
    default: () => ({}),
  },
  submitButtonOptions: {
    type: Object as PropType<ButtonOptions>,
    default: () => ({}),
  },
  showFilterButton: {
    type: Boolean,
    default: false,
  },
  filterButtonOptions: {
    type: Object as PropType<ButtonOptions>,
    default: () => ({}),
  },
  actionColOptions: {
    type: Object as PropType<Partial<ColEx>>,
    default: () => ({}),
  },
  actionSpan: {
    type: Number,
    default: 6,
  },
  isAdvanced: Boolean,
  hideAdvanceBtn: Boolean,
});

const emit = defineEmits(['toggleAdvanced']);

// 使用自定義的 useI18n，不傳入 namespace，使用全局翻譯
const { t } = useI18n();
const { resetFields, submit } = useFormContext();
const actionColOpt = computed(() => {
  const { showAdvancedButton, actionSpan: span, actionColOptions } = props;
  const actionSpan = 24 - span;
  const advancedSpanObj = showAdvancedButton ? { span: actionSpan < 6 ? 24 : actionSpan } : {};
  const actionColOpt: Partial<ColEx> = {
    style: { textAlign: 'right' },
    span: showAdvancedButton ? 6 : 4,
    ...advancedSpanObj,
    ...actionColOptions,
  };
  return actionColOpt;
});

const getResetBtnOptions = computed((): ButtonOptions => {
  return Object.assign(
    {
      text: t('common.resetText'),
    },
    props.resetButtonOptions,
  );
});

const getSubmitBtnOptions = computed(() => {
  return Object.assign(
    {
      text: t('common.queryText'),
    },
    props.submitButtonOptions,
  );
});

const getFilterBtnOptions = computed((): ButtonOptions => {
  return Object.assign(
    {
      text: '過濾',
    },
    props.filterButtonOptions,
  );
});

function toggleAdvanced() {
  emit('toggleAdvanced', props.isAdvanced);
}

const handleSubmit = async (e: Event) => {
  await submit(e).catch(() => {});
};
</script>

<template>
  <Col v-if="showActionButtonGroup" v-bind="actionColOpt">
    <div style="width: 100%" :style="{ textAlign: actionColOpt.style.textAlign }">
      <Form.Item>
        <slot name="resetBefore" />
        <a-button
          v-if="showResetButton"
          type="default"
          class="mr-2"
          v-bind="getResetBtnOptions"
          @click="resetFields"
        >
          {{ getResetBtnOptions.text }}
        </a-button>
        <slot name="submitBefore" />

        <a-button
          v-if="showSubmitButton"
          type="primary"
          class="mr-2"
          v-bind="getSubmitBtnOptions"
          @click="handleSubmit($event)"
        >
          {{ getSubmitBtnOptions.text }}
        </a-button>

        <slot name="advanceBefore" />
        <a-button
          v-if="showFilterButton"
          type="default"
          class="mr-2"
          v-bind="getFilterBtnOptions"
        >
          <template v-if="getFilterBtnOptions.icon" #icon>
            <component :is="getFilterBtnOptions.icon" />
          </template>
          {{ getFilterBtnOptions.text }}
        </a-button>
        <a-button
          v-if="showAdvancedButton && !hideAdvanceBtn"
          type="link"
          size="small"
          @click="toggleAdvanced"
        >
          {{ isAdvanced ? t('component.form.putAway') : t('component.form.unfold') }}
          <BasicArrow class="ml-1" :expand="!isAdvanced" />
        </a-button>
        <slot name="advanceAfter" />
      </Form.Item>
    </div>
  </Col>
</template>
