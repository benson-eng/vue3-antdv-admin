import { Image, Tag } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';
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
  const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';
  
  // 如果路徑已經包含 localhost:8088，替換為 cdnBaseUrl
  if (path.includes('localhost:8088')) {
    try {
      const url = new URL(path);
      // 提取路徑和查詢參數（去掉開頭的斜線，因為 cdnBaseUrl 通常已有尾部斜線）
      const relativePath = (url.pathname + url.search + url.hash).replace(/^\//, '');
      return cdnBaseUrl ? `${cdnBaseUrl}${relativePath}` : path;
    }
    catch {
      // 如果 URL 解析失敗，使用正則表達式提取相對路徑
      const match = path.match(/^https?:\/\/[^/]+(\/.*)$/);
      if (match) {
        const relativePath = match[1].replace(/^\//, '');
        return cdnBaseUrl ? `${cdnBaseUrl}${relativePath}` : path;
      }
      return path;
    }
  }
  
  // 如果已經是完整的 http/https URL（非 localhost），直接返回
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  
  // 否則使用 cdnBaseUrl 拼接（去掉開頭的斜線）
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return cdnBaseUrl ? `${cdnBaseUrl}${cleanPath}` : path;
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






