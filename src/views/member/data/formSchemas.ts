import type { FormSchema } from '@/components/core/schema-form/';
import type { Composer } from 'vue-i18n';

type I18nGlobalTranslation = Composer['t'];

export interface MemberFormDto {
  account: string;
  password?: string;
  memberLevel: string;
  vipLevel?: string;
  superior?: string;
  status: number;
}

export const getBaseSchemas = (t: I18nGlobalTranslation): FormSchema<MemberFormDto>[] => [
  {
    field: 'account',
    component: 'Input',
    label: t('form.account'),
    rules: [{ required: true, message: t('form.inputAccount') }],
  },
  {
    field: 'password',
    component: 'InputPassword',
    label: t('form.password'),
    vShow: ({ formModel }) => !formModel.id, // 編輯時隱藏
    rules: [{ required: true, message: t('form.inputPassword') }],
  },
  {
    field: 'memberLevel',
    component: 'Select',
    label: t('form.memberLevel'),
    rules: [{ required: true, message: t('form.selectMemberLevel') }],
    componentProps: {
      options: [
        { label: t('form.memberLevelOptions.inner'), value: '金流內層' },
        { label: t('form.memberLevelOptions.full'), value: '金流全開' },
        { label: t('form.memberLevelOptions.large'), value: '大額入款' },
        { label: t('form.memberLevelOptions.arbitrage'), value: '套利總級' },
        { label: t('form.memberLevelOptions.suspected'), value: '疑似套利' },
      ],
    },
  },
  {
    field: 'vipLevel',
    component: 'Select',
    label: t('form.vipLevel'),
    componentProps: {
      options: [
        { label: t('form.vipLevelOptions.vip2'), value: 'VIP2' },
        { label: t('form.vipLevelOptions.vip8'), value: 'VIP8' },
        { label: t('form.vipLevelOptions.normal'), value: '一般會員' },
      ],
    },
  },
  {
    field: 'superior',
    component: 'Input',
    label: t('form.superior'),
    componentProps: {
      placeholder: t('form.inputSuperiorAccount'),
    },
  },
  {
    field: 'status',
    component: 'RadioGroup',
    label: t('form.status'),
    defaultValue: 1,
    componentProps: {
      options: [
        { label: t('form.enabled'), value: 1 },
        { label: t('form.disabled'), value: 0 },
      ],
    },
  },
];
