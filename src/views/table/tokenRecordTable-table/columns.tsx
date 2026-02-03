import type { TokenRecordItem } from '@/api/backend/adminAccount/token';
import type { TableColumn } from '@/components/core/dynamic-table';
import dayjs from 'dayjs';

function formatCurrency(value: number | string): string {
  if (value === null || value === undefined) {
    return '0';
  }
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) {
    return '0';
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

interface ColumnHelpers {
  tokenObjList: Record<number, string>;
  typeObjList: Record<string, string>;
  subTypeObjList: Record<string, string>;
  sourceObjList: Record<string, string>;
  getI18nText: (path: string) => string;
}

export function createColumns(helpers: ColumnHelpers): TableColumn<TokenRecordItem>[] {
  const { tokenObjList, typeObjList, subTypeObjList, sourceObjList, getI18nText } = helpers;

  /**
   * 處理來源：sourceObjList 映射 → i18n
   */
  const getSourceStr = (source: any): string => {
    if (!source) {
      return '';
    }
    const mapped = sourceObjList[source];
    if (mapped) {
      return getI18nText(`source.${mapped}`);
    }
    return String(source);
  };

  /**
   * 處理交易類型：typeObjList 映射
   */
  const getTypeStr = (type: any): string => {
    if (!type) {
      return '';
    }
    return typeObjList[type] || String(type);
  };

  /**
   * 處理子交易類型：subTypeObjList 映射
   */
  const getSubTypeStr = (subType: any): string => {
    if (!subType) {
      return '';
    }
    return subTypeObjList[subType] || String(subType);
  };

  /**
   * 處理代幣：tokenObjList 映射
   */
  const getTokenNameStr = (tokenID: any): string => {
    if (tokenID === null || tokenID === undefined) {
      return '';
    }
    const id = typeof tokenID === 'string' ? Number(tokenID) : tokenID;
    return tokenObjList[id] || '';
  };

  return [
    //   {
    //     title: 'ID',
    //     dataIndex: 'id',
    //     width: 80,
    //   },
    {
      title: '交易編號',
      dataIndex: 'remitno',
      width: 160,
    },
    //   {
    //     title: '會員',
    //     dataIndex: 'memberID',
    //     width: 200,
    //   },
    {
      title: '帳戶ID',
      dataIndex: 'accountID',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '暱稱',
      dataIndex: 'nickName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '來源',
      dataIndex: 'source',
      width: 150,
      customRender: ({ record }) => getSourceStr(record.source),
    },
    {
      title: '交易類型',
      dataIndex: 'type',
      width: 150,
      customRender: ({ record }) => getTypeStr(record.type),
    },
    {
      title: '子交易類型',
      dataIndex: 'subType',
      width: 150,
      customRender: ({ record }) => getSubTypeStr(record.subType),
    },
    {
      title: '代幣',
      dataIndex: 'tokenID',
      width: 120,
      customRender: ({ record }) => getTokenNameStr(record.tokenID),
    },
    {
      title: '異動前',
      dataIndex: 'beforeAmount',
      width: 120,
      customRender: ({ record }) => formatCurrency(record.beforeAmount),
    },
    {
      title: '增加量',
      dataIndex: 'deposit',
      width: 120,
      customRender: ({ record }) => formatCurrency(record.deposit),
    },
    {
      title: '減少量',
      dataIndex: 'withdrawal',
      width: 120,
      customRender: ({ record }) => formatCurrency(record.withdrawal),
    },
    {
      title: '異動後',
      dataIndex: 'afterAmount',
      width: 120,
      customRender: ({ record }) => formatCurrency(record.afterAmount),
    },
    {
      title: '異動時間',
      dataIndex: 'transactionTime',
      width: 180,
      customRender: ({ record }) =>
        record.transactionTime
          ? dayjs(record.transactionTime).format('YYYY-MM-DD HH:mm:ss')
          : '',
    },
    {
      title: '備註',
      dataIndex: 'note',
      width: 240,
      customRender: ({ record }) => {
        if (!record.note) {
          return '';
        }
        if (typeof record.note === 'string') {
          return record.note;
        }
        if (typeof record.note === 'object') {
          return JSON.stringify(record.note);
        }
        return String(record.note);
      },
    },
  ];
}
