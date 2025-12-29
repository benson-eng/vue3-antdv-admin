import { h } from 'vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { Composer } from 'vue-i18n';

type I18nGlobalTranslation = Composer['t'];

export interface GuildLevelItem {
  id: number | null;
  level: number | null;
  levelName: string;
  maxCounts: number | null;
  guildAccumulationFund: number | null;
  betFee: number | null;
  topUpFee: number | null;
  gameWinLoseFee: number | null;
}

export type TableColumnItem = TableColumn<GuildLevelItem>;

export const getColumns = (t: I18nGlobalTranslation): TableColumnItem[] => [
  {
    title: t('table.id'),
    dataIndex: 'id',
    width: 80,
    hideInSearch: true,
  },
  {
    title: t('table.level'),
    dataIndex: 'level',
    width: 80,
    hideInSearch: true,
  },
  {
    title: t('table.levelName'),
    dataIndex: 'levelName',
    width: 130,
    hideInSearch: true,
  },
  {
    title: t('table.maxCounts'),
    dataIndex: 'maxCounts',
    width: 100,
    hideInSearch: true,
  },
  {
    title: t('table.guildAccumulationFund'),
    dataIndex: 'guildAccumulationFund',
    width: 140,
    hideInSearch: true,
    customRender: ({ record }) => {
      return record.guildAccumulationFund !== null ? record.guildAccumulationFund : '-';
    },
  },
  {
    title: t('table.betFee'),
    dataIndex: 'betFee',
    width: 110,
    hideInSearch: true,
  },
  {
    title: t('table.topUpFee'),
    dataIndex: 'topUpFee',
    width: 110,
    hideInSearch: true,
  },
  {
    title: t('table.gameWinLoseFee'),
    dataIndex: 'gameWinLoseFee',
    width: 140,
    hideInSearch: true,
  },
  {
    title: t('table.control'),
    dataIndex: 'ACTION',
    width: 120,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
  },
];

