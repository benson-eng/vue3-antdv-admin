import type { StickerColumns } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import { h } from 'vue';

export type TableListItem = StickerColumns;
export type TableColumnItem = TableColumn<TableListItem>;

/**
 * 取得基礎欄位定義
 * @param pt - i18n 翻譯函數
 * @param opts - 選項配置
 */
export const getBaseColumns = (
  pt: (key: string) => string,
  opts: {
    onEdit?: (record: TableListItem) => void;
    onDelete?: (record: TableListItem) => void;
    /**
     * 站長選項列表（用於搜尋區）
     */
    masterAgentOptions?: Array<{ label: string; value: string }>;
    /**
     * 是否顯示站長搜尋欄位（權限 < 4 時顯示）
     */
    showMasterAgentSearch?: boolean;
  } = {},
): TableColumnItem[] => {
  const { onEdit, onDelete, masterAgentOptions, showMasterAgentSearch } = opts;

  const columns: TableColumnItem[] = [];

  // 站長搜尋欄位（主控欄位，必須先選擇才能查詢）
  if (showMasterAgentSearch) {
    columns.push({
      title: '站長',
      dataIndex: 'masterAgent',
      width: 200,
      hideInTable: true, // 不在表格中顯示，僅在搜尋區顯示
      formItemProps: {
        component: 'Select',
        componentProps: {
          placeholder: pt('placeholder.selectMasterAgent') || '請選擇站長',
          allowClear: true,
          options: masterAgentOptions || [],
        },
      },
    });
  }

  columns.push(
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      hideInSearch: true,
    },
    {
      title: pt('labels.stickerName'),
      dataIndex: 'name',
      width: 200,
      hideInSearch: true,
    },
    {
      title: pt('labels.stickerIcon'),
      dataIndex: 'url',
      width: 150,
      hideInSearch: true,
      customRender: ({ record }) => {
        if (!record.url) {
          return '-';
        }
        return h('img', {
          src: record.url,
          alt: record.name || 'sticker',
          style: {
            height: '50px',
            width: '50px',
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto',
            cursor: 'pointer',
          },
          onError: (e: Event) => {
            console.error('Image load error for URL:', record.url);
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            img.alt = 'Failed to load image';
          },
          onClick: () => {
            if (record.url) {
              window.open(record.url, '_blank');
            }
          },
        });
      },
    },
  );

  // 動作欄
  if (onEdit || onDelete) {
    columns.push({
      title: pt('labels.control'),
      dataIndex: 'ACTION',
      width: 200,
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap',
          },
        };
      },
      actions: ({ record }) => {
        const actions = [];
        if (onEdit) {
          actions.push({
            label: pt('edit'),
            type: 'link',
            icon: h(EditOutlined),
            onClick: () => onEdit(record),
          });
        }
        if (onDelete) {
          actions.push({
            label: pt('delete'),
            type: 'link',
            danger: true,
            icon: h(DeleteOutlined),
            onClick: () => onDelete(record),
          });
        }
        return actions;
      },
    });
  }

  return columns;
};
