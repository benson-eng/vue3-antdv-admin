import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
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
    },
    customRender: ({ record }) => {
      const enable = ~~record.status === 1;
      return <Tag color={enable ? 'success' : 'error'}>{enable ? '啟用中' : '停用'}</Tag>;
    },
  },
  {
    title: '上級代理',
    dataIndex: 'superior',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入上級代理',
      },
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
        placeholder: '請輸入上級會員',
      },
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
    },
  },
  {
    title: '首存首出',
    dataIndex: 'firstDeposit',
    width: 120,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '請選擇',
        options: [
          { label: '無首出', value: 'no_withdraw' },
          { label: '無首存', value: 'no_deposit' },
        ],
      },
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
        placeholder: '請輸入IP',
      },
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
        placeholder: '請輸入IP',
      },
    },
    hideInTable: true,
  },
  {
    title: '會員姓名',
    dataIndex: 'realName',
    width: 100,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入姓名',
      },
    },
    hideInTable: true,
  },
  {
    title: '手機號',
    dataIndex: 'phone',
    width: 120,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入手機號',
      },
    },
    hideInTable: true,
  },
  {
    title: '身份證號',
    dataIndex: 'idCard',
    width: 150,
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '請輸入身份證號',
      },
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
    },
    hideInTable: true,
  },
  {
    title: '駐冊時間',
    dataIndex: 'registerTime',
    width: 180,
    formItemProps: {
      component: 'RangePicker',
      componentProps: {
        placeholder: ['開始時間', '結束時間'],
        showTime: true,
      },
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
        showTime: true,
      },
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
    },
    hideInTable: true,
  },
  {
    title: '終身存款次數',
    dataIndex: 'depositCount',
    width: 180,
    formItemProps: {
      component: 'InputNumber',
      componentProps: {
        placeholder: '請輸入次數',
        min: 0,
      },
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
