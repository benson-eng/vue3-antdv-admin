import type { PrivateTeamSearchType } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { FormSchema } from '@/components/core/schema-form';
import { debounce } from 'lodash-es';
import { PrivateTeamSearchType as SearchTypeEnum } from '@/api/backend/adminSystem/gameChatroomSystem';

export interface PrivateRoomsSearchFormValues {
  memberID?: string;
  searchType?: PrivateTeamSearchType;
}

/**
 * 取得搜尋表單的 schemas
 *
 * 【搜尋模式】受控模式（Controlled Mode）
 * - 查詢觸發：點擊搜索按鈕（submitOnReset: false）
 * - 即時查詢：否（immediate: false）
 * - 主控權：DynamicTable 搜尋表單
 *
 * 【搜尋欄位】
 * - memberID：會員ID搜尋（必填欄位）
 *   - 類型：Select（遠端搜索）
 *   - 控制權：DynamicTable 搜尋表單
 *   - 驗證：必填
 *   - 功能：debounce search、popup scroll load more、disabled when masterAgent empty
 *
 * - searchType：搜索類型（必填欄位，不可清除）
 *   - 類型：Select
 *   - 選項：IS_EXIST（存在）、IS_NOT_EXIST（不存在）
 *   - 控制權：DynamicTable 搜尋表單
 *   - 預設值：IS_EXIST
 *   - allowClear: false（不可清除）
 *
 * 【注意】
 * - masterAgent 不在搜尋表單中（使用頁面級別選擇器，Context 外）
 * - memberID 為必填欄位，確保查詢有效性
 */
export const getSearchSchemas = (
  pt: (key: string) => string,
  opts: {
    masterAgent: () => string;
    memberOptions: { value: Array<{ label: string; value: string; raw: any }> };
    memberLoading: { value: boolean };
    onMemberSearch: (text: string) => void;
    onMemberSelectChanged: (value: string | undefined) => void;
    onMemberPopupScroll: (e: Event) => void;
  },
): FormSchema<PrivateRoomsSearchFormValues>[] => {
  const {
    masterAgent,
    memberOptions,
    memberLoading,
    onMemberSearch,
    onMemberSelectChanged,
    onMemberPopupScroll,
  } = opts;

  // 創建 debounced search 函數
  const debouncedSearch = debounce((text: string) => {
    onMemberSearch(text);
  }, 300);

  return [
    {
      field: 'memberID',
      label: pt('memberID'),
      component: 'Select',
      order: 0,
      colProps: { span: 8 },
      rules: [
        {
          required: true,
          message: pt('notify.required') || '此欄位為必填',
        },
      ],
      componentProps: () => ({
        showSearch: true,
        filterOption: false,
        options: memberOptions.value,
        loading: memberLoading.value,
        disabled: !masterAgent(),
        placeholder: '00001314 - 王小明',
        allowClear: true,
        style: { width: '260px' },
        onSearch: debouncedSearch,
        onPopupScroll: (e: Event) => {
          onMemberPopupScroll(e);
        },
        onChange: (value: string | undefined) => {
          onMemberSelectChanged(value);
        },
      }),
    },
    {
      field: 'searchType',
      label: pt('SearchType'),
      component: 'Select',
      order: 1,
      colProps: { span: 8 },
      componentProps: {
        placeholder: '請選擇搜索類型',
        allowClear: false,
        style: { width: '160px' },
        options: [
          { label: pt('PrivateTeamSearchType.1'), value: SearchTypeEnum.IS_EXIST },
          { label: pt('PrivateTeamSearchType.2'), value: SearchTypeEnum.IS_NOT_EXIST },
        ],
      },
      defaultValue: SearchTypeEnum.IS_EXIST,
    },
  ];
};
