import type { SafetyBoxOrderItem } from '@/api/backend/transactionSystem';
import type { TableColumn } from '@/components/core/dynamic-table';
import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { h } from 'vue';

export interface SafetyBoxRow extends SafetyBoxOrderItem {
  nickName?: string;
}

export function getColumns(
  t: (key: string) => string,
  memberOptions?: () => { label: string; value: string }[],
  memberLoading?: () => boolean,
  onMemberSearch?: (text: string) => void,
  onMemberPopupScroll?: (e: Event) => void,
  onMemberChange?: (value: string) => void,
  currentAgentID?: () => string,
): TableColumn<SafetyBoxRow>[] {
  return [
    // 搜尋欄位：會員
    {
      title: t('labels.member') || '會員',
      dataIndex: '__memberID_search__',
      hideInTable: true,
      searchField: 'memberID',
      formItemProps: {
        label: t('labels.member') || '會員',
        component: 'Select',
        // 使用 rules 定義必填驗證，每個欄位獨立
        rules: [
          {
            required: true,
            message: t('notify.requiredMember') || '請選擇會員',
          },
        ],
        componentProps: () => ({
          options: memberOptions?.() || [],
          loading: memberLoading?.() || false,
          showSearch: true,
          filterOption: false,
          allowClear: true,
          disabled: !currentAgentID?.(),
          placeholder: '00001314 - 王小明',
          onSearch: onMemberSearch,
          onPopupScroll: onMemberPopupScroll,
          onChange: onMemberChange,
        }),
      },
    },
    // 搜尋欄位：查詢時間
    {
      title: t('label.searchTime') || '查詢時間',
      dataIndex: '__searchTime_search__',
      hideInTable: true,
      searchField: 'searchTime',
      formItemProps: {
        label: t('label.searchTime') || '查詢時間',
        component: 'RangePicker',
        // 使用 rules 定義必填驗證，每個欄位獨立
        rules: [
          {
            required: true,
            message: t('notify.requiredSearchTime') || '請選擇查詢時間',
          },
        ],
        // 預設值：當日前一周 ~ 當日 23:59:59
        defaultValue: (() => {
          const today = dayjs();
          const oneWeekAgo = today.subtract(7, 'day');
          return [
            oneWeekAgo.startOf('day'),
            today.endOf('day'),
          ];
        })(),
        componentProps: {
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          placeholder: ['開始時間', '結束時間'],
        },
      } as any,
    },
    // 資料顯示欄位
    {
      title: '#',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
      hideInTable: true, // 不顯示此欄位
    },
    {
      title: t('label.nickName') || '會員',
      dataIndex: 'nickName',
      flexible: true, // 彈性寬度欄位
      minWidth: 160, // flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
      hideInSearch: true,
    },
    {
      title: t('label.currencyType') || '幣別',
      dataIndex: 'currencyType',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('label.remittances') || '提 / 存',
      dataIndex: 'remittances',
      flexible: true, // 彈性寬度欄位
      minWidth: 140, /**
                      * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
                      */
      hideInSearch: true,
      customRender: ({ record }) => {
        const prefix = record.remittances >= 0 ? '存 ' : '提 ';
        return prefix + Math.abs(record.remittances).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      title: t('label.serviceFee') || '手續費',
      dataIndex: 'serviceFee',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }) =>
        Math.abs(record.serviceFee).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    },
    {
      title: t('label.state') || '狀態',
      dataIndex: 'state',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }) =>
        h(
          Tag,
          { color: record.state === 'Success' ? 'success' : 'error' },
          () => (record.state === 'Success' ? t('state.Success') : t('state.Fail')),
        ),
    },
    {
      title: t('label.transferAt') || '時間',
      dataIndex: 'transferAt',
      flexible: true, // 彈性寬度欄位
      minWidth: 180, /**
                      * flexible 欄位必須設定 minWidth，避免初始 render 時被壓縮為 0
                      */
      hideInSearch: true,
      customRender: ({ record }) =>
        record.transferAt
          ? dayjs(record.transferAt).format('YYYY-MM-DD HH:mm:ss')
          : '',
    },
  ];
}
