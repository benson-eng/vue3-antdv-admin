// src/views/adminSystem/cashRecord-table/formSchemas.tsx
import type { FormSchema } from '@/components/core/schema-form';

export const cashRecordSearchSchemas: FormSchema[] = [
  {
    field: 'agentID',
    label: '代理',
    component: 'Select',
    required: true,
    colProps: { span: 8 },
    componentProps: {
      options: [],
      placeholder: '請選擇代理',
      allowClear: false,
    },
  },
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
  {
    field: 'memberIDstr',
    label: '帳號',
    component: 'Input',
    colProps: { span: 8 },
    componentProps: {
      placeholder: '帳號只可輸入英數字',
    },
  },
  {
    field: 'currency',
    label: '幣別',
    component: 'Select',
    required: true,
    colProps: { span: 8 },
    componentProps: {
      options: [],
      placeholder: '請選擇幣別',
    },
  },
  {
    field: 'dateRange',
    label: '交易時間',
    component: 'RangePicker',
    required: true,
    colProps: { span: 8 },
    componentProps: {
      showTime: true,
      allowClear: false,
      format: 'YYYY-MM-DD HH:mm:ss',
    },
  },
  {
    field: 'remitno',
    label: '交易單號',
    component: 'Input',
    colProps: { span: 8 },
  },
  {
    field: 'type',
    label: '類別',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      options: [],
      placeholder: '請選擇類別',
      allowClear: true,
    },
  },
  {
    field: 'subType',
    label: '子類別',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      options: [],
      placeholder: '請選擇子類別',
      allowClear: true,
    },
  },
  {
    field: 'source',
    label: '來源',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      options: [],
      placeholder: '請選擇來源',
      allowClear: true,
    },
  },
  {
    field: 'sourceStatus',
    label: '來源狀態',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      options: [],
      placeholder: '請選擇來源狀態',
      allowClear: true,
    },
  },
];
