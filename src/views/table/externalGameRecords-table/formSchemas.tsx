// ARCH03-01：搜尋模型已由 Vue2 升級為 Vue3
// DynamicTable formSchemas 為搜尋狀態的唯一來源
import type { ComputedRef } from 'vue';
import type { FormSchema } from '@/components/core/schema-form';
import dayjs from 'dayjs';

export interface CreateFormSchemasOptions {
  t: (key: string) => string;
  isAgentDisabled: ComputedRef<boolean>;
  /** 是否顯示代理商欄位（權限等級 < 4 時顯示） */
  showAgentField: ComputedRef<boolean>;
  onExternalPlatformChanged: () => void;
  // 注意：supportPlatforms 和 gameOptions 不再在 formSchemas 初始化時使用
  // 它們通過 updateSchema 動態更新（參照 cashRecord-table）
}

/**
 * ARCH03-01：DynamicTable formSchemas（搜尋狀態的唯一來源）
 */
export function createExternalGameRecordsFormSchemas(
  options: CreateFormSchemasOptions,
): FormSchema[] {
  const {
    t,
    isAgentDisabled,
    showAgentField,
    onExternalPlatformChanged,
  } = options;

  return [
    // 代理選擇器（參照 cashRecord-table：簡化為基本 Select，通過 updateSchema 動態更新）
    {
      field: 'agentID',
      label: '代理',
      component: 'Select',
      required: true,
      colProps: { span: 8 },
      vShow: showAgentField.value, // 條件顯示：權限等級 < 4
      componentProps: {
        options: [], // 初始為空，通過 updateSchema 動態更新（參照 cashRecord-table）
        placeholder: '請選擇代理',
        allowClear: !isAgentDisabled.value,
      },
      formItemProps: {
        rules: [{ required: true, message: t('notify.emptyAgentID') || '代理不可空白' }],
      },
    },
    // 會員搜尋（參照 cashRecord-table：使用 Input）
    {
      field: 'memberID',
      label: '會員',
      component: 'Input',
      colProps: { span: 8 },
      componentProps: {
        placeholder: '會員 ID',
        allowClear: true,
      },
    },
    // 平台選擇器（參照 cashRecord-table：初始為空，通過 updateSchema 動態更新）
    {
      field: 'externalPlatform',
      label: '平台',
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [], // 初始為空，通過 updateSchema 動態更新（參照 cashRecord-table）
        placeholder: '請選擇平台',
        allowClear: true,
        onChange: onExternalPlatformChanged,
      },
    },
    // 遊戲選擇器（參照 cashRecord-table：初始為空，通過 updateSchema 動態更新）
    {
      field: 'gameID',
      label: '遊戲列表',
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [], // 初始為空，通過 updateSchema 動態更新（參照 cashRecord-table）
        placeholder: '請選擇遊戲',
        allowClear: true,
        showSearch: true,
        filterOption: (input: string, option: any) => {
          return (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
        },
      },
    },
    // 查詢時間
    {
      field: 'date',
      label: t('labels.searchTime'),
      component: 'RangePicker',
      colProps: { span: 8 },
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: ['開始時間', '結束時間'],
        style: { width: '100%' },
      },
      defaultValue: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')],
    },
  ];
}
