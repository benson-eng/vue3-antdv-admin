import type { TableColumn } from '@/components/core/dynamic-table';
import { Space, Tag } from 'ant-design-vue';

export interface RoleItem {
  id: number;
  name: string;
}

export interface TableListItem {
  id: number;
  account: string;
  name: string;
  roles: RoleItem[];
  isEnabled: boolean;
  isMasterAccount?: boolean;
}

export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  {
    title: '帳號',
    dataIndex: 'account',
    width: 180,
    hideInSearch: true,
  },
  {
    title: '名稱',
    dataIndex: 'name',
    width: 200,
    hideInSearch: true,
  },
  {
    title: '角色',
    dataIndex: 'roles',
    hideInSearch: true,
    customRender: ({ record }) => {
      const roles = Array.isArray(record.roles) ? record.roles : [];
      if (!roles.length) {
        return '-';
      }
      return (
        <Space size={4} wrap>
          {roles.map(r => (
            <Tag key={r.id} color="blue">
              {r.name}
            </Tag>
          ))}
        </Space>
      );
    },
  },
];

