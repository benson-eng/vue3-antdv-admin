import type { FormSchema } from '@/components/core/schema-form';
import dayjs from 'dayjs';

export const formSchemas: FormSchema[] = [
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
    field: 'type',
    label: '來源',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      allowClear: true,
      placeholder: '請選擇來源',
      options: [
        { label: '活動', value: 'Promote' },
        { label: '信件附件', value: 'MailAttachment' },
        { label: '任務', value: 'Mission' },
      ],
    },
  },
  {
    field: 'tokenID',
    label: '代幣',
    component: 'Select',
    colProps: { span: 8 },
    componentProps: {
      options: [], // ⭐ 不在這裡動態塞
      allowClear: true,
      placeholder: '請選擇代幣',
    },
  },
  {
    field: 'date',
    label: '搜尋時間',
    component: 'RangePicker',
    required: true,
    colProps: { span: 8 },
    defaultValue: [
      dayjs().subtract(30, 'day'),
      dayjs(),
    ],
    componentProps: {
      showTime: true,
      format: 'YYYY-MM-DD HH:mm:ss',
      allowClear: false,
    },
  },
];
