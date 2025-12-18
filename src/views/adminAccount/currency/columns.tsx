// src/views/adminAccount/currency/columns.tsx
import type { TableColumn } from '@/components/core/dynamic-table';
import { formatToDateTime } from '@/utils/dateUtil';

export interface TableListItem {
  id: string;
  masterAgent: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  createdAt?: string;
}

export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 90,
    hideInSearch: true,
  },

  // ✅ 僅顯示，不參與搜尋（搜尋交給 slot）
  {
    title: '總代理',
    dataIndex: 'masterAgent',
    width: 180,
    hideInSearch: true,
  },

  {
    title: '貨幣名稱',
    dataIndex: 'currencyName',
    width: 200,
    sorter: true,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入貨幣名稱',
      },
      colProps: { span: 6 },
    },
  },

  {
    title: '貨幣代碼',
    dataIndex: 'currencyCode',
    width: 160,
    sorter: true,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入貨幣代碼',
      },
      colProps: { span: 6 },
    },
  },

  {
    title: '貨幣符號',
    dataIndex: 'currencySymbol',
    width: 120,
    hideInSearch: true,
  },

  {
    title: '建立時間',
    dataIndex: 'createdAt',
    width: 180,
    hideInSearch: true,
    customRender: ({ record }) =>
      record.createdAt ? formatToDateTime(record.createdAt) : '-',
  },
];
