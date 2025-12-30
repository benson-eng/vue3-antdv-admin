import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';

export type TableListItem = MasterAgentItem;
export type TableColumnItem = TableColumn<TableListItem>;

// 注意：此處的 title 將在組件內通過 i18n 函數動態替換
/**
 * Vue2 對應：adminAccount.column.*
 */
export const getBaseColumns = (
  pt: (key: string) => string,
  userLevel: number,
): TableColumnItem[] => {
  const columns: TableColumnItem[] = [
    {
      title: pt('column.account'),
      dataIndex: 'account',
      formItemProps: {
        component: 'Input',
      },
    },
    {
      title: pt('column.name2'), // Vue2: adminAccount.column.name2 = "網站名稱"
      dataIndex: 'name',
      width: 160,
      hideInSearch: true,
    },
    {
      title: pt('column.isMaintained'), // Vue2: adminAccount.column.isMaintained = "前台維護"
      dataIndex: 'isMaintained',
      width: 100,
      hideInSearch: true,
      customRender: ({ record }) => (
        <Tag color={record.isMaintained ? 'red' : 'green'}>
          {record.isMaintained ? pt('labels.isMaintaining') : pt('labels.running')}
        </Tag>
      ),
    },
    {
      title: pt('column.roles'), // Vue2: adminAccount.column.roles = "角色"
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
      title: userLevel > 1 ? pt('column.website2') : pt('column.website'), // Vue2: 根據權限顯示不同標籤
      dataIndex: 'website',
      width: 160,
      hideInSearch: true,
    },
    {
      title: pt('column.currencies'), // Vue2: adminAccount.column.currencies = "幣別"
      dataIndex: 'currencies',
      width: 100,
      hideInSearch: true,
      customRender: ({ record }) => (
        <span>
          {Array.isArray(record.currencies) && record.currencies.length > 0
            ? record.currencies.map((currency: any) => (
                <Tag
                  key={`${currency.currencyIndex}_${currency.currencyName}`}
                  style={{ margin: '3px 5px', maxWidth: '100px' }}
                >
                  {currency.currencyName}
                </Tag>
              ))
            : '-'}
        </span>
      ),
    },
  ];

  // 僅管理員 (level === 1) 顯示的欄位
  if (userLevel === 1) {
    columns.push(
      {
        title: pt('column.isSingleWallet'), // Vue2: adminAccount.column.isSingleWallet = "單一錢包"
        dataIndex: 'isSingleWallet',
        width: 120,
        hideInSearch: true,
        customRender: ({ record }) => (
          <span>{record.isSingleWallet ? pt('labels.yes') : pt('labels.no')}</span>
        ),
      },
      {
        title: pt('column.apiDomain'), // Vue2: adminAccount.column.apiDomain = "API Domain"
        dataIndex: 'apiDomain',
        width: 140,
        hideInSearch: true,
      },
      {
        title: pt('column.whiteIPList'), // Vue2: adminAccount.column.whiteIPList = "白名單"
        dataIndex: 'whiteIPList',
        width: 140,
        hideInSearch: true,
      },
      {
        title: pt('column.cdnList'), // Vue2: adminAccount.column.cdnList = "CDN名單"
        dataIndex: 'cdnList',
        width: 140,
        hideInSearch: true,
      },
    );
  }

  // 所有用戶都顯示的欄位
  columns.push(
    {
      title: pt('column.createDatetime'), // Vue2: adminAccount.column.createDatetime = "建立日期"
      dataIndex: 'createDatetime',
      width: 180,
      formItemProps: {
        component: 'RangePicker',
        componentProps: {
          allowClear: true,
          format: 'YYYY-MM-DD',
          style: { width: '100%' },
        },
      },
    },
    {
      title: pt('column.adminMaintained'), // Vue2: adminAccount.column.adminMaintained = "後台維護"
      dataIndex: 'isEnabled',
      width: 100,
      formItemProps: {
        component: 'Select',
        componentProps: {
          options: [
            { label: pt('labels.all'), value: undefined },
            { label: pt('labels.enable'), value: true },
            { label: pt('labels.disable'), value: false },
          ],
          allowClear: true,
          placeholder: pt('labels.all'),
        },
      },
      customRender: ({ record }) => (
        <Tag color={record.isEnabled ? 'green' : 'red'}>
          {record.isEnabled ? pt('labels.enable') : pt('labels.disable')}
        </Tag>
      ),
    },
  );

  return columns;
};
