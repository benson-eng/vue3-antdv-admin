import type { Composer } from 'vue-i18n';
import type { ItemTag } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

type I18nGlobalTranslation = Composer['t'];

export type TableColumnItem = TableColumn<ItemTag>;

export const getColumns = (
  t: I18nGlobalTranslation,
): TableColumnItem[] => [
  {
    title: t('table.tagID'),
    dataIndex: 'id',
    width: 100,
    hideInSearch: true,
    hideInTable: true,
  },
  {
    title: t('table.itemType'),
    dataIndex: 'itemType',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => t(`itemType.${record.itemType}`),
  },
  {
    title: t('table.tag'),
    dataIndex: 'tag',
    width: 200,
    hideInSearch: true,
  },
  {
    title: t('table.order'),
    dataIndex: 'order',
    width: 100,
    hideInSearch: true,
    hideInTable: true,
  },
  {
    title: t('table.enabled'),
    dataIndex: 'enabled',
    width: 100,
    hideInSearch: true,
  },
  {
    title: t('table.control'),
    dataIndex: 'ACTION',
    width: 150,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
  },
];
