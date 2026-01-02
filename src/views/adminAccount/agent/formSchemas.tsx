import type { FormSchema } from '@/components/core/schema-form';
import { Button } from 'ant-design-vue';
import { h } from 'vue';
import RolesApi from '@/api/backend/adminAccount/roles';

// ========== Roles 快取機制（Step 1） ==========
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

/**
 * 取得目前快取的角色選項（不觸發 API）
 */
export function getCachedRoles(): RoleOption[] {
  return cachedRoles ?? [];
}

/**
 * 清除角色快取（用於測試或需要重新載入時）
 */
export function clearRolesCache(): void {
  cachedRoles = null;
  loadingPromise = null;
}

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

export const getAgentSchemas = (opts: {
  canEditApiSettings: boolean;
  pt?: (key: string) => string;
  masterAgent?: string;
  onHashKeyGen?: () => string;
  /**
   * 預先載入的角色選項
   */
  rolesOptions?: Array<{ label: string; value: number }>;
  /**
   * 獲取表單實例的函數（用於四欄聯動驗證）
   */
  getFormInstance?: () => any;
}): FormSchema<AgentFormValues>[] => {
  const pt = opts.pt || ((key: string) => key);
  const masterAgent = opts.masterAgent || '';
  const onHashKeyGen = opts.onHashKeyGen;
  const rolesOptions = opts.rolesOptions;
  const getFormInstance = opts.getFormInstance;

  /**
   * 四欄聯動驗證函數
   */
  const validateFourFields = (fieldName: string) => {
    return (_rule: any, value: string) => {
      if (!getFormInstance) {
        return Promise.resolve();
      }

      const formInstance = getFormInstance();
      if (!formInstance) {
        return Promise.resolve();
      }

      const formValues = formInstance.getFieldsValue();
      const website = String(formValues?.website ?? '').trim();
      const hashKey = String(formValues?.hashKey ?? '').trim();
      const apiDomain = String(formValues?.apiDomain ?? '').trim();
      const whiteIPList = String(formValues?.whiteIPList ?? '').trim();

      // 當前欄位的值
      const currentValue = String(value ?? '').trim();
      const fields = [
        { name: 'website', value: website },
        { name: 'hashKey', value: hashKey },
        { name: 'apiDomain', value: apiDomain },
        { name: 'whiteIPList', value: whiteIPList },
      ];

      // 更新當前欄位的值
      const updatedFields = fields.map(f =>
        f.name === fieldName ? { ...f, value: currentValue } : f,
      );

      // 檢查是否有任何一個欄位有值
      const hasAny = updatedFields.some(f => !!f.value);
      // 檢查是否全部都有值
      const hasAll = updatedFields.every(f => !!f.value);

      // 四欄聯動：有填就必須全部填
      if (hasAny && !hasAll) {
        return Promise.reject(new Error(pt('rules.fourFieldsRequired')));
      }

      return Promise.resolve();
    };
  };

  return [
    {
      field: 'account',
      component: 'Input',
      label: pt('column.account'),
      rules: [{ required: true, message: `請輸入${pt('column.account')}` }],
      colProps: { span: 12 },
      componentProps: {
        autocomplete: 'off',
        placeholder: `請輸入${pt('column.account')}`,
      },
    },
    {
      field: 'name',
      component: 'Input',
      label: pt('column.name'),
      rules: [{ required: true, message: `請輸入${pt('column.name')}` }],
      colProps: { span: 12 },
      componentProps: {
        autocomplete: 'off',
        placeholder: `請輸入${pt('column.name')}`,
      },
    },
    {
      field: 'prefix',
      component: 'Input',
      label: pt('column.prefix'),
      rules: [{ required: true, message: `請輸入${pt('column.prefix')}` }],
      colProps: { span: 12 },
      componentProps: {
        autocomplete: 'off',
        placeholder: `請輸入${pt('column.prefix')}`,
      },
    },
    {
      field: 'roles',
      component: 'Select',
      label: pt('column.roles'),
      rules: [{ required: true, type: 'array', message: `請至少選擇一個${pt('column.roles')}` }],
      colProps: { span: 12 },
      componentProps: {
        mode: 'multiple',
        placeholder: `請選擇${pt('column.roles')}`,
        // 如果已提供 rolesOptions，直接使用；否則使用 request 函數
        ...(rolesOptions ? { options: rolesOptions } : { request: loadRolesOnce }),
      },
    },
    // API 設定欄位：四欄聯動驗證（只要其中一個有輸入，另外三個都要有輸入）
    {
      field: 'website',
      component: 'Input',
      label: pt('column.website'),
      // 四欄聯動驗證
      rules: [
        {
          validator: (_rule: any, value: string) => {
            if (value) {
              const invalidProtocolRegex = /^(http:\/\/|https:\/\/)/i;
              if (invalidProtocolRegex.test(value)) {
                return Promise.reject(new Error(pt('rules.websiteProtocol')));
              }
            }
            return Promise.resolve();
          },
          trigger: ['blur', 'change'],
        },
        {
          validator: validateFourFields('website'),
          trigger: ['blur', 'change'],
        },
      ],
      colProps: { span: 24 },
      componentProps: {
        placeholder: `請輸入${pt('column.website')}（不可含 http/https；會自動加上 -masterAgent）`,
        disabled: !opts.canEditApiSettings,
        autocomplete: 'off',
        name: 'agent-website',
        style: { maxWidth: 'calc(100% - 120px)' },
      },
      afterSlot: () => (masterAgent ? h('span', { class: 'ml-[6px]' }, `-${masterAgent}`) : undefined),
    },
    {
      field: 'hashKey',
      component: 'InputPassword',
      label: pt('column.hashKey'),
      // 四欄聯動驗證
      rules: [
        {
          validator: validateFourFields('hashKey'),
          trigger: ['blur', 'change'],
        },
      ],
      colProps: { span: 24 },
      componentProps: {
        placeholder: `請輸入${pt('column.hashKey')}`,
        disabled: !opts.canEditApiSettings,
        autocomplete: 'new-password',
        name: 'agent-hashkey',
        style: { maxWidth: 'calc(100% - 120px)' },
      },
      afterSlot: onHashKeyGen
        ? (ctx: any) =>
            h(
              Button,
              {
                type: 'primary',
                style: { marginLeft: '6px' },
                onClick: () => {
                  const generated = onHashKeyGen();
                  ctx.formInstance.setFieldsValue({ hashKey: generated });
                },
              },
              () => pt('labels.generate') || '產生',
            )
        : undefined,
    },
    {
      field: 'apiDomain',
      component: 'Input',
      label: pt('column.apiDomain'),
      // 四欄聯動驗證
      rules: [
        {
          validator: validateFourFields('apiDomain'),
          trigger: ['blur', 'change'],
        },
      ],
      colProps: { span: 24 },
      componentProps: {
        placeholder: `請輸入${pt('column.apiDomain')}`,
        disabled: !opts.canEditApiSettings,
        autocomplete: 'off',
      },
    },
    {
      field: 'whiteIPList',
      component: 'Input',
      label: pt('column.whiteIPList'),
      // 四欄聯動驗證
      rules: [
        {
          validator: validateFourFields('whiteIPList'),
          trigger: ['blur', 'change'],
        },
      ],
      colProps: { span: 24 },
      componentProps: {
        placeholder: `請輸入${pt('column.whiteIPList')}（長度 ≤ 255）`,
        disabled: !opts.canEditApiSettings,
        autocomplete: 'off',
      },
    },
  ];
};

export const getPasswordSchemas = (pt?: (key: string) => string): FormSchema[] => {
  const _pt = pt || ((key: string) => key);
  return [
    {
      field: 'newPassword',
      label: _pt('field.newPassword'),
      component: 'InputPassword',
      rules: [{ required: true, message: _pt('rules.newPasswordRequired') }],
      componentProps: {
        placeholder: _pt('rules.newPasswordRequired'),
        autocomplete: 'new-password',
      },
    },
  ];
};

export const passwordSchemas: FormSchema[] = getPasswordSchemas();
