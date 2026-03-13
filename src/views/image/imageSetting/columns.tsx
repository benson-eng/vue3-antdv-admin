import type { IconItem } from '@/api/backend/treasureChestSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import { DeleteOutlined } from '@ant-design/icons-vue';
import { Button } from 'ant-design-vue';
import { h } from 'vue';

type I18nGlobalTranslation = (key: string) => string;

export type TableColumnItem = TableColumn<IconItem>;
export type TableListItem = IconItem;

export const getColumns = (
  t: I18nGlobalTranslation,
  cdnBaseUrl: string,
  onDelete: (record: IconItem) => void,
  isChangeable: (record: IconItem) => boolean,
): TableColumnItem[] => [
  {
    title: 'ID',
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
    title: t('labels.type'),
    dataIndex: 'type',
    width: 80,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      const typeText = record?.type ? t(`type.${record.type}`) : '-';
      return h('span', typeText);
    },
  },
  {
    title: t('labels.name'),
    dataIndex: 'name',
    width: 200,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      const name = record?.name ?? '';
      return h('span', name || '-');
    },
  },
  {
    title: t('labels.image'),
    dataIndex: 'url',
    width: 200,
    align: 'center',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，若條件不成立請回傳 null
     */
    customRender: ({ record }) => {
      if (!record?.url) {
        return h('span', '-');
      }
      // 對齊 Vue2：assetsDomainName + row.url (直接拼接)
      // 如果已經是完整 URL，直接返回
      const imageUrl = /^https?:\/\//i.test(record.url)
        ? record.url
        : cdnBaseUrl
          ? `${cdnBaseUrl}${record.url}`
          : record.url;
      if (!imageUrl) {
        return h('span', '-');
      }
      return h('img', {
        src: imageUrl,
        width: 50,
        height: 50,
        loading: 'lazy',
        style: { objectFit: 'cover' },
        alt: 'icon',
      });
    },
  },
  {
    title: t('labels.actions'),
    key: 'ACTION',
    width: 250,
    align: 'center',
    fixed: 'right',
    hideInSearch: true,
    /**
     * 【修復規則2】customRender 不可回傳 undefined，確保返回 VNode
     */
    customRender: ({ record }) => {
      return h(Button, {
        type: 'link',
        danger: true,
        size: 'small',
        disabled: isChangeable(record),
        icon: h(DeleteOutlined),
        onClick: () => onDelete(record),
      }, () => t('buttons.delete'));
    },
  },
];
