// src/views/adminAccount/currency/formSchemas.ts
import type { FormSchema } from '@/components/core/schema-form';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';

export const baseSchemas: FormSchema[] = [
  {
    field: 'adminAccountId',
    label: '總代理',
    component: 'Select',
    required: true,
    componentProps: {
      placeholder: '請選擇總代理',
      request: async () => {
        const list = await getMasterAgentList();
        return list.map((item) => ({
          label: item.account,
          value: item.id,
        }));
      },
    },
    colProps: { span: 12 },
  },
  {
    field: 'currencyCode',
    component: 'Input',
    label: '貨幣代碼',
    rules: [{ required: true, message: '請輸入貨幣代碼' }],
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
    field: 'currencySymbol',
    component: 'Input',
    label: '貨幣符號',
    colProps: { span: 12 },
  },
];
