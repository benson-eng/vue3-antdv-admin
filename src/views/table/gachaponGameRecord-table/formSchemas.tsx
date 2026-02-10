import type { ComputedRef, Ref } from 'vue';
import type { FormSchema } from '@/components/core/schema-form';
import dayjs from 'dayjs';

export interface CreateFormSchemasOptions {
  t: (key: string) => string;
  isAgentDisabled: ComputedRef<boolean>;
  onAgentChanged: (val: string) => void;
  /**
   * 消耗相關選項列表
   */
  currencyTypeList: Ref<Array<{ name: string; value: string }>>;
  treasureItemList: Ref<Array<{ treasureItemID: string; itemName: string }>>;
  tokenList: Ref<Array<{ id: number; name: string }>>;
  /**
   * 類型切換處理函數
   */
  onSpendingTypeChanged?: (val: string) => void;
  onGainTypeChanged?: (val: string) => void;
}

/**
 * ARCH03-01：DynamicTable formSchemas（搜尋狀態的唯一來源）
 * Phase R-1：消耗和獲得相關欄位（僅作為 hidden field 儲存，不在搜尋區顯示）
 */
export function createGachaponGameRecordFormSchemas(
  options: CreateFormSchemasOptions,
): FormSchema[] {
  const {
    t,
    isAgentDisabled,
    onAgentChanged,
    // currencyTypeList, treasureItemList, tokenList 用於類型檢查，實際選項通過 updateSchema 動態更新
    onSpendingTypeChanged,
    onGainTypeChanged,
  } = options;

  // 參照 cashRecord-table：formSchemas 為靜態定義，動態值通過 updateSchema 更新

  return [
    // 代理商選擇器
    // 參照 cashRecord-table：初始值為空，通過 updateSchema 動態更新
    // 注意：cashRecord-table 中沒有 vIf 條件，agentID 欄位總是顯示
    {
      field: 'agentID',
      label: t('labels.agent'),
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [], // 初始為空，通過 fetchAgentList 後的 updateSchema 更新
        disabled: isAgentDisabled.value,
        placeholder: t('labels.agentPlaceholder'),
        allowClear: !isAgentDisabled.value,
        onChange: onAgentChanged,
      },
      formItemProps: {
        rules: [{ required: true, message: t('notify.masterAgentAndAgentFieldMissed') }],
      },
    },
    // 會員搜尋（remote search）
    // 參照 cashRecord-table：初始值為空，通過 updateSchema 動態更新
    {
      field: 'memberID',
      label: t('labels.member'),
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        showSearch: true,
        filterOption: false,
        options: [], // 初始為空，通過 fetchMemberOptions 後的 updateSchema 更新
        loading: false, // 初始為 false，通過 updateSchema 更新
        disabled: true, // 初始為 disabled，選擇代理後通過 updateSchema 更新
        placeholder: t('labels.memberPlaceholder'),
        allowClear: true,
        // onSearch、onPopupScroll、onChange 將在 index.vue 中通過 updateSchema 設置
      },
    },
    // 活動ID
    {
      field: 'eventID',
      label: t('labels.eventID'),
      component: 'Input',
      colProps: { span: 8 },
      componentProps: {
        allowClear: true,
      },
    },
    // ============ 花費相關欄位 ============
    // 花費種類
    {
      field: 'spendingType',
      label: t('labels.spendingType'),
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [
          { label: t('awardType.Currency'), value: 'Currency' },
          { label: t('awardType.Treasures'), value: 'Treasures' },
          { label: t('awardType.Token'), value: 'Token' },
        ],
        placeholder: t('labels.spendingType'),
        allowClear: true,
        onChange: onSpendingTypeChanged,
      },
    },
    // 花費項目（根據種類顯示不同的選項：幣別/道具/代幣）
    {
      field: 'spendingItem',
      label: t('labels.spendingItem'),
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [], // 初始為空，通過 updateSchema 動態更新
        placeholder: t('labels.spendingItem'),
        allowClear: true,
        disabled: true, // 初始禁用，通過 updateSchema 動態更新
        style: { width: '100%' },
      },
    },
    // 花費數量
    {
      field: 'spendingAmount',
      label: t('labels.spendingAmount'),
      component: 'InputNumber',
      colProps: { span: 8 },
      componentProps: {
        placeholder: t('labels.spendingAmount'),
        min: 0,
        disabled: true, // 初始禁用，通過 updateSchema 動態更新
        style: { width: '100%' },
      },
    },
    // 隱藏欄位：用於 API 傳遞
    {
      field: 'spendingCurrencyType',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    {
      field: 'spendingBalance',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    {
      field: 'spendingItemID',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    {
      field: 'spendingTokenID',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    // ============ 獲得相關欄位 ============
    // 獲得種類
    {
      field: 'gainType',
      label: t('labels.gainType'),
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [
          { label: t('awardType.Currency'), value: 'Currency' },
          { label: t('awardType.Treasures'), value: 'Treasures' },
          { label: t('awardType.Token'), value: 'Token' },
        ],
        placeholder: t('labels.gainType'),
        allowClear: true,
        onChange: onGainTypeChanged,
      },
    },
    // 獲得項目（根據種類顯示不同的選項：幣別/道具/代幣）
    {
      field: 'gainItem',
      label: t('labels.gainItem'),
      component: 'Select',
      colProps: { span: 8 },
      componentProps: {
        options: [], // 初始為空，通過 updateSchema 動態更新
        placeholder: t('labels.gainItem'),
        allowClear: true,
        disabled: true, // 初始禁用，通過 updateSchema 動態更新
        style: { width: '100%' },
      },
    },
    // 獲得數量
    {
      field: 'gainAmount',
      label: t('labels.gainAmount'),
      component: 'InputNumber',
      colProps: { span: 8 },
      componentProps: {
        placeholder: t('labels.gainAmount'),
        min: 0,
        disabled: true, // 初始禁用，通過 updateSchema 動態更新
        style: { width: '100%' },
      },
    },
    // 隱藏欄位：用於 API 傳遞
    {
      field: 'gainCurrencyType',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    {
      field: 'gainBalance',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    {
      field: 'gainItemID',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    {
      field: 'gainTokenID',
      label: '',
      component: 'Input',
      colProps: { span: 0 },
      componentProps: {
        style: { display: 'none' },
      },
      vShow: false,
    },
    // 遊玩時間
    {
      field: 'playDateTime',
      label: t('labels.playDateTime'),
      component: 'RangePicker',
      colProps: { span: 8 },
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: [t('datePicker.startDate'), t('datePicker.dueDate')],
        style: { width: '100%' },
      },
      defaultValue: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')],
    },
  ];
}
