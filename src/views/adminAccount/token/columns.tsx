import { Image, Tag } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import { baseApiUrl } from '@/utils/request';
import { TokenType } from '@/api/backend/adminAccount/token';

export interface TableListItem {
  id: number;
  masterAgent: string;
  name: string;
  type: TokenType;
  iconUrl: string;
  transactionLimit?: number;
}

export type TableColumnItem = TableColumn<TableListItem>;

export const getTokenIconUrl = (path: string) => {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const cdnBaseUrl = (import.meta as any)?.env?.VITE_APP_CDN_BASE_URL || '';
  const prefix = cdnBaseUrl || baseApiUrl || '';
  return `${prefix}${path}`;
};

export const tokenTypeLabel = (t: TokenType) => {
  switch (t) {
    case TokenType.GACHAPON_TICKET:
      return '轉蛋券';
    case TokenType.GOLDEN_TICKET:
      return '黃金券';
    default:
      return String(t);
  }
};

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
    hideInSearch: true,
  },
  {
    title: '代幣名稱',
    dataIndex: 'name',
    width: 220,
    formItemProps: {
      component: 'Input',
      componentProps: { placeholder: '請輸入代幣名稱' },
      colProps: { span: 6 },
    },
  },
  {
    title: '代幣類型',
    dataIndex: 'type',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => <Tag>{tokenTypeLabel(record.type)}</Tag>,
  },
  {
    title: '可贈送上限',
    dataIndex: 'transactionLimit',
    width: 140,
    hideInSearch: true,
    customRender: ({ record }) => (record.transactionLimit && record.transactionLimit > 0 ? record.transactionLimit : '不可贈送'),
  },
  {
    title: '圖示',
    dataIndex: 'iconUrl',
    width: 90,
    hideInSearch: true,
    customRender: ({ record }) => (
      <Image width={48} height={48} preview={{ src: getTokenIconUrl(record.iconUrl) }} src={getTokenIconUrl(record.iconUrl)} />
    ),
  },
];





