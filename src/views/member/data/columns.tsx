import { Tag } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import { formatToDateTime } from '@/utils/dateUtil';
import type { Composer } from 'vue-i18n';

type I18nGlobalTranslation = Composer['t'];

export interface TableListItem {
  id: string;
  account: string;
  status: number;
  superior: string;
  memberLevel: string;
  returnWaterLevel: string;
  vipLevel: string;
  promotionCode: string;
  superiorAccount: string;
  createdAt: string;
  updatedAt: string;
  // 新增搜索欄位
  realName?: string;
  phone?: string;
  idCard?: string;
  line?: string;
  registerIp?: string;
  lastLoginIp?: string;
  registerTime?: string;
  lastLoginTime?: string;
  registerSource?: string;
  depositCount?: number;
  firstDeposit?: string;
  firstWithdraw?: string;
}

export type TableColumnItem = TableColumn<TableListItem>;

export const getBaseColumns = (t: I18nGlobalTranslation): TableColumnItem[] => [
  {
    title: t('columns.account'),
    dataIndex: 'account',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: t('columns.inputAccount'),
      },
      colProps: { span: 6 },
    },
  },
  {
    title: t('columns.status'),
    dataIndex: 'status',
    width: 100,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: t('columns.pleaseSelect'),
        options: [
          { label: t('columns.all'), value: undefined },
          { label: t('columns.statusEnabled'), value: 1 },
          { label: t('columns.statusDisabled'), value: 0 },
        ],
      },
      colProps: { span: 6 },
    },
    customRender: ({ record }) => {
      const enable = ~~record.status === 1;
      return <Tag color={enable ? 'green' : 'red'}>{enable ? t('columns.statusEnabled') : t('columns.statusDisabled')}</Tag>;
    },
  },
  {
    title: t('columns.superior'),
    dataIndex: 'superior',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: t('columns.inputAgentAccount'),
      },
      colProps: { span: 6 },
    },
    customRender: ({ text }) => <a class="text-blue-500">{text}</a>,
  },
  {
    title: t('columns.superiorAccount'),
    dataIndex: 'superiorAccount',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: t('columns.inputAccount'),
      },
      colProps: { span: 6 },
    },
    customRender: ({ text }) => <a class="text-blue-500">{text}</a>,
  },
  {
    title: t('columns.memberLevel'),
    dataIndex: 'memberLevel',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: t('columns.pleaseSelect'),
        options: [
          { label: t('columns.all'), value: undefined },
          { label: t('form.memberLevelOptions.inner'), value: '金流內層' },
          { label: t('form.memberLevelOptions.full'), value: '金流全開' },
          { label: t('form.memberLevelOptions.large'), value: '大額入款' },
          { label: t('form.memberLevelOptions.arbitrage'), value: '套利總級' },
          { label: t('form.memberLevelOptions.suspected'), value: '疑似套利' },
        ],
      },
      colProps: { span: 6 },
    },
  },
  {
    title: t('columns.vipLevel'),
    dataIndex: 'vipLevel',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: t('columns.pleaseSelect'),
        options: [
          { label: t('form.vipLevelOptions.vip2'), value: 'VIP2' },
          { label: t('form.vipLevelOptions.vip8'), value: 'VIP8' },
          { label: t('form.vipLevelOptions.normal'), value: '一般會員' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.firstDeposit'),
    dataIndex: 'firstDeposit',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: t('columns.noWithdraw'),
        options: [
          { label: t('columns.noWithdraw'), value: 'no_withdraw' },
          { label: t('columns.noDeposit'), value: 'no_deposit' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.registerIp'),
    dataIndex: 'registerIp',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: t('columns.inputIp'),
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.lastLoginIp'),
    dataIndex: 'lastLoginIp',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: t('columns.inputIp'),
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.idCard'),
    dataIndex: 'idCard',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: t('columns.inputIdCard'),
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.line'),
    dataIndex: 'line',
    width: 100,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: t('columns.pleaseSelect'),
        options: [
          { label: 'Line 1', value: 'line1' },
          { label: 'Line 2', value: 'line2' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.registerTime'),
    dataIndex: 'registerTime',
    width: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        placeholder: [t('columns.startTime'), t('columns.endTime')],
        showTime: false,
      },
      colProps: { span: 12 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.lastLoginTime'),
    dataIndex: 'lastLoginTime',
    width: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        placeholder: [t('columns.startTime'), t('columns.endTime')],
        showTime: false,
      },
      colProps: { span: 12 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.registerSource'),
    dataIndex: 'registerSource',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: t('columns.pleaseSelect'),
        options: [
          { label: 'PC', value: 'pc' },
          { label: 'H5', value: 'h5' },
          { label: 'APP', value: 'app' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.depositCount'),
    dataIndex: 'depositCount',
    width: 180,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '>=',
        options: [
          { label: '>=', value: '>=' },
          { label: '<=', value: '<=' },
          { label: '=', value: '=' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: t('columns.returnWaterLevel'),
    dataIndex: 'returnWaterLevel',
    width: 120,
    hideInSearch: true,
  },
  {
    title: t('columns.vipLevel'),
    dataIndex: 'vipLevel',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => {
      // 根據等級顯示不同圖標
      const isVip = record.vipLevel.includes('VIP');
      return (
        <div class="flex items-center gap-1">
          {isVip ? (
            <span class="text-yellow-500">👑</span>
          ) : (
            <span class="text-red-500">🔴</span>
          )}
          <span>{record.vipLevel}</span>
        </div>
      );
    },
  },
  {
    title: t('columns.promotionCode'),
    dataIndex: 'promotionCode',
    width: 180,
    hideInSearch: true,
  },
  {
    title: t('columns.createdAt'),
    dataIndex: 'createdAt',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => formatToDateTime(record.createdAt),
  },
];
