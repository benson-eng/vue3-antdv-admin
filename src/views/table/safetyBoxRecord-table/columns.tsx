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
  hasSubmitted?: () => boolean,
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
        // Submit-driven validation：使用自訂 validator 控制驗證時機
        // required: true 在 rules 中用於顯示紅色星號（必填標記）
        rules: [
          {
            required: true,
            // 這個規則不會真正執行驗證，只是用來顯示紅色星號
            /**
             * 實際驗證由下面的 validator 控制
             */
            validator: async (_rule: any, value: any) => {
              // 未按過查詢，不驗證
              if (!hasSubmitted?.()) {
                return Promise.resolve();
              }

              // disabled 時不驗證
              if (!currentAgentID?.()) {
                return Promise.resolve();
              }

              if (!value) {
                return Promise.reject(t('notify.requiredMember') || '請選擇會員');
              }

              return Promise.resolve();
            },
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
        // Submit-driven validation：使用自訂 validator 控制驗證時機
        // required: true 在 rules 中用於顯示紅色星號（必填標記）
        rules: [
          {
            required: true,
            // 這個規則不會真正執行驗證，只是用來顯示紅色星號
            /**
             * 實際驗證由下面的 validator 控制
             */
            validator: async (_rule: any, value: any) => {
              // 未按過查詢，不驗證
              if (!hasSubmitted?.()) {
                return Promise.resolve();
              }

              if (!value || !Array.isArray(value) || !value[0] || !value[1]) {
                return Promise.reject(t('notify.requiredSearchTime') || '請選擇查詢時間');
              }

              return Promise.resolve();
            },
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
