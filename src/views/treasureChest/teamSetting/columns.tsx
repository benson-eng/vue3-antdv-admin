import { h } from 'vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { Composer } from 'vue-i18n';

type I18nGlobalTranslation = Composer['t'];

export interface TeamBadgeItem {
  treasureItemID: string;
  itemName: string;
  itemType: string;
  tag: string | null;
  teamIcon: string;
  iconUrl: string;
  enabled: boolean | number;
  creationDate: string | Date;
  updatedOn: string | Date;
}

export type TableColumnItem = TableColumn<TeamBadgeItem>;

export const getColumns = (
  t: I18nGlobalTranslation,
  cdnBaseUrl: string,
): TableColumnItem[] => [
  {
    title: t('table.id'),
    dataIndex: 'treasureItemID',
    width: 150,
    hideInSearch: true,
    customRender: ({ record }) => {
      return h('span', {
        style: { cursor: 'pointer' },
        onClick: (e: MouseEvent) => {
          navigator.clipboard.writeText(record.treasureItemID);
          // 可以添加提示訊息
        },
      }, record.treasureItemID);
    },
  },
  {
    title: t('table.type'),
    dataIndex: 'itemType',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => t(`itemType.${record.itemType}`),
  },
  {
    title: t('table.tagID'),
    dataIndex: 'tag',
    width: 150,
    hideInSearch: true,
  },
  {
    title: t('table.itemName'),
    dataIndex: 'itemName',
    width: 200,
    hideInSearch: true,
  },
  {
    title: t('table.teamIcon'),
    dataIndex: 'teamIcon',
    width: 100,
    hideInSearch: true,
    customRender: ({ record }) => {
      const imageUrl = record.teamIcon ? `${cdnBaseUrl}${record.teamIcon}` : '';
      if (!imageUrl) return '-';
      return h('img', {
        src: imageUrl,
        style: {
          height: '50px',
          width: '50px',
          objectFit: 'contain',
        },
        alt: record.itemName,
      });
    },
  },
  {
    title: t('table.iconFile'),
    dataIndex: 'iconUrl',
    width: 100,
    hideInSearch: true,
    customRender: ({ record }) => {
      const imageUrl = record.iconUrl ? `${cdnBaseUrl}${record.iconUrl}` : '';
      if (!imageUrl) return '-';
      return h('img', {
        src: imageUrl,
        style: {
          height: '50px',
          width: '50px',
          objectFit: 'contain',
        },
        alt: record.itemName,
      });
    },
  },
  {
    title: t('table.enabled'),
    dataIndex: 'enabled',
    width: 100,
    hideInSearch: true,
    customRender: ({ record }) => {
      const enabled = !!record.enabled;
      return h('span', {
        style: {
          color: enabled ? 'rgb(133, 206, 97)' : 'rgb(245, 35, 73)',
        },
      }, enabled ? t('enable') : t('disable'));
    },
  },
  {
    title: t('table.creationDate'),
    dataIndex: 'creationDate',
    width: 180,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (!record.creationDate) return '-';
      const date = new Date(record.creationDate);
      return date.toLocaleString('zh-TW');
    },
  },
  {
    title: t('table.updatedOn'),
    dataIndex: 'updatedOn',
    width: 180,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (!record.updatedOn) return '-';
      const date = new Date(record.updatedOn);
      return date.toLocaleString('zh-TW');
    },
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

