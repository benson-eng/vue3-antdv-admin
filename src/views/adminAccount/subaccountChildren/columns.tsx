import type { SubaccountItem } from '@/api/backend/adminAccount/subaccount';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Space, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

export type TableListItem = SubaccountItem;
export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  {
    title: '帳號',
    dataIndex: 'account',
    flexible: true,
    minWidth: 140,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入帳號或名稱',
      },
    },
  },
  {
    title: '名稱',
    dataIndex: 'name',
    flexible: true,
    minWidth: 140,
    hideInSearch: true,
    customRender: ({ record }) => record.name || '-',
  },
  {
    title: '角色',
    dataIndex: 'roles',
    width: 240,
    hideInSearch: true,
    customRender: ({ record }) => {
      const roles = Array.isArray(record.roles) ? record.roles : [];
      if (!roles.length) {
        return '-';
      }
      return (
        <Space size={4} wrap>
          {roles.map((r: any) => (
            <Tag key={r.id} color="blue">
              {r?.name ?? r?.id}
            </Tag>
          ))}
        </Space>
      );
    },
  },
  {
    title: '建立時間',
    dataIndex: 'createDatetime',
    flexible: true,
    minWidth: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        allowClear: true,
        format: 'YYYY-MM-DD',
        style: { width: '100%' },
      },
    },
    customRender: ({ record }) => {
      if (!record.createDatetime) {
        return '-';
      }
      return dayjs(record.createDatetime).format('YYYY-MM-DD HH:mm:ss');
    },
  },
  {
    title: '啟用狀態',
    dataIndex: 'isEnabled',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '全部',
        allowClear: true,
        options: [
          { label: '啟用', value: 'true' },
          { label: '停用', value: 'false' },
        ],
      },
    },
    hideInTable: true,
  },
  {
    title: '最後登入時間',
    dataIndex: 'lastLoginDatetime',
    flexible: true,
    minWidth: 180,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (!record.lastLoginDatetime) {
        return '-';
      }
      return dayjs(record.lastLoginDatetime).format('YYYY-MM-DD HH:mm:ss');
    },
  },
  {
    title: '最後登入 IP',
    dataIndex: 'lastLoginIP',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => record.lastLoginIP || '-',
  },
];
