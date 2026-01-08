import type { AgentItem } from '@/api/backend/adminAccount/agent';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

export type TableListItem = AgentItem;
export type TableColumnItem = TableColumn<TableListItem>;

export const getBaseColumns = (pt: (key: string) => string): TableColumnItem[] => [
  {
    title: pt('column.account'),
    dataIndex: 'account',
    flexible: true, // 彈性寬度欄位
    minWidth: 140, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    formItemProps: {
      component: 'Input',
    },
  },
  {
    title: pt('column.name'),
    dataIndex: 'name',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
  },
  {
    title: pt('column.prefix'),
    dataIndex: 'prefix',
    width: 130,
    hideInSearch: true,
  },
  {
    title: pt('column.roles'),
    dataIndex: 'roles',
    width: 220,
    hideInSearch: true,
    customRender: ({ record }) => (
      <span>
        {Array.isArray(record.roles) && record.roles.length > 0
          ? record.roles.map((role: any) => (
              <Tag key={role.key || role.id} style={{ margin: '3px 5px', maxWidth: '200px' }}>
                {role.name}
                (
                {role.id}
                )
              </Tag>
            ))
          : '-'}
      </span>
    ),
  },
  {
    title: pt('column.website'),
    dataIndex: 'website',
    flexible: true, // 彈性寬度欄位
    minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
    customRender: ({ record }) => record.website || '-',
  },
  {
    title: pt('column.apiDomain'),
    dataIndex: 'apiDomain',
    flexible: true, // 彈性寬度欄位
    minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
    customRender: ({ record }) => record.apiDomain || '-',
  },
  {
    title: pt('column.whiteIPList'),
    dataIndex: 'whiteIPList',
    width: 220,
    hideInSearch: true,
    customRender: ({ record }) => record.whiteIPList || '-',
  },
  {
    title: pt('column.createDatetime'),
    dataIndex: 'createDatetime',
    flexible: true, // 彈性寬度欄位
    minWidth: 180, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
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
    title: pt('column.lastLoginDatetime'),
    dataIndex: 'lastLoginDatetime',
    flexible: true, // 彈性寬度欄位
    minWidth: 180, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
    customRender: ({ record }) => {
      if (!record.lastLoginDatetime) {
        return '-';
      }
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
