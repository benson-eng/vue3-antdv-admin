import type { FormSchema } from '@/components/core/schema-form/';

export const baseSchemas: FormSchema[] = [
  {
    field: 'account',
    component: 'Input',
    label: '帳號',
    rules: [{ required: true, message: '請輸入帳號' }],
    colProps: { span: 12 },
  },
  {
    field: 'currencyCode',
    component: 'Input',
    label: '貨幣代碼',
    colProps: { span: 12 },
  },
  {
    field: 'currencyName',
    component: 'Input',
    label: '貨幣名稱',
    rules: [{ required: true, message: '請輸入貨幣名稱' }],
    colProps: { span: 12 },
  },
  {
    field: 'status',
    component: 'Select',
    label: '狀態',
    defaultValue: 1,
    componentProps: {
      options: [
        { label: '啟用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    colProps: { span: 12 },
  },
  {
    field: 'orderNo',
    component: 'InputNumber',
    label: '排序',
    componentProps: {
      min: 0,
      placeholder: '數字越小越靠前',
    },
    colProps: { span: 12 },
  },
];
