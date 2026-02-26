import type { Composer } from 'vue-i18n';
import type { FormSchema } from '@/components/core/schema-form';

type I18nGlobalTranslation = Composer['t'];

/**
 * 取得搜尋表單的 schemas
 *
 * 【搜尋欄位】
 * - isEnabled：啟用狀態篩選（可選欄位）
 *   - 類型：Switch
 *   - 預設值：true（顯示啟用的項目）
 *   - 控制權：DynamicTable 搜尋表單
 *
 * 【注意】
 * - masterAgent 不在搜尋表單中（page-level 控制）
 * - 所有欄位均為可選，無必填欄位
 */
export const getSearchSchemas = (t: I18nGlobalTranslation): FormSchema[] => [
  {
    field: 'isEnabled',
    label: t('columns.isEnabled'),
    component: 'Switch',
    componentProps: {
      checkedChildren: t('labels.enable'),
      unCheckedChildren: t('labels.disable'),
    },
    defaultValue: true, // 預設顯示啟用的項目
  },
];
