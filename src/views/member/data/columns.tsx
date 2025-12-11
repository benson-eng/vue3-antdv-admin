import type { TableColumn } from '@/components/core/dynamic-table';
import { formatToDateTime } from '@/utils/dateUtil';

export interface TableListItem {
  id: string;
  account: string;
  status: number;
  superior: string;
  memberLevel: string;
  returnWaterLevel: string;
  vipLevel: string;
  promotionCode: string;
  superiorAccount: string;
  createdAt: string;
  updatedAt: string;
  // 新增搜索欄位
  realName?: string;
  phone?: string;
  idCard?: string;
  line?: string;
  registerIp?: string;
  lastLoginIp?: string;
  registerTime?: string;
  lastLoginTime?: string;
  registerSource?: string;
  depositCount?: number;
  firstDeposit?: string;
  firstWithdraw?: string;
}

export type TableColumnItem = TableColumn<TableListItem>;

export const baseColumns: TableColumnItem[] = [
  {
    title: '會員帳號',
    dataIndex: 'account',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '輸入會員帳號',
      },
      colProps: { span: 6 },
    },
  },
  {
    title: '狀態',
    dataIndex: 'status',
    width: 100,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: '全部', value: undefined },
          { label: '啟用中', value: 1 },
          { label: '停用', value: 0 },
        ],
      },
      colProps: { span: 6 },
    },
    customRender: ({ record }) => {
      const enable = ~~record.status === 1;
      return (
        <div class="flex items-center gap-1">
          <span class={`inline-block w-2 h-2 rounded-full ${enable ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{enable ? '啟用中' : '停用'}</span>
        </div>
      );
    },
  },
  {
    title: '上級代理',
    dataIndex: 'superior',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '輸入代理帳號',
      },
      colProps: { span: 6 },
    },
    customRender: ({ text }) => <a class="text-blue-500">{text}</a>,
  },
  {
    title: '上級會員',
    dataIndex: 'superiorAccount',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '輸入會員帳號',
      },
      colProps: { span: 6 },
    },
    customRender: ({ text }) => <a class="text-blue-500">{text}</a>,
  },
  {
    title: '會員層級',
    dataIndex: 'memberLevel',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: '全部', value: undefined },
          { label: '金流內層', value: '金流內層' },
          { label: '金流全開', value: '金流全開' },
          { label: '大額入款', value: '大額入款' },
          { label: '套利總級', value: '套利總級' },
          { label: '疑似套利', value: '疑似套利' },
        ],
      },
      colProps: { span: 6 },
    },
  },
  {
    title: '會員等級',
    dataIndex: 'vipLevel',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: 'VIP2', value: 'VIP2' },
          { label: 'VIP8', value: 'VIP8' },
          { label: '一般會員', value: '一般會員' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '首存首出',
    dataIndex: 'firstDeposit',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '無首出',
        options: [
          { label: '無首出', value: 'no_withdraw' },
          { label: '無首存', value: 'no_deposit' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '駐冊IP',
    dataIndex: 'registerIp',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入Ip',
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '最後登入IP',
    dataIndex: 'lastLoginIp',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入Ip',
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '身份證號',
    dataIndex: 'idCard',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入身份證號',
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: 'Line',
    dataIndex: 'line',
    width: 100,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: 'Line 1', value: 'line1' },
          { label: 'Line 2', value: 'line2' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '註冊時間',
    dataIndex: 'registerTime',
    width: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        placeholder: ['開始時間', '結束時間'],
        showTime: false,
      },
      colProps: { span: 12 },
    },
    hideInTable: true,
  },
  {
    title: '最後登入時間',
    dataIndex: 'lastLoginTime',
    width: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        placeholder: ['開始時間', '結束時間'],
        showTime: false,
      },
      colProps: { span: 12 },
    },
    hideInTable: true,
  },
  {
    title: '駐冊來源',
    dataIndex: 'registerSource',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: 'PC', value: 'pc' },
          { label: 'H5', value: 'h5' },
          { label: 'APP', value: 'app' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '終身存款次數',
    dataIndex: 'depositCount',
    width: 180,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '>=',
        options: [
          { label: '>=', value: '>=' },
          { label: '<=', value: '<=' },
          { label: '=', value: '=' },
        ],
      },
      colProps: { span: 6 },
    },
    hideInTable: true,
  },
  {
    title: '返水等級',
    dataIndex: 'returnWaterLevel',
    width: 120,
    hideInSearch: true,
  },
  {
    title: '會員等級',
    dataIndex: 'vipLevel',
    width: 120,
    hideInSearch: true,
    customRender: ({ record }) => {
      // 根據等級顯示不同圖標
      const isVip = record.vipLevel.includes('VIP');
      return (
        <div class="flex items-center gap-1">
          {isVip ? (
            <span class="text-yellow-500">👑</span>
          ) : (
            <span class="text-red-500">🔴</span>
          )}
          <span>{record.vipLevel}</span>
        </div>
      );
    },
  },
  {
    title: '推廣代碼',
    dataIndex: 'promotionCode',
    width: 180,
    hideInSearch: true,
  },
  {
    title: '創建時間',
    dataIndex: 'createdAt',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => formatToDateTime(record.createdAt),
  },
];
