import type { ICashRecord } from '@/api/backend/adminSystem/cashRecordServer';
// src/views/adminSystem/cashRecord-table/columns.tsx
import type { TableColumn } from '@/components/core/dynamic-table';
import dayjs from 'dayjs';
import { h } from 'vue';

export type CashRecordRow = ICashRecord & {
  balanceChange: number;
  currencyTypeStr: string;
  noteTranslated: string;
  /** 帳戶ID（由 queryAccountBaseInfo 批次補齊） */
  accountID?: string;
  /** 暱稱（由 queryAccountBaseInfo 批次補齊） */
  nickName?: string;
};

export type TableColumnItem = TableColumn<CashRecordRow>;

export function createCashRecordColumns(t: (key: string) => string): TableColumnItem[] {
  return [
    {
      title: t('labels.remitno'),
      dataIndex: 'remitno',
      width: 150,
    },
    {
      title: t('labels.transactionTime'),
      dataIndex: 'transactionTime',
      width: 180,
      customRender: ({ record }) =>
        record.transactionTime
          ? dayjs(record.transactionTime).format('YYYY-MM-DD HH:mm:ss')
          : '',
    },
    {
      title: t('labels.memberID'),
      dataIndex: 'memberID',
      flexible: true, // 彈性寬度欄位，對齊 agent 頁行為
      minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInTable: true, // ARCH-02: 會員ID 欄位僅保留作為搜尋欄位使用，資料表中不再顯示
    },
    {
      title: t('labels.accountID') || '帳戶ID',
      dataIndex: 'accountID',
      flexible: true,
      minWidth: 140,
      hideInSearch: true,
      customRender: ({ text }) => text || '-',
    },
    {
      title: t('labels.nickName') || '暱稱',
      dataIndex: 'nickName',
      flexible: true,
      minWidth: 140,
      hideInSearch: true,
      customRender: ({ text }) => text || '-',
    },
    {
      title: t('labels.balanceChange'),
      dataIndex: 'balanceChange',
      width: 150,
      align: 'right',
      customRender: ({ record }) => {
        const style = record.balanceChange < 0 ? { color: '#FF4949' } : {};
        return h('span', { style }, record.balanceChange.toLocaleString());
      },
    },
    {
      title: t('labels.beforeBalance'),
      dataIndex: 'beforeBalance',
      width: 150,
      align: 'right',
      customRender: ({ record }) =>
        Number(record.beforeBalance || 0).toLocaleString(),
    },
    {
      title: t('labels.afterBalance'),
      dataIndex: 'afterBalance',
      width: 150,
      align: 'right',
      customRender: ({ record }) =>
        Number(record.afterBalance || 0).toLocaleString(),
    },
    {
      title: t('labels.currencyType'),
      dataIndex: 'currency',
      width: 120,
    },
    {
      title: t('labels.type'),
      dataIndex: 'type',
      width: 150,
      customRender: ({ record }) =>
        t(`record.types.${record.type}`) || record.type,
    },
    {
      title: t('labels.subType'),
      dataIndex: 'subType',
      width: 150,
      customRender: ({ record }) =>
        t(`record.subTypes.${record.subType}`) || record.subType,
    },
    {
      title: t('labels.source'),
      dataIndex: 'source',
      width: 150,
    },
    {
      title: t('labels.sourceStatus'),
      dataIndex: 'sourceStatus',
      flexible: true, // 彈性寬度欄位，對齊 agent 頁行為
      minWidth: 150, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    },
    {
      title: t('labels.note'),
      dataIndex: 'noteTranslated',
      flexible: true, // 彈性寬度欄位，對齊 agent 頁行為
      minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
    },
  ];
}
