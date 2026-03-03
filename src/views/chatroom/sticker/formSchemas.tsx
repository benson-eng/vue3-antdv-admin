import type { Composer } from 'vue-i18n';
import type { FormSchema } from '@/components/core/schema-form';
import type { UploadFile } from 'ant-design-vue';
import { UploadOutlined } from '@ant-design/icons-vue';
import { Button, Upload } from 'ant-design-vue';
import { h } from 'vue';

type I18nGlobalTranslation = Composer['t'];

export interface StickerFormValues {
  name: string;
  imageFile?: File;
}

/**
 * 取得貼圖表單 Schema
 * @param pt - i18n 翻譯函數
 * @param opts - 選項配置
 */
export const getStickerSchemas = (
  pt: (key: string) => string,
  opts: {
    previewUrl?: string;
    onFileChange?: (file: File | undefined) => void;
    onRemovePreview?: () => void;
  } = {},
): FormSchema<StickerFormValues>[] => {
  const { previewUrl, onFileChange, onRemovePreview } = opts;

  return [
    {
      field: 'name',
      component: 'Input',
      label: pt('labels.stickerName'),
      rules: [
        {
          required: true,
          message: pt('notify.required'),
        },
      ],
      componentProps: {
        placeholder: pt('labels.stickerName'),
        autocomplete: 'off',
      },
    },
    {
      field: 'imageFile',
      component: 'Custom',
      label: pt('labels.stickerIcon'),
      componentProps: {},
      renderComponentContent: () => {
        return h('div', { style: 'display: flex; flex-direction: column; gap: 10px;' }, [
          h(Upload, {
            beforeUpload: () => false,
            showUploadList: false,
            accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp',
            onChange: (info: { file: UploadFile; fileList: UploadFile[] }) => {
              const file = info.file;
              if (file.status === 'removed') {
                onFileChange?.(undefined);
                return;
              }

              let fileObj: File | undefined;
              if (file.originFileObj) {
                fileObj = file.originFileObj;
              }
              else if ((file as any).originFile) {
                fileObj = (file as any).originFile;
              }
              else if (info.fileList && info.fileList.length > 0) {
                const lastFile = info.fileList[info.fileList.length - 1];
                if (lastFile.originFileObj) {
                  fileObj = lastFile.originFileObj;
                }
                else if ((lastFile as any).originFile) {
                  fileObj = (lastFile as any).originFile;
                }
              }

              if (!fileObj) {
                return;
              }

              const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
              if (!fileObj.type || !validImageTypes.includes(fileObj.type.toLowerCase())) {
                return;
              }

              const maxSize = 5 * 1024 * 1024;
              if (fileObj.size > maxSize) {
                return;
              }

              onFileChange?.(fileObj);
            },
          }, {
            default: () => h(Button, {}, {
              icon: () => h(UploadOutlined),
              default: () => '選擇圖片',
            }),
          }),
          previewUrl
            ? h('div', { style: 'position: relative; display: inline-block;' }, [
                h('img', {
                  src: previewUrl,
                  style: 'width: 150px; height: 150px; object-fit: contain; border: 1px solid #d9d9d9; border-radius: 4px; padding: 4px; background: #fafafa;',
                  alt: 'preview',
                }),
                h(Button, {
                  type: 'text',
                  danger: true,
                  size: 'small',
                  style: 'position: absolute; top: 0; right: 0;',
                  onClick: () => {
                    onRemovePreview?.();
                  },
                }, {
                  default: () => '移除',
                }),
              ])
            : null,
        ]);
      },
    },
  ];
};

/**
 * 取得搜尋表單的 schemas
 *
 * 【搜尋欄位】
 * - name：貼圖名稱搜尋（可選欄位）
 *   - 類型：Input
 *   - 控制權：DynamicTable 搜尋表單
 *
 * 【注意】
 * - masterAgent 不在搜尋表單中（使用 Breadcrumb Context）
 * - 所有欄位均為可選，無必填欄位
 */
export const getSearchSchemas = (t: I18nGlobalTranslation): FormSchema[] => [
  {
    field: 'name',
    label: t('labels.stickerName'),
    component: 'Input',
    componentProps: {
      placeholder: t('placeholder.enterStickerName') || '請輸入貼圖名稱',
      allowClear: true,
    },
  },
];
