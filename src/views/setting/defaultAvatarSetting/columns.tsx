import type { Composer } from 'vue-i18n';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import { h } from 'vue';

type I18nGlobalTranslation = Composer['t'];

export interface DefaultAvatarItem {
  id: number;
  masterAgent: string;
  profileID?: string;
  profileUrl: string;
  isEnabled: boolean;
  createDateTime?: string;
}

export type TableColumnItem = TableColumn<DefaultAvatarItem>;

export const getColumns = (
  t: I18nGlobalTranslation,
  cdnBaseUrl: string,
): TableColumnItem[] => [
  {
    title: t('columns.id'),
    dataIndex: 'id',
    width: 80,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      const id = record?.id ?? '';
      return h('span', String(id));
    },
  },
  {
    title: t('columns.profileUrl'),
    dataIndex: 'profileUrl',
    width: 200,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      if (!record.profileUrl) {
        return h('span', '-');
      }
      const imageUrl = record.profileUrl
        ? (record.profileUrl.startsWith('http') ? record.profileUrl : `${cdnBaseUrl}${record.profileUrl}`)
        : '';
      if (!imageUrl) {
        return h('span', '-');
      }
      return h('img', {
        src: imageUrl,
        width: 50,
        height: 50,
        loading: 'lazy',
        style: { objectFit: 'cover' },
        alt: 'avatar',
      });
    },
  },
  {
    title: t('columns.ebableStatus'),
    dataIndex: 'isEnabled',
    width: 100,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      const isEnabled = !!record.isEnabled;
      const text = isEnabled ? t('labels.enable') : t('labels.disable');
      return h(Tag, {
        color: isEnabled ? 'success' : 'default',
      }, text ?? '');
    },
  },
  {
    title: t('columns.createDateTime'),
    dataIndex: 'createDateTime',
    width: 175,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      if (!record.createDateTime) {
        return h('span', '-');
      }
      const date = new Date(record.createDateTime);
      const dateStr = date.toLocaleString('zh-TW');
      return h('span', dateStr ?? '');
    },
  },
  {
    title: t('columns.actions'),
    key: 'ACTION',
    width: 250,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
  },
];
