import type { FormSchema } from '@/components/core/schema-form';
import RolesApi from '@/api/backend/adminAccount/roles';

export interface SubaccountChildFormValues {
  account: string;
  name: string;
  roles: number[];
  allowRedemptionCode?: boolean;
}

export const getSubaccountChildSchemas = (): FormSchema<SubaccountChildFormValues>[] => {
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
      field: 'roles',
      component: 'Select',
      label: '角色',
      rules: [{ required: true, type: 'array', message: '請至少選擇一個角色' }],
      colProps: { span: 24 },
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
      field: 'allowRedemptionCode',
      component: 'Switch',
      label: '兌換碼功能',
      defaultValue: false,
      colProps: { span: 12 },
      componentProps: {
        checkedChildren: '啟用',
        unCheckedChildren: '停用',
      },
    },
  ];
};

export const passwordSchemas: FormSchema[] = [
  {
    field: 'newPassword',
    label: '新密碼',
    component: 'InputPassword',
    rules: [
      { required: true, message: '請輸入新密碼' },
      { min: 6, message: '密碼長度至少 6 碼' },
    ],
    componentProps: {
      placeholder: '請輸入新密碼',
    },
  },
];
