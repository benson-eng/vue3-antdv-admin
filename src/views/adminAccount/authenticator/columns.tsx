import { Tag } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';

export interface TableListItem {
  id: number;
  account: string;
  backendKey?: string;
  authenticator: boolean;
  originalAuthenticator: boolean;
  hierarchyLevel?: number;
  masterAgent?: string;
  canReset: boolean;
  style?: string;
  otpauth?: string;
  qrcodeUrl?: string;
}

export type TableColumnItem = TableColumn<TableListItem>;

const computeStyle = (hierarchyLevel?: number) => {
  switch (Number(hierarchyLevel)) {
    case 1:
      return 'text-shadow:2px 3px 5px #ff0000';
    case 2:
      return 'text-shadow:2px 3px 5px #ffa500';
    case 3:
      return 'text-shadow:2px 3px 5px #008000';
    case 4:
      return 'text-shadow:2px 3px 5px #0000ff';
    default:
      return '';
  }
};

export const baseColumns: TableColumnItem[] = [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 100,
    hideInSearch: true,
    hideInTable: true, // 不顯示在表格中
  },
  {
    title: '帳號',
    dataIndex: 'account',
    flexible: true, // 彈性寬度欄位
    minWidth: 140, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    formItemProps: {
      component: 'Input',
      componentProps: { placeholder: '請輸入帳號' },
      colProps: { span: 6 },
    },
    customRender: ({ record }) => (
      <span style={computeStyle(record.hierarchyLevel)}>{record.account}</span>
    ),
  },
  {
    title: '層級',
    dataIndex: 'hierarchyLevel',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇層級',
        allowClear: true,
        options: [
          { label: '系統管理員', value: 1 },
          { label: '總代理', value: 2 },
          { label: '代理', value: 3 },
          { label: '站長', value: 4 },
          { label: '族長', value: 5 },
        ],
      },
      colProps: { span: 6 },
    },
    customRender: ({ record }) => {
      const level = Number(record.hierarchyLevel);
      const labels: Record<number, string> = {
        1: '系統管理員',
        2: '總代理',
        3: '代理',
        4: '站長',
        5: '族長',
      };
      return labels[level] || String(level);
    },
  },
  {
    title: 'BackendKey',
    dataIndex: 'backendKey',
    flexible: true, // 彈性寬度欄位
    minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    hideInSearch: true,
  },
];
