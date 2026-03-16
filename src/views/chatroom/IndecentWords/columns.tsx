import type { TableColumn } from '@/components/core/dynamic-table';

export interface DataListItem {
  /**
   * 可選屬性，已移除序號欄位，使用列設置中的"序號列"開關功能
   */
  seq?: number;
  value: string;
}

export type TableListItem = DataListItem;
export type TableColumnItem = TableColumn<TableListItem>;

/**
 * 取得基礎欄位定義
 * @param pt - i18n 翻譯函數
 * @param _userLevel - 使用者權限等級（保留參數以保持函數簽名一致性）
 * @param _masterAgentOptions - 站長選項列表（已移除，保留參數以保持向後兼容）
 */
export const getBaseColumns = (
  pt: (key: string) => string,
  _userLevel: number,
  _masterAgentOptions?: Array<{ label: string; value: string }>,
): TableColumnItem[] => {
  const columns: TableColumnItem[] = [];

  // 注意：站長欄位已移除，改為使用 Breadcrumb Context 自動 reload
  // 注意：序號欄位已移除，使用列設置中的"序號列"開關功能

  columns.push(
    {
      title: pt('labels.setString'),
      dataIndex: 'value',
      flexible: true, // 彈性寬度欄位
      minWidth: 200, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
  );

  return columns;
};
