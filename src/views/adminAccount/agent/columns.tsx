import type { AgentItem } from '@/api/backend/adminAccount/agent';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Space, Tag } from 'ant-design-vue';

export type TableListItem = AgentItem;
export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  {
    title: '帳號',
    dataIndex: 'account',
    width: 140,
    hideInSearch: true,
  },
  {
    title: '名稱',
    dataIndex: 'name',
    width: 140,
    hideInSearch: true,
  },
  {
    title: '前綴',
    dataIndex: 'prefix',
    width: 80,
    hideInSearch: true,
  },
  {
    title: '角色',
    dataIndex: 'roles',
    width: 220,
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
    title: 'Website',
    dataIndex: 'website',
    width: 200,
    hideInSearch: true,
    customRender: ({ record }) => record.website || '-',
  },
  {
    title: 'API Domain',
    dataIndex: 'apiDomain',
    width: 200,
    hideInSearch: true,
    customRender: ({ record }) => record.apiDomain || '-',
  },
  {
    title: 'White IP List',
    dataIndex: 'whiteIPList',
    width: 220,
    hideInSearch: true,
    customRender: ({ record }) => record.whiteIPList || '-',
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
  {
    title: '最後登入 IP',
    dataIndex: 'lastLoginIP',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => record.lastLoginIP || '-',
  },
];


