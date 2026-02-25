import type { Composer } from 'vue-i18n';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import { h } from 'vue';

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
    hideInTable: true, // 不顯示在資料表中
    /**
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      const id = record?.treasureItemID ?? '';
      return h('span', {
        style: { cursor: 'pointer' },
        onClick: (_e: MouseEvent) => {
          if (id) {
            navigator.clipboard.writeText(id);
            // 可以添加提示訊息
          }
        },
      }, id);
    },
  },
  {
    title: t('table.type'),
    dataIndex: 'itemType',
    width: 120,
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      const result = t(`itemType.${record.itemType}`);
      // 確保返回字符串或 VNode，不可返回 undefined
      return result ?? h('span', ''); // 若 result 為 undefined，返回空 VNode
    },
  },
  {
    title: t('table.tagID'),
    dataIndex: 'tag',
    width: 150,
    hideInSearch: true,
    hideInTable: true, // 不顯示在資料表中
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
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      const imageUrl = record.teamIcon ? `${cdnBaseUrl}${record.teamIcon}` : '';
      if (!imageUrl) {
        return h('span', '-'); // 返回 VNode，不可返回字符串或 undefined
      }
      return h('img', {
        src: imageUrl,
        style: {
          height: '50px',
          width: '50px',
          objectFit: 'contain',
        },
        alt: record.itemName || '',
      });
    },
  },
  {
    title: t('table.iconFile'),
    dataIndex: 'iconUrl',
    width: 100,
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      const imageUrl = record.iconUrl ? `${cdnBaseUrl}${record.iconUrl}` : '';
      if (!imageUrl) {
        return h('span', '-'); // 返回 VNode，不可返回字符串或 undefined
      }
      return h('img', {
        src: imageUrl,
        style: {
          height: '50px',
          width: '50px',
          objectFit: 'contain',
        },
        alt: record.itemName || '',
      });
    },
  },
  {
    title: t('table.enabled'),
    dataIndex: 'enabled',
    width: 100,
    hideInSearch: true,
    /**
     * Phase 5: 改為文字顯示，使用 Tag 組件提升視覺效果
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      const enabled = !!record.enabled;
      const text = enabled ? t('enable') : t('disable');
      return h(Tag, {
        color: enabled ? 'success' : 'error',
      }, text ?? ''); // 確保 text 不為 undefined
    },
  },
  {
    title: t('table.creationDate'),
    dataIndex: 'creationDate',
    width: 180,
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      if (!record.creationDate) {
        return h('span', '-'); // 返回 VNode，不可返回字符串或 undefined
      }
      const date = new Date(record.creationDate);
      const dateStr = date.toLocaleString('zh-TW');
      return h('span', dateStr ?? ''); // 確保不返回 undefined
    },
  },
  {
    title: t('table.updatedOn'),
    dataIndex: 'updatedOn',
    width: 180,
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      if (!record.updatedOn) {
        return h('span', '-'); // 返回 VNode，不可返回字符串或 undefined
      }
      const date = new Date(record.updatedOn);
      const dateStr = date.toLocaleString('zh-TW');
      return h('span', dateStr ?? ''); // 確保不返回 undefined
    },
  },
  {
    title: t('table.control'),
    key: 'ACTION',
    width: 150,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
  },
];
