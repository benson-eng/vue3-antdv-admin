import type { ValidFrozenStatementItem } from '@/api/backend/transactionSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import dayjs from 'dayjs';

export type TableListItem = ValidFrozenStatementItem & {
  accountID: string;
  nickName: string;
  formattedFrozenBalance: string;
  formattedTargetAccumulatedBet: string;
};

export type TableColumnItem = TableColumn<TableListItem>;

/**
 * 會員搜尋選項類型
 */
export interface MemberSearchOption {
  label: string;
  value: string;
  raw: any;
}

/**
 * 獲取基礎欄位定義
 * @param t - i18n 翻譯函數
 * @param commonT - 通用翻譯函數
 * @param memberOptions - 會員搜尋選項（響應式）
 * @param memberLoading - 會員搜尋載入狀態（響應式）
 * @param currentAgentID - 當前代理 ID（響應式）
 * @param onMemberSearch - 會員搜尋處理函數
 * @param onMemberPopupScroll - 會員選單滾動處理函數
 */
export const getBaseColumns = (
  t: (key: string) => string,
  commonT: (key: string) => string,
  memberOptions: () => MemberSearchOption[],
  memberLoading: () => boolean,
  currentAgentID: () => string,
  hasSubmitted: () => boolean,
  onMemberSearch: (text: string) => void,
  onMemberPopupScroll: (e: Event) => void,
): TableColumnItem[] => {
  const columns: TableColumnItem[] = [
    // 搜尋欄位：會員 ID（可見）
    {
      title: t('column.memberID'),
      dataIndex: 'memberID',
      hideInTable: true,
      searchField: 'memberID',
      formItemProps: {
        label: t('labels.member') || '會員',
        component: 'Select',
        // Submit-driven validation：使用自訂 validator
        rules: [
          {
            validator: async (_rule: any, value: any) => {
              // 未按過查詢，不驗證
              if (!hasSubmitted()) {
                return Promise.resolve();
              }

              // disabled 時不驗證
              if (!currentAgentID()) {
                return Promise.resolve();
              }

              if (!value) {
                return Promise.reject(t('notify.needAccount'));
              }

              return Promise.resolve();
            },
          },
        ],
        componentProps: () => ({
          options: memberOptions(),
          loading: memberLoading(),
          showSearch: true,
          filterOption: false,
          allowClear: true,
          disabled: !currentAgentID(),
          onSearch: onMemberSearch,
          onPopupScroll: onMemberPopupScroll,
        }),
      },
    },
    // 搜尋欄位：agentID（隱藏，僅作為 payload）
    {
      title: 'agentID',
      dataIndex: 'agentID',
      hideInSearch: true,
      hideInTable: true,
      formItemProps: {
        component: 'Input',
        defaultValue: () => currentAgentID(),
        componentProps: { style: { display: 'none' } },
      },
    },
    // 資料顯示欄位
    {
      title: t('column.accountID'),
      dataIndex: 'accountID',
      flexible: true, // 彈性寬度欄位
      minWidth: 120, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('column.nickName'),
      dataIndex: 'nickName',
      flexible: true, // 彈性寬度欄位
      minWidth: 150, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('column.sourcePlatform'),
      dataIndex: 'sourcePlatform',
      flexible: true, // 彈性寬度欄位
      minWidth: 150, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('column.frozenBalance'),
      dataIndex: 'formattedFrozenBalance',
      flexible: true, // 彈性寬度欄位
      minWidth: 150, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('column.frozenAt'),
      dataIndex: 'frozenAt',
      flexible: true, // 彈性寬度欄位
      minWidth: 180, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
      customRender: ({ record }) =>
        record.frozenAt ? dayjs(record.frozenAt).format('YYYY-MM-DD HH:mm:ss') : '',
    },
    {
      title: t('column.targetAccumulatedBet'),
      dataIndex: 'formattedTargetAccumulatedBet',
      flexible: true, // 彈性寬度欄位
      minWidth: 150, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('column.unfrozenAt'),
      dataIndex: 'unfrozenAt',
      flexible: true,
      minWidth: 180,
      hideInSearch: true,
      customRender: ({ record }) =>
        record.unfrozenAt ? dayjs(record.unfrozenAt).format('YYYY-MM-DD HH:mm:ss') : '',
    },
  ];

  return columns;
};

/**
 * 獲取包含操作欄的完整欄位定義
 * @param t - i18n 翻譯函數
 * @param commonT - 通用翻譯函數
 * @param memberOptions - 會員搜尋選項（響應式）
 * @param memberLoading - 會員搜尋載入狀態（響應式）
 * @param currentAgentID - 當前代理 ID（響應式）
 * @param onMemberSearch - 會員搜尋處理函數
 * @param onMemberPopupScroll - 會員選單滾動處理函數
 * @param handleRemove - 解凍處理函數
 */
export const getBaseColumnsWithAction = (
  t: (key: string) => string,
  commonT: (key: string) => string,
  memberOptions: () => MemberSearchOption[],
  memberLoading: () => boolean,
  currentAgentID: () => string,
  hasSubmitted: () => boolean,
  onMemberSearch: (text: string) => void,
  onMemberPopupScroll: (e: Event) => void,
  handleRemove: (record: TableListItem) => void,
): TableColumnItem[] => {
  const baseColumns = getBaseColumns(
    t,
    commonT,
    memberOptions,
    memberLoading,
    currentAgentID,
    hasSubmitted,
    onMemberSearch,
    onMemberPopupScroll,
  );

  // 添加操作欄
  const columnsWithAction: TableColumnItem[] = [
    ...baseColumns,
    {
      title: commonT('action.operation'),
      dataIndex: 'ACTION',
      width: 100,
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      /**
       * 防止內容換行
       */
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap', // 禁止換行
          },
        };
      },
      actions: ({ record }) => {
        // 根據 Vue2 版本邏輯：當 isEnabled 為 true 時，按鈕應被禁用
        const isDisabled = Boolean((record as any).isEnabled);
        return [
          {
            label: t('column.unfrozen') || '解凍',
            type: 'link',
            danger: true,
            disabled: isDisabled,
            popConfirm: {
              title: t('title.removeStatement'),
              content: t('notify.removeStatement'),
              onConfirm: async () => {
                await handleRemove(record);
              },
            },
          },
        ];
      },
    },
  ];

  return columnsWithAction;
};
