import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { TableColumn } from '@/components/core/dynamic-table';

export type TableListItem = MasterAgentItem;
export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  {
    title: '帳號',
    dataIndex: 'account',
    width: 160,
    hideInSearch: true,
  },
  {
    title: '名稱',
    dataIndex: 'name',
    width: 160,
    hideInSearch: true,
  },
  {
    title: '狀態(啟用)',
    dataIndex: 'isEnabled',
    width: 120,
    hideInSearch: true,
  },
  {
    title: '後台維護',
    dataIndex: 'isMaintained',
    width: 120,
    hideInSearch: true,
  },
  {
    title: '建立時間',
    dataIndex: 'createDatetime',
    width: 180,
    hideInSearch: true,
  },
  {
    title: '最後登入時間',
    dataIndex: 'lastLoginDatetime',
    width: 180,
    hideInSearch: true,
  },
];



