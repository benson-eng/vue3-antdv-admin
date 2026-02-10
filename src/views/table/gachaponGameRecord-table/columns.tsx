import type { SpendingType, VipPortalGameRecordColumns } from '@/api/backend/adminSystem/lobbyGameRecordServer';
import type { TableColumn } from '@/components/core/dynamic-table';
import dayjs from 'dayjs';

export type GachaponGameRecordRow = VipPortalGameRecordColumns & {
  id: number;
  /** 帳戶ID（由 queryAccountBaseInfo 批次補齊） */
  accountID?: string;
  /** 暱稱（由 queryAccountBaseInfo 批次補齊） */
  nickName?: string;
};

export type TableColumnItem = TableColumn<GachaponGameRecordRow>;

export interface CreateColumnsOptions {
  t: (key: string) => string;
  getVipName: (vipLevel: number) => string;
  getTreasureItemName: (itemID?: string) => string;
  getAwardDetails: (
    type: SpendingType | string,
    currencyType?: string,
    balance?: number,
    itemID?: string,
    spendingItem?: any,
  ) => string;
}

/**
 * STEP 3 定型的欄位集合（依顯示順序）
 * 欄位 keys: ['id', 'roundID', 'eventID', 'memberID', 'accountID', 'nickName', 'vip', 'spendingType', 'spendingDetails', 'spendingAmount', 'gainType', 'gainDetails', 'gainAmount', 'playDateTime']
 * ARCH-02: 新增 accountID 和 nickName 欄位（由 queryAccountBaseInfo 批次補齊）
 */
export function createGachaponGameRecordColumns(options: CreateColumnsOptions): TableColumnItem[] {
  const { t, getVipName, getAwardDetails } = options;

  return [
    {
      title: t('tables.id'),
      dataIndex: 'id',
      width: 80,
      hideInTable: true, // ID 欄位不顯示在資料表中
    },
    {
      title: t('tables.roundID'),
      dataIndex: 'roundID',
      width: 150,
    },
    {
      title: t('tables.eventID'),
      dataIndex: 'eventID',
      width: 150,
    },
    {
      title: t('tables.memberID'),
      dataIndex: 'memberID',
      width: 200,
      hideInTable: true, // ARCH-02: 會員ID 欄位僅保留作為搜尋欄位使用，資料表中不再顯示
    },
    {
      title: t('labels.accountID'),
      dataIndex: 'accountID',
      width: 140,
      hideInSearch: true,
      customRender: ({ text }: { text?: string }) => text || '-',
    },
    {
      title: t('labels.nickName'),
      dataIndex: 'nickName',
      flexible: true,
      minWidth: 160,
      hideInSearch: true,
      customRender: ({ text }: { text?: string }) => text || '-',
    },
    {
      title: t('tables.vip'),
      dataIndex: 'vip',
      width: 100,
      customRender: ({ record }: { record: GachaponGameRecordRow }) => {
        return getVipName(record.vip);
      },
    },
    {
      title: t('tables.spendingType'),
      dataIndex: 'spendingType',
      width: 120,
      customRender: ({ record }: { record: GachaponGameRecordRow }) => {
        return t(`awardType.${record.spendingType}`) || record.spendingType;
      },
    },
    {
      title: t('tables.spendingDetails'),
      dataIndex: 'spendingDetails',
      width: 200,
      customRender: ({ record }: { record: GachaponGameRecordRow }) => {
        return getAwardDetails(
          record.spendingType,
          record.spendingCurrencyType,
          record.spendingBalance,
          record.spendingItemID,
          record.spendingItem,
        );
      },
    },
    {
      title: t('tables.spendingAmount'),
      dataIndex: 'spendingAmount',
      width: 120,
      align: 'right',
    },
    {
      title: t('tables.gainType'),
      dataIndex: 'gainType',
      width: 120,
      customRender: ({ record }: { record: GachaponGameRecordRow }) => {
        return t(`awardType.${record.gainType}`) || record.gainType;
      },
    },
    {
      title: t('tables.gainDetails'),
      dataIndex: 'gainDetails',
      width: 200,
      customRender: ({ record }: { record: GachaponGameRecordRow }) => {
        return getAwardDetails(
          record.gainType,
          record.gainCurrencyType,
          record.gainBalance,
          record.gainItemID,
          record.spendingItem,
        );
      },
    },
    {
      title: t('tables.gainAmount'),
      dataIndex: 'gainAmount',
      width: 120,
      align: 'right',
    },
    {
      title: t('tables.playDateTime'),
      dataIndex: 'playDateTime',
      width: 180,
      customRender: ({ record }: { record: GachaponGameRecordRow }) => {
        return record.playDateTime ? dayjs(record.playDateTime).format('YYYY-MM-DD HH:mm:ss') : '';
      },
    },
  ];
}
