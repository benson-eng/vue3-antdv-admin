// ARCH03-02：Table Behavior 結構化轉換
// 本檔案為 Table Behavior 的唯一來源，包含欄位定義、顯示控制、寬度策略等
import type { Ref } from 'vue';
import type { IExternalGameRecordColumn } from '@/api/backend/adminSystem/gameRecordServer';
import type { TableColumn } from '@/components/core/dynamic-table';

import dayjs from 'dayjs';
import { computed } from 'vue';
import { useTableConfig } from '@/views/adminAccount/masterAgent/useTableConfig';

export type ColumnsRowData = IExternalGameRecordColumn & {
  id: number;
  /** 帳戶ID（由 queryAccountBaseInfo 批次補齊） */
  accountID?: string;
  /** 暱稱（由 queryAccountBaseInfo 批次補齊） */
  nickName?: string;
};

export type TableColumnItem = TableColumn<ColumnsRowData>;

export interface CreateColumnsOptions {
  t: (key: string) => string;
  formatAmount2: (val: number | string | null | undefined, showDecimal?: boolean) => string;
  gameList: Ref<Record<string, string>>;
  currencyTypeList: Ref<Array<{ name: string; value: string }>>;
}

/**
 * 格式化平台名稱
 */
function formatPlatform(platform: string): string {
  return platform === 'T9SingleWallet' ? 'T9LIVE' : platform;
}

/**
 * ARCH03-02：建立 baseColumns（欄位結構與 render）
 */
export function createBaseColumns(options: CreateColumnsOptions): TableColumnItem[] {
  const { t, formatAmount2, gameList, currencyTypeList } = options;

  const getGameName = (gameID: string): string => {
    return gameID && gameList.value[gameID] ? `${gameID} - ${gameList.value[gameID]}` : gameID;
  };

  const getCurrencyName = (currencyType: string): string => {
    const found = currencyTypeList.value.find(c => c.value === currencyType);
    return found ? found.name : currencyType;
  };

  const getBetTypeName = (betType: string): string => {
    return t(`betType.${betType}`) || betType;
  };

  return [
    {
      title: t('labels.wagersID'),
      dataIndex: 'wagersID',
      width: 150,
    },
    {
      title: t('labels.externalPlatform'),
      dataIndex: 'externalPlatform',
      width: 150,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return formatPlatform(record.externalPlatform);
      },
    },
    {
      title: t('labels.accountID') || '帳戶ID',
      dataIndex: 'accountID',
      /** 彈性寬度欄位（對齊 agent 頁策略） */
      flexible: true,
      /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
      minWidth: 150,
      width: 150,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return record.accountID || '';
      },
    },
    {
      title: t('labels.nickName') || '暱稱',
      dataIndex: 'nickName',
      /** 彈性寬度欄位（對齊 agent 頁策略） */
      flexible: true,
      /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
      minWidth: 150,
      width: 150,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return record.nickName || '';
      },
    },
    {
      title: t('labels.gameID'),
      dataIndex: 'gameID',
      /** 彈性寬度欄位（對齊 agent 頁策略） */
      flexible: true,
      /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
      minWidth: 200,
      width: 200,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return getGameName(record.gameID);
      },
    },
    {
      title: t('labels.currencyType'),
      dataIndex: 'currencyType',
      width: 120,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return getCurrencyName(record.currencyType);
      },
    },
    {
      title: t('labels.betType'),
      dataIndex: 'betType',
      width: 150,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return record.betType ? getBetTypeName(record.betType) : '';
      },
    },
    {
      title: t('labels.totalBet'),
      dataIndex: 'totalBet',
      width: 150,
      align: 'right',
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return formatAmount2(record.totalBet);
      },
    },
    {
      title: t('labels.totalWin'),
      dataIndex: 'totalWin',
      width: 150,
      align: 'right',
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return formatAmount2(record.totalWin);
      },
      customCell: (record: ColumnsRowData) => {
        const win = Number.parseFloat(String(record.totalWin));
        return win > 0 ? { style: { color: '#FF4949' } } : {};
      },
    },
    {
      title: t('labels.winLose'),
      dataIndex: 'winLose',
      width: 150,
      align: 'right',
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return formatAmount2(record.winLose);
      },
      customCell: (record: ColumnsRowData) => {
        const winLose = Number.parseFloat(String(record.winLose));
        return winLose > 0 ? { style: { color: '#FF4949' } } : { style: { color: '#3AB982' } };
      },
    },
    {
      title: t('labels.note'),
      dataIndex: 'buyFeature',
      width: 150,
    },
    {
      title: t('labels.playDateTime'),
      dataIndex: 'playDateTime',
      /** 彈性寬度欄位（對齊 agent 頁策略：日期時間欄位使用 flexible） */
      flexible: true,
      /** flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0 */
      minWidth: 180,
      width: 180,
      customRender: ({ record }: { record: ColumnsRowData }) => {
        return record.playDateTime ? dayjs(record.playDateTime).format('YYYY-MM-DD HH:mm:ss') : '';
      },
    },
  ];
}

/**
 * ARCH03-02：建立 columns 和 tableConfig
 * 封裝與 useTableConfig 相關的欄位行為
 */
export function useExternalGameRecordsColumns(options: CreateColumnsOptions) {
  // 建立 baseColumns（使用 computed 以響應 gameList 和 currencyTypeList 的變化）
  // gameList 和 currencyTypeList 在 createBaseColumns 中使用，不需要在此處解構
  const baseColumns = computed(() => createBaseColumns(options));

  // 使用表格配置 Hook
  // 使用類型斷言，因為 useTableConfig 設計為通用，但類型定義較嚴格
  const tableConfig = useTableConfig(baseColumns as any);

  // 根據 visibleColumnKeys 設置欄位的 hideInTable
  // Guard: 若 visibleColumnKeys 尚未初始化完成（空或無效），不得套用 hideInTable，必須維持全部顯示
  // STEP 3 定型欄位數量：12 個（wagersID, externalPlatform, accountID, nickName, gameID, currencyType, betType, totalBet, totalWin, winLose, buyFeature, playDateTime）
  // 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
  const columns = computed<TableColumnItem[]>(() => {
    const visibleKeys = tableConfig.visibleColumnKeys.value;
    // 如果 visibleColumnKeys 為空或無效，不套用 hideInTable（全部顯示）
    // 檢查 visibleColumnKeys 是否已正確初始化（至少包含所有預期的欄位，至少 12 個）
    const expectedMinKeys = 12;
    const hasValidVisibleKeys = Array.isArray(visibleKeys) && visibleKeys.length >= expectedMinKeys;

    return baseColumns.value.map((col) => {
      const key = (col.dataIndex as string) || ((col as any).key as string) || '';

      // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
      const isVisible = hasValidVisibleKeys ? visibleKeys.includes(key) : true;

      const processedCol: TableColumnItem = {
        ...col,
        hideInTable: !isVisible,
      } as TableColumnItem;

      // 如果欄位是 flexible 但沒有設置 minWidth，設置預設值
      // 這樣可以避免初始 render 時被壓縮為 0
      if (processedCol.flexible && !processedCol.minWidth) {
        processedCol.minWidth = 100; // 預設最小寬度 100px
      }

      // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
      // 這樣可以避免初始 render 時被壓縮為 0
      if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
        processedCol.width = processedCol.minWidth;
      }

      return processedCol;
    });
  });

  return {
    columns,
    tableConfig,
  };
}
