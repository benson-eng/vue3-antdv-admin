import type { AgentItem } from '@/api/backend/adminAccount/agent';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Space, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

export type TableListItem = AgentItem;
export type TableColumnItem = TableColumn<TableListItem>;

export const getBaseColumns = (pt: (key: string) => string): TableColumnItem[] => [
  {
    title: pt('column.account'),
    dataIndex: 'account',
    width: 140,
    ellipsis: true,
    align: 'center',
    sorter: true,
    hideInSearch: true,
  },
  {
    title: pt('column.name'),
    dataIndex: 'name',
    width: 140,
    ellipsis: true,
    align: 'center',
    sorter: true,
    hideInSearch: true,
  },
  {
    title: pt('column.prefix'),
    dataIndex: 'prefix',
    width: 130,
    ellipsis: true,
    align: 'center',
    hideInSearch: true,
  },
  {
    title: pt('column.roles'),
    dataIndex: 'roles',
    width: 220,
    align: 'center',
    hideInSearch: true,
    customRender: ({ record }) => {
      const roles = Array.isArray(record.roles) ? record.roles : [];
      if (!roles.length) {
        return '-';
      }
      return (
        <Space size={4} wrap>
          {roles.map((r: any) => (
            <Tag key={r.id} color="blue" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r?.name ? `${r.name}(${r.id})` : String(r?.id ?? '')}
            </Tag>
          ))}
        </Space>
      );
    },
  },
  {
    title: pt('column.website'),
    dataIndex: 'website',
    width: 200,
    ellipsis: true,
    align: 'center',
    sorter: true,
    hideInSearch: true,
    customRender: ({ record }) => record.website || '-',
  },
  {
    title: pt('column.apiDomain'),
    dataIndex: 'apiDomain',
    width: 200,
    ellipsis: true,
    align: 'center',
    sorter: true,
    hideInSearch: true,
    customRender: ({ record }) => record.apiDomain || '-',
  },
  {
    title: pt('column.whiteIPList'),
    dataIndex: 'whiteIPList',
    width: 220,
    ellipsis: true,
    align: 'center',
    sorter: true,
    hideInSearch: true,
    customRender: ({ record }) => record.whiteIPList || '-',
  },
  {
    title: pt('column.createDatetime'),
    dataIndex: 'createDatetime',
    width: 180,
    ellipsis: true,
    align: 'center',
    sorter: true,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (!record.createDatetime) return '-';
      return dayjs(record.createDatetime).format('YYYY-MM-DD HH:mm:ss');
    },
  },
  {
    title: pt('column.lastLoginDatetime'),
    dataIndex: 'lastLoginDatetime',
    width: 180,
    ellipsis: true,
    align: 'center',
    hideInSearch: true,
    customRender: ({ record }) => {
      if (!record.lastLoginDatetime) return '-';
      return dayjs(record.lastLoginDatetime).format('YYYY-MM-DD HH:mm:ss');
    },
  },
  // {
  //   title: pt('column.lastLoginIP'),
  //   dataIndex: 'lastLoginIP',
  //   width: 160,
  //   ellipsis: true,
  //   align: 'center',
  //   hideInSearch: true,
  //   customRender: ({ record }) => record.lastLoginIP || '-',
  // },
];
