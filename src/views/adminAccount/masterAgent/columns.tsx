import type { MasterAgentItem } from '@/api/backend/adminAccount/masterAgent';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

export type TableListItem = MasterAgentItem;
export type TableColumnItem = TableColumn<TableListItem>;

// 注意：此處的 title 將在組件內通過 i18n 函數動態替換
/**
 * Vue2 對應：adminAccount.column.*
 */
export const getBaseColumns = (
  pt: (key: string) => string,
  _userLevel: number,
): TableColumnItem[] => {
  const columns: TableColumnItem[] = [
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
      title: pt('column.name2'), // Vue2: adminAccount.column.name2 = "網站名稱"
      dataIndex: 'name',
      flexible: true, // 彈性寬度欄位
      minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
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
      title: pt('column.adminMaintained'), // Vue2: adminAccount.column.adminMaintained = "後台維護"
      dataIndex: 'isEnabled',
      width: 100,
      formItemProps: {
        component: 'Select',
        componentProps: {
          options: [
            { label: pt('labels.all'), value: '' }, // 使用空字串代表「全部」，以便 Select 正確顯示為已選中
            { label: pt('labels.enable'), value: 'true' },
            { label: pt('labels.disable'), value: 'false' },
          ],
          allowClear: false, // 移除清除按鈕，因為預設就是「全部」
          placeholder: pt('labels.all'),
        },
        defaultValue: '', // 預設值為「全部」（空字串）
      },
      customRender: ({ record }) => (
        <Tag color={record.isEnabled ? 'green' : 'red'}>
          {record.isEnabled ? pt('labels.enable') : pt('labels.disable')}
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
      title: pt('column.website2'), // 統一顯示為「網域」
      dataIndex: 'website',
      flexible: true, // 彈性寬度欄位
      minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
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
  // 以下欄位已隱藏：單一錢包、API Domain、白名單、CDN名單
  // if (userLevel === 1) {
  //   columns.push(
  //     {
  //       title: pt('column.isSingleWallet'), // Vue2: adminAccount.column.isSingleWallet = "單一錢包"
  //       dataIndex: 'isSingleWallet',
  //       width: 120,
  //       hideInSearch: true,
  //       customRender: ({ record }) => (
  //         <span>{record.isSingleWallet ? pt('labels.yes') : pt('labels.no')}</span>
  //       ),
  //     },
  //     {
  //       title: pt('column.apiDomain'), // Vue2: adminAccount.column.apiDomain = "API Domain"
  //       dataIndex: 'apiDomain',
  //       width: 140,
  //       hideInSearch: true,
  //     },
  //     {
  //       title: pt('column.whiteIPList'), // Vue2: adminAccount.column.whiteIPList = "白名單"
  //       dataIndex: 'whiteIPList',
  //       width: 140,
  //       hideInSearch: true,
  //     },
  //     {
  //       title: pt('column.cdnList'), // Vue2: adminAccount.column.cdnList = "CDN名單"
  //       dataIndex: 'cdnList',
  //       width: 140,
  //       hideInSearch: true,
  //     },
  //   );
  // }

  // 所有用戶都顯示的欄位
  columns.push(
    {
      title: pt('column.createDatetime'), // Vue2: adminAccount.column.createDatetime = "建立日期"
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
  );

  return columns;
};
