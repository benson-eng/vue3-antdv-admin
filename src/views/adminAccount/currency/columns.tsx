import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import { formatToDateTime } from '@/utils/dateUtil';

export interface TableListItem {
  id: string;
  account: string;
  currencyName: string;
  currencyCode: string;
  status: number;
  orderNo: number;
  createdAt: string;
}

export type TableColumnItem = TableColumn<TableListItem>;

const statusOptions = [
  { label: '啟用', value: 1 },
  { label: '停用', value: 0 },
];

export const baseColumns: TableColumnItem[] = [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 90,
    hideInSearch: true,
  },
  {
    title: '總代理',
    dataIndex: 'masterAgent',
    width: 180,
    formItemProps: {
      component: 'Input',
      componentProps: { placeholder: '請輸入總代理' },
      colProps: { span: 6 },
    },
  },
  // {
  //   title: '帳號',
  //   dataIndex: 'account',
  //   width: 200,
  //   sorter: true,
  //   formItemProps: {
  //     component: 'Input',
  //     colProps: { span: 6 },
  //   },
  // },
  {
    title: '貨幣名稱',
    dataIndex: 'currencyName',
    width: 200,
    sorter: true,
    formItemProps: {
      component: 'Input',
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
      colProps: { span: 6 },
    },
  },
  {
    title: '狀態',
    dataIndex: 'status',
    width: 140,
    formItemProps: {
      component: 'Select',
      colProps: { span: 6 },
      componentProps: {
        options: statusOptions,
        placeholder: '請選擇',
      },
    },
    customRender: ({ record }) => {
      const enable = ~~record.status === 1;
      return (
        <div class="flex items-center gap-1">
          <span
            class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-gray-400'}`}
          ></span>
          <Tag color={enable ? 'success' : 'default'}>{enable ? '啟用' : '停用'}</Tag>
        </div>
      );
    },
  },
  {
    title: '排序',
    dataIndex: 'orderNo',
    width: 120,
    sorter: true,
    formItemProps: {
      component: 'InputNumber',
      colProps: { span: 6 },
      componentProps: {
        min: 0,
        placeholder: '請輸入',
      },
    },
  },
  {
    title: '建立時間',
    dataIndex: 'createdAt',
    width: 180,
    hideInSearch: true,
    customRender: ({ record }) => formatToDateTime(record.createdAt),
  },
];
