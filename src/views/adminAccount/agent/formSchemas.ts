import type { FormSchema } from '@/components/core/schema-form';
import RolesApi from '@/api/backend/adminAccount/roles';

export interface AgentFormValues {
  account: string;
  name: string;
  prefix: string;
  roles: number[];
  website?: string;
  hashKey?: string;
  apiDomain?: string;
  whiteIPList?: string;
}

export const getAgentSchemas = (opts: { canEditApiSettings: boolean }): FormSchema<AgentFormValues>[] => {
  return [
    {
      field: 'account',
      component: 'Input',
      label: '帳號',
      rules: [{ required: true, message: '請輸入帳號' }],
      colProps: { span: 12 },
    },
    {
      field: 'name',
      component: 'Input',
      label: '名稱',
      rules: [{ required: true, message: '請輸入名稱' }],
      colProps: { span: 12 },
    },
    {
      field: 'prefix',
      component: 'Input',
      label: '前綴',
      rules: [{ required: true, message: '請輸入前綴' }],
      colProps: { span: 12 },
    },
    {
      field: 'roles',
      component: 'Select',
      label: '角色',
      rules: [{ required: true, type: 'array', message: '請至少選擇一個角色' }],
      colProps: { span: 12 },
      componentProps: {
        mode: 'multiple',
        placeholder: '請選擇角色',
        request: async () => {
          const res = await RolesApi.getlocalRoles({});
          const roles = res?.roles ?? [];
          return roles.map((r: any) => ({ label: r.name, value: r.id }));
        },
      },
    },
    {
      field: 'website',
      component: 'Input',
      label: 'Website',
      colProps: { span: 12 },
      componentProps: {
        placeholder: '請輸入 website（不可含 http/https；會自動加上 -masterAgent）',
        disabled: !opts.canEditApiSettings,
      },
    },
    {
      field: 'hashKey',
      component: 'InputPassword',
      label: 'HashKey',
      colProps: { span: 12 },
      componentProps: {
        placeholder: '請輸入 hashKey',
        disabled: !opts.canEditApiSettings,
      },
    },
    {
      field: 'apiDomain',
      component: 'Input',
      label: 'API Domain',
      colProps: { span: 12 },
      componentProps: {
        placeholder: '請輸入 API Domain',
        disabled: !opts.canEditApiSettings,
      },
    },
    {
      field: 'whiteIPList',
      component: 'Input',
      label: 'White IP List',
      colProps: { span: 12 },
      componentProps: {
        placeholder: '請輸入 White IP List（長度 ≤ 255）',
        disabled: !opts.canEditApiSettings,
      },
    },
  ];
};

export const passwordSchemas: FormSchema[] = [
  {
    field: 'newPassword',
    label: '新密碼',
    component: 'InputPassword',
    rules: [{ required: true, message: '請輸入新密碼' }],
    componentProps: {
      placeholder: '請輸入新密碼',
    },
  },
];


