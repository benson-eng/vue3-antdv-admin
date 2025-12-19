import type { FormSchema } from '@/components/core/schema-form';
import RolesApi from '@/api/backend/adminAccount/roles';

export type ShareholderFormValues = {
  account: string;
  name: string;
  roles: number[];
};

export const baseSchemas: FormSchema<ShareholderFormValues>[] = [
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
    componentProps: {
      mode: 'multiple',
      placeholder: '請選擇角色',
      request: async () => {
        const res = await RolesApi.getlocalRoles({});
        const roles = res?.roles ?? [];
        return roles.map((r: any) => ({
          label: r.name,
          value: r.id,
        }));
      },
    },
  },
];
