import type { FormSchema } from '@/components/core/schema-form/';

export interface MemberFormDto {
  account: string;
  password?: string;
  memberLevel: string;
  vipLevel?: string;
  superior?: string;
  status: number;
}

export const baseSchemas: FormSchema<MemberFormDto>[] = [
  {
    field: 'account',
    component: 'Input',
    label: '會員帳號',
    rules: [{ required: true, message: '請輸入會員帳號' }],
  },
  {
    field: 'password',
    component: 'InputPassword',
    label: '密碼',
    rules: [{ required: true, message: '請輸入密碼' }],
  },
  {
    field: 'memberLevel',
    component: 'Select',
    label: '會員層級',
    rules: [{ required: true, message: '請選擇會員層級' }],
    componentProps: {
      options: [
        { label: '金流內層', value: '金流內層' },
        { label: '金流全開', value: '金流全開' },
        { label: '大額入款', value: '大額入款' },
        { label: '套利總級', value: '套利總級' },
        { label: '疑似套利', value: '疑似套利' },
      ],
    },
  },
  {
    field: 'vipLevel',
    component: 'Select',
    label: 'VIP等級',
    componentProps: {
      options: [
        { label: 'VIP2', value: 'VIP2' },
        { label: 'VIP8', value: 'VIP8' },
        { label: '一般會員', value: '一般會員' },
      ],
    },
  },
  {
    field: 'superior',
    component: 'Input',
    label: '上級代理',
    componentProps: {
      placeholder: '請輸入上級代理帳號',
    },
  },
  {
    field: 'status',
    component: 'RadioGroup',
    label: '狀態',
    defaultValue: 1,
    componentProps: {
      options: [
        { label: '啟用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  },
];
