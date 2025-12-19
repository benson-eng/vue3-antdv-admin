import { PlusOutlined } from '@ant-design/icons-vue';
import type { UploadProps } from 'ant-design-vue';
import type { FormSchema } from '@/components/core/schema-form';
import { getMasterAgentList } from '@/api/backend/adminAccount/admin';
import { TokenType } from '@/api/backend/adminAccount/token';

export enum TransactionLimitType {
  NotGift = 0, // 不可贈送
  CanGift = 1, // 可贈送
}

export type TokenFormValues = {
  id?: number;
  masterAgent: string;
  type: TokenType;
  name: string;
  transactionLimitType: TransactionLimitType;
  transactionLimit?: number;
  iconFileList?: any[];
};

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
  if (!isJpgOrPng) return false;
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) return false;
  // 回傳 false：阻止 Upload 自動上傳，僅保留 fileList 給 onFinish 組 FormData
  return false;
};

export const getTokenSchemas = (opts: { isEdit: boolean }): FormSchema<TokenFormValues>[] => {
  return [
    {
      field: 'masterAgent',
      label: '總代理',
      component: 'Select',
      rules: [{ required: true, message: '請選擇總代理' }],
      colProps: { span: 12 },
      componentProps: {
        placeholder: '請選擇總代理',
        disabled: opts.isEdit,
        request: async () => {
          const list = await getMasterAgentList();
          return list.map((item) => ({
            label: item.account,
            value: item.account,
          }));
        },
      },
    },
    {
      field: 'type',
      label: '代幣類型',
      component: 'Select',
      rules: [{ required: true, message: '請選擇代幣類型' }],
      colProps: { span: 12 },
      componentProps: {
        placeholder: '請選擇代幣類型',
        disabled: opts.isEdit, // 對齊 Vue2：編輯時不讓改 type
        options: [
          { label: '轉蛋券', value: TokenType.GACHAPON_TICKET },
          { label: '黃金券', value: TokenType.GOLDEN_TICKET },
        ],
      },
    },
    {
      field: 'name',
      label: '代幣名稱',
      component: 'Input',
      rules: [{ required: true, message: '請輸入代幣名稱' }],
      colProps: { span: 12 },
    },
    {
      field: 'transactionLimitType',
      label: '可否贈送',
      component: 'RadioGroup',
      defaultValue: TransactionLimitType.NotGift,
      colProps: { span: 12 },
      componentProps: {
        options: [
          { label: '不可贈送', value: TransactionLimitType.NotGift },
          { label: '可贈送', value: TransactionLimitType.CanGift },
        ],
      },
    },
    {
      field: 'transactionLimit',
      label: '贈送上限',
      component: 'InputNumber',
      vIf: ({ formModel }) => formModel.transactionLimitType === TransactionLimitType.CanGift,
      rules: [{ required: true, type: 'number', message: '請輸入贈送上限' }],
      colProps: { span: 12 },
      componentProps: {
        min: 1,
        precision: 0,
        placeholder: '請輸入贈送上限',
      },
    },
    {
      field: 'iconFileList',
      label: '代幣圖示',
      component: 'Upload',
      rules: [{ required: true, type: 'array', message: '請上傳代幣圖示' }],
      colProps: { span: 24 },
      componentProps: {
        maxCount: 1,
        listType: 'picture-card',
        accept: 'image/png,image/jpeg',
        beforeUpload,
      },
      componentSlots: ({ formModel }) => ({
        default: () =>
          formModel.iconFileList?.length ? (
            ''
          ) : (
            <div>
              <PlusOutlined />
              <div class="mt-8px">Upload</div>
            </div>
          ),
      }),
    },
  ];
};

