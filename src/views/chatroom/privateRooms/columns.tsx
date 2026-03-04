import type { PrivateTeamInfo } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
// SearchTypeEnum 需要作為值導入，因為在函數體內使用 searchTypeEnum.IS_EXIST（需要運行時值）
// 同時 typeof SearchTypeEnum 也需要值來獲取類型
// 注意：雖然 linter 提示應使用 type import，但實際上在函數體內需要運行時值
import { PrivateTeamSearchType as SearchTypeEnum } from '@/api/backend/adminSystem/gameChatroomSystem';

// 明確使用 SearchTypeEnum 作為值，確保 linter 知道這是值導入
void SearchTypeEnum;

export type TableListItem = PrivateTeamInfo;
export type TableColumnItem = TableColumn<TableListItem>;

export const getBaseColumns = (
  pt: (key: string) => string,
  searchTypeEnum: typeof SearchTypeEnum,
): TableColumnItem[] => [
  {
    title: pt('privateTeamID'),
    dataIndex: 'privateTeamID',
    width: 200,
    hideInSearch: true,
  },
  {
    title: pt('privateName'),
    dataIndex: 'name',
    width: 200,
    hideInSearch: true,
  },
  {
    title: pt('memberID'),
    dataIndex: 'nickName',
    width: 200,
    hideInSearch: true,
  },
  {
    title: pt('owner'),
    dataIndex: 'ownerName',
    width: 200,
    hideInSearch: true,
  },
  {
    title: pt('SearchType'),
    dataIndex: 'searchType',
    width: 150,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (record.searchType === searchTypeEnum.IS_EXIST) {
        return pt('PrivateTeamSearchType.1');
      }
      else if (record.searchType === searchTypeEnum.IS_NOT_EXIST) {
        return pt('PrivateTeamSearchType.2');
      }
      return '';
    },
  },
];
