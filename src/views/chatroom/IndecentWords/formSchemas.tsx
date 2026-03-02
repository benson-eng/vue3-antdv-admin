import type { FormSchema } from '@/components/core/schema-form';

/**
 * 表單 Schema 定義
 * 目前此頁面使用自定義 Dialog，此文件為未來可能的表單需求預留
 */

export interface IndecentWordsFormValues {
  setString: string;
  content: Array<{
    ori: string;
    value: string;
    status: string;
  }>;
}

/**
 * 取得不雅字表單 Schema
 * @param pt - i18n 翻譯函數
 */
export const getIndecentWordsSchemas = (pt?: (key: string) => string): FormSchema<IndecentWordsFormValues>[] => {
  const _pt = pt || ((key: string) => key);
  
  return [
    {
      field: 'setString',
      component: 'Input',
      label: _pt('labels.setString'),
      rules: [
        {
          required: true,
          message: `請輸入${_pt('labels.setString')}`,
        },
      ],
      componentProps: {
        placeholder: `請輸入${_pt('labels.setString')}`,
        autocomplete: 'off',
      },
    },
  ];
};
