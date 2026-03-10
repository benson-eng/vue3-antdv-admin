import type { RoomInfo } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

export type TableListItem = RoomInfo;
export type TableColumnItem = TableColumn<TableListItem>;

export interface GetColumnsOptions {
  getI18nText: (path: string) => string;
  findTeamName: (teamID: string) => string;
}

export const getBaseColumns = (opts: GetColumnsOptions): TableColumnItem[] => {
  const { getI18nText, findTeamName } = opts;

  return [
    {
      title: getI18nText('teamName'),
      dataIndex: 'teamID',
      width: 200,
      hideInSearch: true,
      customRender: ({ record }) => findTeamName(record.teamID || ''),
    },
    {
      title: getI18nText('roomID'),
      dataIndex: 'roomID',
      width: 200,
      hideInSearch: true,
    },
    {
      title: getI18nText('type'),
      dataIndex: 'type',
      width: 150,
      hideInSearch: true,
      customRender: ({ record }) => getI18nText(`RoomType.${record.type}`),
    },
    {
      title: getI18nText('announcement'),
      dataIndex: 'announcement',
      width: 300,
      hideInSearch: true,
    },
  ];
};
