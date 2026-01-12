import type { FormSchema } from '@/components/core/schema-form';
import RolesApi from '@/api/backend/adminAccount/roles';

export interface SubaccountChildFormValues {
  account: string;
  name: string;
  roles: number[];
  allowRedemptionCode?: boolean;
}

// ========== Roles 快取機制 ==========
interface RoleOption {
  label: string;
  value: number;
}

let cachedRoles: RoleOption[] | null = null;
let loadingPromise: Promise<RoleOption[]> | null = null;

/**
 * 載入角色清單（只打一次 API，後續走快取）
 */
export async function loadRolesOnce(): Promise<RoleOption[]> {
  // 如果已有快取，直接回傳
  if (cachedRoles !== null) {
    return cachedRoles;
  }

  // 如果正在載入中，等待載入完成
  if (loadingPromise !== null) {
    return await loadingPromise;
  }

  // 第一次載入
  loadingPromise = (async () => {
    try {
      const res = await RolesApi.getlocalRoles({});
      const roles = res?.roles ?? [];
      cachedRoles = roles.map((r: any) => ({
        label: r.name ? `${r.name}(${r.id})` : String(r.id),
        value: Number(r.id),
      }));
      return cachedRoles;
    }
    catch (error) {
      // 載入失敗時清除 loadingPromise，允許重試
      loadingPromise = null;
      throw error;
    }
  })();

  return await loadingPromise;
}

export const getSubaccountChildSchemas = (rolesOptions?: RoleOption[]): FormSchema<SubaccountChildFormValues>[] => {
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
        ...(rolesOptions ? { options: rolesOptions } : { request: loadRolesOnce }),
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
