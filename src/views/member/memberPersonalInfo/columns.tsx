import type { Composer } from 'vue-i18n';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import { formatToDateTime } from '@/utils/dateUtil';

type I18nGlobalTranslation = Composer['t'];

/**
 * 對齊 Vue2 DataTable 欄位命名（queryAccountPersonalInfo 回傳結構）
 */
export interface TableListItem {
  account: string;
  accountID?: string;
  nickName: string;
  agentID: string;
  registerTime?: string;
  lastLoginTime?: string;
  lastLoginIP?: string;
  accountStatus?: number;
  email?: string;
  phoneNumber?: string;
  authProvider?: string;
  birthday?: string;
}

export type TableColumnItem = TableColumn<TableListItem>;

export const getColumns = (t: I18nGlobalTranslation): TableColumnItem[] => [
  {
    title: t('columns.accountID'),
    dataIndex: 'accountID',
    width: 120,
    fixed: 'left',
  },
  {
    title: t('columns.nickName'),
    dataIndex: 'nickName',
    width: 140,
  },
  {
    title: t('columns.registerTime'),
    dataIndex: 'registerTime',
    width: 180,
    customRender: ({ record }) => (record.registerTime ? formatToDateTime(record.registerTime) : '-'),
  },
  {
    title: t('columns.lastLoginTime'),
    dataIndex: 'lastLoginTime',
    width: 180,
    customRender: ({ record }) => (record.lastLoginTime ? formatToDateTime(record.lastLoginTime) : '-'),
  },
  {
    title: t('columns.lastLoginIP'),
    dataIndex: 'lastLoginIP',
    width: 150,
    customRender: ({ record }) => record.lastLoginIP || '-',
  },
  {
    title: t('columns.status'),
    dataIndex: 'accountStatus',
    width: 110,
    customRender: ({ record }) => {
      const enable = ~~Number(record.accountStatus) === 1;
      return <Tag color={enable ? 'green' : 'red'}>{enable ? t('columns.statusEnabled') : t('columns.statusDisabled')}</Tag>;
    },
  },
  {
    title: t('columns.email'),
    dataIndex: 'email',
    width: 220,
  },
  {
    title: t('columns.phoneNumber'),
    dataIndex: 'phoneNumber',
    width: 160,
  },
  {
    title: t('columns.authProvider'),
    dataIndex: 'authProvider',
    width: 140,
  },
  {
    title: t('columns.birthday'),
    dataIndex: 'birthday',
    width: 140,
  },
];
