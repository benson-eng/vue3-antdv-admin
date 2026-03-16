<script setup lang="tsx">
import type { Rule } from 'ant-design-vue/es/form';
import type { Dayjs } from 'dayjs';
import type { TableColumnItem } from './columns';
import type { RoomInfo, RoomRelationship, TextHistoryMessage } from '@/api/backend/adminSystem/gameChatroomSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { computed, h, inject, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import {
  broadcast,
  muteUser,
  queryRoomHistoryMessages,
  queryRoomRelationships,
  queryRooms,
  roomBroadcast,
  RoomType,
  temporaryMuteUser,
  unmuteUser,
  updateRoom,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import { treasureItemList } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { formatToDateTime } from '@/utils/dateUtil';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';
import { getBaseColumns } from './columns';
import { useTableConfig } from './useTableConfig';

defineOptions({
  name: 'ChatroomRooms',
});

const { t } = useI18n('page.chatroom');
const userStore = useUserStore();

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

enum Dialog3Type {
  masterAgent = 'masterAgent',
  room = 'room',
}

enum DurationSecType {
  day = 'day',
  hour = 'hour',
  minute = 'minute',
  second = 'second',
}

// ============ 狀態管理 ============
const isTableLoading = ref(false);
const dataList = ref<RoomInfo[]>([]);
const treasureItemListData = ref<any[]>([]);
const nowRoomID = ref('');

// dialog1 編輯
const isDialogForm = ref(false);
const mode = ref<'add' | 'edit' | 'view'>('add');
const dataForm = reactive({
  roomID: '',
  name: '',
  announcement: '',
});
const dialogTitle = ref('');
const dataFormRef = ref();

// dialog2 歷史訊息
const isDialogForm2 = ref(false);
const dialogTitle2 = ref('');
const dataForm2 = reactive({
  startTime: dayjs() as Dayjs,
});
const messageData = ref<TextHistoryMessage[]>([]);
const memberList = ref<Record<string, string>>({});
const lastPostData = ref<any>({});
const dataForm2Ref = ref();
const isMessageLoading = ref(false);

// dialog3 廣播
const isDialogForm3 = ref(false);
const dialogTitle3 = ref('');
const dialog3Type = ref<Dialog3Type>(Dialog3Type.masterAgent);
const dataForm3 = reactive({
  roomID: '',
  message: '',
});
const dataForm3Ref = ref();

// dialog4 禁言
const isTable4Loading = ref(false);
const isDialogForm4 = ref(false);
const dialogTitle4 = ref('');
const relationshipsList = ref<RoomRelationship[]>([]);
const relationshipsListObj = ref<Record<string, string>>({});

// dialog5 短暫禁言確認
const dataForm5 = reactive({
  memberID: '',
  durationSecType: DurationSecType.day,
  durationSec: 0 as number,
});
const isDialogForm5 = ref(false);
const durationSecTypeList = Object.keys(DurationSecType);
const dataForm5Ref = ref();

const getAuthLevel = computed(() => Number(userStore.level ?? -1));

// ============ Breadcrumb Context 整合 ============
// 從 Layout Breadcrumb 取得站長選單狀態
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值（來自 Breadcrumb）
const selectedMasterAgent = computed(() => masterAgentCtx?.selectedMasterAgent.value || '');
// 使用 computed 取得 contextVersion（用於監聽站長切換）
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

/**
 * ============ 工具函數 ============
 */
const getI18nText = (path: string) => {
  return t(path) || path;
};

const findTeamName = (data: string) => {
  if (!data) {
    return '';
  }
  const oneData = treasureItemListData.value.find(e => e.treasureItemID === data);
  return oneData ? oneData.itemName : '';
};

const checkStrlength = (value: string, limit: number) => {
  const Vietnam = Array.from(
    'ÁáÀàĂăẮắẰằẴẵẲẳÂâẤấẦầẪẫẨẩǍǎÅåǺǻÄäǞǟÃãȦȧǠǡĄąĀāẢảȀȁȂȃẠạẶặẬậḀḁȺⱥᶏḂḃḄḅḆḇɃƀᵬᶀƁɓƂƃĆćĈĉČčĊċÇçḈḉȻȼƇƈɕĎďḊḋḐḑḌḍḒḓḎḏĐđ[2]ᵭᶁƉɖ[2]ƊɗᶑƋƌȡÉéÈèĔĕÊêẾếỀềỄễỂểĚěËëẼẽĖėȨȩḜḝĘęĒēḖḗḔḕẺẻȄȅȆȇẸẹỆệḘḙḚḛɆɇᶒḞḟᵮᶂƑƒǴǵĞğĜĝǦǧĠġĢģḠḡǤǥᶃƓɠĤĥȞȟḦḧḢḣḨḩḤḥḪḫH̱ẖĦħⱧⱨÍíÌìĬĭÎîǏǐÏïḮḯĨĩİiĮįĪīỈỉȈȉȊȋỊịḬḭIıƗɨᵻᶖĴĵǰȷɈɉʝɟʄḰḱǨǩĶķḲḳḴḵᶄƘƙⱩⱪĹĺĽľĻļḶḷḸḹḼḽḺḻŁłĿŀȽƚⱠⱡⱢɫɬᶅɭȴḾḿṀṁṂṃᵯᶆɱM̄m̄ŃńǸǹŇňÑñṄṅŅņṆṇṊṋṈṉᵰƝɲȠƞᶇɳȵN̈n̈ÓóÒòŎŏÔôỐốỒồỖỗỔổǑǒÖöȪȫŐőÕõṌṍṎṏȬȭȮȯȰȱØøǾǿǪǫǬǭŌōṒṓṐṑỎỏòȌȍȎȏƠơỚớỜờỠỡỞởỢợỌọỘộƟɵṔṕṖṗⱣᵽᵱᶈƤƥP̃p̃ʠɊɋŔŕŘřṘṙŖŗȐȑȒȓṚṛṜṝṞṟɌɍᵲᶉɼⱤɽɾᵳŚśṤṥŜŝŠšṦṧṠṡẛŞşṢṣṨṩȘșᵴᶊʂȿS̩s̩ŤťT̈ẗṪṫŢţṬṭȚțṰṱṮṯŦŧȾⱦᵵƫƬƭƮʈȶÚúÙùŬŭÛûǓǔŮůÜüǗǘǛǜǙǚǕǖŰűŨũṸṹŲųŪūṺṻỦủȔȕȖȗƯưỨứỪừỮữỬửỰựỤụṲṳṶṷṴṵɄʉᵾᶙṼṽṾṿᶌƲʋⱴẂẃẀẁŴŵW̊ẘẄẅẆẇẈẉẌẍẊẋᶍÝýỲỳŶŷY̊ẙŸÿỸỹẎẏȲȳỶỷỴỵʏɎɏƳƴŹźẐẑŽžŻżẒẓẔẕƵƶᵶᶎȤȥʐʑɀⱫⱬ',
  );
  let checkLength = 0;
  if (value.length > limit * 2) {
    return false;
  }
  else {
    Array.from(value).forEach((oneStr) => {
      // eslint-disable-next-line no-control-regex
      if ((/[^\x00-\xFF]/g).test(oneStr) === true) {
        if (Vietnam.includes(oneStr) === true) {
          checkLength += 1;
        }
        else {
          checkLength += 2;
        }
      }
      else {
        checkLength += 1;
      }
    });
    return checkLength <= limit;
  }
};

const checkMuteUser = (memberID: string) => {
  return relationshipsListObj.value[memberID] === 'ismute';
};

/**
 * 提前聲明函數，供 extraDataInit 使用
 */
const openDialogForm = (modeValue: 'add' | 'edit' | 'view', data?: RoomInfo) => {
  mode.value = modeValue;
  dialogTitle.value = getI18nText('roomEdit');
  isDialogForm.value = true;
  dataForm.roomID = '';
  dataForm.name = '';
  dataForm.announcement = '';
  nextTick(() => {
    dataFormRef.value?.clearValidate();
    if (modeValue === 'edit' && data) {
      const nData = JSON.parse(JSON.stringify(data));
      dataForm.roomID = String(nData.roomID);
      dataForm.name = nData.name || '';
      dataForm.announcement = nData.announcement || '';
    }
  });
};

const onUpdateBtnClick = (row: RoomInfo) => {
  openDialogForm('edit', row);
};

const openDialogForm2 = (data: RoomInfo) => {
  dataForm2.startTime = dayjs(new Date());
  messageData.value = [];
  isMessageLoading.value = false;
  dialogTitle2.value
    = `${getI18nText('messageSearch')
    } ${
      data.type === RoomType.LOBBY
        ? `${getI18nText(`RoomType.${data.type}`)} ${data.name}`
        : findTeamName(data.teamID || '')}`;
  nowRoomID.value = String(data.roomID);
  isDialogForm2.value = true;
  nextTick(() => {
    dataForm2Ref.value?.clearValidate();
  });
};

const openDialogForm3 = (type: Dialog3Type, obj?: RoomInfo) => {
  dataForm3.roomID = '';
  dataForm3.message = '';
  dialog3Type.value = type;
  isDialogForm3.value = true;
  nextTick(() => {
    dataForm3Ref.value?.clearValidate();
    dataForm3Ref.value?.resetFields();
  });
  let teamName = '';
  if (obj) {
    dataForm3.roomID = String(obj.roomID);
    teamName = findTeamName(obj.teamID || '');
    if (teamName === '') {
      teamName = getI18nText(`RoomType.${obj.type}`);
    }
  }
  dialogTitle3.value
    = `${type === Dialog3Type.masterAgent ? selectedMasterAgent.value : teamName
    } ${
      getI18nText('broadcast')}`;
};

const setMessageData = async (postData: any) => {
  isMessageLoading.value = true;
  try {
    const res = await queryRoomHistoryMessages(postData);
    const memberIDs: string[] = [];
    if (res && res.data) {
      res.data.forEach((item: TextHistoryMessage) => {
        if (item.memberID !== 'admin') {
          const memberID = item.memberID.split('@')[0];
          if (!memberIDs.includes(memberID)) {
            memberIDs.push(memberID);
          }
        }
        let mD: any = '';
        try {
          mD = JSON.parse(item.message);
          if (typeof mD === 'object' && mD !== null) {
            item.type = mD.type;
            item.messageStr = mD.data;
          }
          else {
            item.type = 1;
            item.messageStr = item.message;
            const cdnBaseUrl = (import.meta as any)?.env?.VITE_APP_CDN_BASE_URL || '';
            if (!item.message.includes(cdnBaseUrl)) {
              item.type = 2;
            }
          }
        }
        catch (error) {
          item.messageStr = item.message;
          item.type = 1;
          const cdnBaseUrl = (import.meta as any)?.env?.VITE_APP_CDN_BASE_URL || '';
          if (!item.message.includes(cdnBaseUrl)) {
            item.type = 2;
          }
        }
      });
    }
    if (memberIDs.length > 0) {
      const res2 = await queryAccountBaseInfo({
        masterAgent: selectedMasterAgent.value,
        accounts: memberIDs,
      });
      if (res2 && res2.data) {
        res2.data.forEach((item: any) => {
          if (item) {
            memberList.value[item.account] = `${item.id} - ${item.nickName}`;
          }
        });
      }
    }
    if (res && res.data) {
      messageData.value = res.data;
    }
  }
  catch (error) {
    console.error('Failed to set message data:', error);
  }
  finally {
    isMessageLoading.value = false;
  }
};

const extraData4 = ref<any[]>([]);

const clickUnMuteUser = async (memberID: string) => {
  const postData = {
    memberID,
    roomID: nowRoomID.value,
  };
  try {
    await unmuteUser(postData);
    // eslint-disable-next-line ts/no-use-before-define
    await fetchRoomRelationships();
    if (isDialogForm5.value) {
      await setMessageData(lastPostData.value);
    }
  }
  catch (error) {
    console.error('Failed to unmute user:', error);
  }
};

const extraDataInit4 = () => {
  const control: any[] = [];
  relationshipsList.value.forEach(() => {
    const actions: any[] = [
      {
        label: getI18nText('unmute'),
        onClick: (record: RoomRelationship) => clickUnMuteUser(record.memberID),
      },
    ];
    control.push(actions);
  });
  extraData4.value = control;
};

const fetchRoomRelationships = async () => {
  relationshipsList.value = [];
  relationshipsListObj.value = {};
  try {
    const res = await queryRoomRelationships({
      masterAgent: selectedMasterAgent.value,
      roomID: nowRoomID.value,
    });
    const memberIDs: string[] = [];
    if (res && res.data && res.data.relationships) {
      res.data.relationships.forEach((item: RoomRelationship) => {
        item.recordID = item.id;
        item.memberID2 = item.memberID.split('@')[0];
        relationshipsList.value.push(item);
        relationshipsListObj.value[item.memberID] = 'ismute';
        if (item.memberID2) {
          memberIDs.push(item.memberID2);
        }
      });
    }
    if (memberIDs.length > 0) {
      const res2 = await queryAccountBaseInfo({
        masterAgent: selectedMasterAgent.value,
        accounts: memberIDs,
      });
      if (res2 && res2.data) {
        relationshipsList.value = relationshipsList.value.map((item: RoomRelationship) => {
          const item2 = res2.data.find((item2: any) => item2.account === item.memberID2);
          return { ...item, ...item2 };
        });
      }
    }
    extraDataInit4();
  }
  catch (error) {
    console.error('Failed to query room relationships:', error);
  }
};

const openDialogForm4 = async (type: Dialog3Type, obj?: RoomInfo) => {
  isDialogForm4.value = true;
  if (obj) {
    nowRoomID.value = String(obj.roomID);
  }
  await fetchRoomRelationships();
  let teamName = '';
  if (obj) {
    teamName = findTeamName(obj.teamID || '');
    if (teamName === '') {
      teamName = getI18nText(`RoomType.${obj.type}`);
    }
  }
  dialogTitle4.value
    = `${type === Dialog3Type.masterAgent ? selectedMasterAgent.value : teamName
    } ${
      getI18nText('btnMute')}`;
};

// 已移除 extraData 和 extraDataInit
// 操作欄現在直接在 columns computed 中定義（參照 privateRooms 頁面）

/**
 * ============ API 調用 ============
 */
const getRooms = async () => {
  // 使用 Breadcrumb Context 的站長值
  const masterAgentValue = selectedMasterAgent.value;
  if (!masterAgentValue) {
    return;
  }
  dataList.value = [];
  isTableLoading.value = true;
  try {
    const res = await queryRooms({ masterAgent: masterAgentValue });
    console.log('queryRooms response:', res);
    if (res) {
      // 處理不同的返回格式：可能是 { data: [...] } 或直接是 [...]
      if (Array.isArray(res)) {
        dataList.value = res;
      }
      else if (res.data && Array.isArray(res.data)) {
        dataList.value = res.data;
      }
      else {
        dataList.value = [];
      }
      console.log('dataList.value after assignment:', dataList.value);
      // 已移除 extraDataInit()，操作欄現在直接在 columns computed 中定義
    }
  }
  catch (error) {
    console.error('Failed to get rooms:', error);
  }
  finally {
    isTableLoading.value = false;
  }
};

const getTreasureItemList = async (masterAgentValue: string) => {
  try {
    const res = await treasureItemList({ masterAgent: masterAgentValue });
    if (res && res.data && res.data.rows) {
      treasureItemListData.value = res.data.rows.reduce((acc: any[], r) => {
        if (r.type === 'teamBadge') {
          const inItem: any[] = [];
          r.items.forEach((item: any) => {
            if (item.enabled === 1) {
              inItem.push(item);
            }
          });
          return [...acc, ...inItem];
        }
        else {
          return acc;
        }
      }, []);
    }
  }
  catch (error) {
    console.error('Failed to get treasure item list:', error);
  }
};

/**
 * 監聽 Breadcrumb Context 的站長切換
 * 當 Context 的 masterAgent 變更時，自動重新載入資料
 * 參照 privateRooms 頁面：站長切換時自動載入資料（因為此頁面沒有搜尋按鈕）
 */
watch(
  () => contextVersion.value,
  () => {
    // 當站長切換時，重新載入資料
    if (selectedMasterAgent.value) {
      isTableLoading.value = true;
      getTreasureItemList(selectedMasterAgent.value)
        .then(() => getRooms())
        .finally(() => {
          isTableLoading.value = false;
        });
    }
    else {
      // 如果站長被清空，清空資料列表
      dataList.value = [];
    }
  },
);

// ============ SearchMode 狀態顯示 ============
/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * - BACKEND：資料從後端 API 取得，過濾邏輯在 API 層面完成
 */
const searchMode = computed<SearchMode>(() => {
  return 'BACKEND';
});

// SearchMode 顯示文字和顏色
const searchModeConfig = computed(() => {
  const mode = searchMode.value;
  const configs = {
    FRONTEND: { text: '前端過濾', color: 'orange' },
    HYBRID: { text: '混合模式', color: 'blue' },
    BACKEND: { text: '後端查詢', color: 'green' },
  };
  return configs[mode];
});

// ============ 表格配置 ============
const baseColumns = computed<TableColumnItem[]>(() => {
  return getBaseColumns({
    getI18nText,
    findTeamName,
  });
});

// 使用表格配置 Hook（與 agent 頁對齊）
const tableConfig = useTableConfig(baseColumns);

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 參照 privateRooms 頁面：將操作欄直接添加到 columns 中，並為所有欄位添加不換行設定
const columns = computed<TableColumnItem[]>(() => {
  const processedCols = baseColumns.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';
    const isVisible = tableConfig.visibleColumnKeys.value.includes(key);

    // 為所有欄位添加不換行設定
    const colWithNoWrap = {
      ...col,
      hideInTable: !isVisible,
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap', // 禁止換行
          },
        };
      },
    };

    return colWithNoWrap;
  });

  // 獲取操作按鈕列表（根據權限等級）
  // 參照 privateRooms 頁面：actions 函數接收 { record } 參數
  const authLevel = getAuthLevel.value;

  return [
    ...processedCols,
    {
      title: getI18nText('control'),
      dataIndex: 'ACTION',
      width: 300,
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap', // 禁止換行
          },
        };
      },
      actions: ({ record }) => {
        const actions: any[] = [
          {
            label: getI18nText('btnHistoryMessage'),
            type: 'link',
            onClick: () => openDialogForm2(record),
          },
          {
            label: getI18nText('edit'),
            type: 'link',
            onClick: () => onUpdateBtnClick(record),
          },
          {
            label: getI18nText('btnMute'),
            type: 'link',
            onClick: () => openDialogForm4(Dialog3Type.room, record),
          },
        ];

        // 如果等級 <= 1，添加廣播按鈕
        if (authLevel <= 1) {
          actions.unshift({
            label: getI18nText('btnBroadcast'),
            type: 'link',
            onClick: () => openDialogForm3(Dialog3Type.room, record),
          });
        }

        return actions;
      },
    },
  ];
});

/**
 * ============ Dialog1 編輯 ============
 */

const closeDialogForm = () => {
  mode.value = 'add';
  dataForm.roomID = '';
  dataForm.name = '';
  dataForm.announcement = '';
  nextTick(() => {
    dataFormRef.value?.clearValidate();
    dataFormRef.value?.resetFields();
  });
  isDialogForm.value = false;
};

const getRules = (): Record<string, Rule[]> => {
  return {
    name: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (!value) {
            return Promise.reject(new Error(getI18nText('notify.required')));
          }
          if (!checkStrlength(value, 50)) {
            return Promise.reject(
              new Error(
                t('notify.wordLimit', { limit1: '25', limit2: '50' })
                || '字數限制：25-50 字',
              ),
            );
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    message: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (!value) {
            return Promise.reject(new Error(getI18nText('notify.required')));
          }
          if (!checkStrlength(value, 60)) {
            return Promise.reject(
              new Error(
                t('notify.wordLimit', { limit1: '30', limit2: '60' })
                || '字數限制：30-60 字',
              ),
            );
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    announcement: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (!value) {
            return Promise.reject(new Error(getI18nText('notify.required')));
          }
          if (!checkStrlength(value, 60)) {
            return Promise.reject(
              new Error(
                t('notify.wordLimit', { limit1: '30', limit2: '60' })
                || '字數限制：30-60 字',
              ),
            );
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
    startTime: [
      {
        required: true,
        message: getI18nText('notify.required'),
        trigger: 'change',
      },
    ],
    durationSec: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (!dataForm5.durationSec) {
            return Promise.reject(new Error(getI18nText('notify.required')));
          }
          switch (dataForm5.durationSecType) {
            case DurationSecType.day:
              if (value < 1 || value > 30) {
                return Promise.reject(
                  new Error(getI18nText('notify.durationSecType1')),
                );
              }
              break;
            case DurationSecType.hour:
              if (value < 1 || value > 23) {
                return Promise.reject(
                  new Error(getI18nText('notify.durationSecType2')),
                );
              }
              break;
            case DurationSecType.minute:
            case DurationSecType.second:
              if (value < 1 || value > 59) {
                return Promise.reject(
                  new Error(getI18nText('notify.durationSecType3')),
                );
              }
              break;
          }
          return Promise.resolve();
        },
        trigger: 'change',
      },
    ],
  };
};

const submitForm = async () => {
  try {
    await dataFormRef.value?.validate();
    if (mode.value === 'edit') {
      const postData = {
        masterAgent: selectedMasterAgent.value,
        roomID: dataForm.roomID,
        name: '',
        announcement: dataForm.announcement || '',
      };
      await updateRoom(postData);
      closeDialogForm();
      isTableLoading.value = true;
      await getTreasureItemList(selectedMasterAgent.value);
      await getRooms();
      isTableLoading.value = false;
    }
  }
  catch (error) {
    // 驗證失敗或 API 錯誤
    if (error && typeof error === 'object' && 'errorFields' in error) {
      // 表單驗證失敗，不處理
      return;
    }
    console.error('Failed to update room:', error);
  }
};

/**
 * ============ Dialog2 歷史訊息 ============
 */

const closeDialogForm2 = () => {
  lastPostData.value = {};
  isMessageLoading.value = false;
  nextTick(() => {
    dataForm2Ref.value?.clearValidate();
    dataForm2Ref.value?.resetFields();
  });
  isDialogForm2.value = false;
};

const searchMessage = async () => {
  try {
    await dataForm2Ref.value?.validate();
    const postData = {
      masterAgent: selectedMasterAgent.value,
      roomID: nowRoomID.value,
      startTime: dataForm2.startTime.toDate(),
    };
    await fetchRoomRelationships();
    memberList.value = {};
    lastPostData.value = postData;
    await setMessageData(postData);
  }
  catch (error) {
    // 驗證失敗，不處理
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to search message:', error);
  }
};

const _onDateChanged = (data: [Dayjs, Dayjs]) => {
  if (data && data.length > 0) {
    dataForm2.startTime = data[0];
  }
};

/**
 * ============ Dialog3 廣播 ============
 */

const closeDialogForm3 = () => {
  isDialogForm3.value = false;
};

const submitForm3 = async () => {
  try {
    await dataForm3Ref.value?.validate();
    closeDialogForm3();
    let res: any = {};
    switch (dialog3Type.value) {
      case Dialog3Type.masterAgent:
        res = await broadcast({
          masterAgent: selectedMasterAgent.value,
          message: dataForm3.message,
        });
        break;
      case Dialog3Type.room:
        res = await roomBroadcast({
          masterAgent: selectedMasterAgent.value,
          roomID: dataForm3.roomID,
          message: dataForm3.message,
        });
        break;
    }
    if (!res.data?.error) {
      message.success(t('submit') + t('success'));
    }
    else {
      message.error(t('submit') + t('fail'));
    }
  }
  catch (error) {
    // 驗證失敗，不處理
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form3:', error);
    message.error(t('submit') + t('fail'));
  }
};

/**
 * ============ Dialog4 禁言 ============
 */

const closeDialogForm4 = () => {
  isDialogForm4.value = false;
};

const columns4 = ref<TableColumn<RoomRelationship>[]>([
  {
    title: getI18nText('memberID'),
    dataIndex: 'nickName',
    width: 200,
    customRender: ({ record }) => {
      if (record.id && record.nickName) {
        return `${record.id} - ${record.nickName}`;
      }
      return '';
    },
  },
]);

/**
 * ============ Dialog5 短暫禁言確認 ============
 */
const _openDialogForm5 = (memberID: string) => {
  isDialogForm5.value = true;
  dataForm5.memberID = memberID;
  dataForm5.durationSecType = DurationSecType.day;
  dataForm5.durationSec = 0;
};

const closeDialogForm5 = () => {
  isDialogForm5.value = false;
};

const submitForm5 = async () => {
  try {
    await dataForm5Ref.value?.validate();
    const form5 = dataForm5;
    closeDialogForm5();
    let durationSec = Number(form5.durationSec);
    switch (form5.durationSecType) {
      case DurationSecType.day:
        durationSec = durationSec * 60 * 60 * 24;
        break;
      case DurationSecType.hour:
        durationSec = durationSec * 60 * 60;
        break;
      case DurationSecType.minute:
        durationSec = durationSec * 60;
        break;
    }
    const postData = {
      memberID: form5.memberID,
      roomID: nowRoomID.value,
      durationSec,
    };
    await temporaryMuteUser(postData);
  }
  catch (error) {
    // 驗證失敗，不處理
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form5:', error);
  }
};

const clickMuteUser = async (memberID: string) => {
  const postData = {
    memberID,
    roomID: nowRoomID.value,
  };
  try {
    await muteUser(postData);
    await fetchRoomRelationships();
    await setMessageData(lastPostData.value);
  }
  catch (error) {
    console.error('Failed to mute user:', error);
  }
};

// ============ 表格 ============
// 參照 privateRooms 頁面：不使用 actionColumn，操作欄已在 columns 中定義
const [DynamicTable] = useTable({
  search: false,
});

/**
 * 處理重新整理事件
 */
const handleReload = async () => {
  if (selectedMasterAgent.value) {
    isTableLoading.value = true;
    try {
      await getTreasureItemList(selectedMasterAgent.value);
      await getRooms();
    }
    finally {
      isTableLoading.value = false;
    }
  }
};

// ============ 初始化 ============
// 注意：站長選擇器已遷移至 Breadcrumb，本頁僅作為 Consumer
// 參照 privateRooms 頁面：初始化時只載入寶物清單，不自動載入資料表
// 資料表將在站長切換時（watch contextVersion）自動載入
onMounted(async () => {
  // 初始化時載入寶物清單（如果 Context 有值）
  if (selectedMasterAgent.value) {
    await getTreasureItemList(selectedMasterAgent.value);
    // 自動載入資料表（因為此頁面沒有搜尋按鈕，需要自動載入）
    // 與 privateRooms 不同：privateRooms 有搜尋按鈕，此頁面沒有，所以需要自動載入
    isTableLoading.value = true;
    await getRooms();
    isTableLoading.value = false;
  }
});
</script>

<template>
  <div class="app-container chatroom-rooms">
    <DynamicTable
      :loading="isTableLoading"
      :columns="columns"
      :data-source="dataList"
      :scroll="{ x: '100%' }"
      @reload="handleReload"
    >
      <template #headerTitle>
        <div style="display: flex; align-items: center; gap: 8px">
          <span>{{ getI18nText('rooms2') || '公頻管理' }}</span>
          <Tag :color="searchModeConfig.color" style="margin: 0">
            SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
          </Tag>
        </div>
      </template>
      <template #toolbar>
        <a-button
          type="primary"
          @click="openDialogForm3(Dialog3Type.masterAgent)"
        >
          {{ getI18nText('broadcast') }}
        </a-button>
      </template>
    </DynamicTable>

    <!-- Dialog1 編輯 -->
    <a-modal
      v-model:open="isDialogForm"
      :title="dialogTitle"
      :width="550"
      :mask-closable="false"
      @cancel="closeDialogForm"
    >
      <a-form
        ref="dataFormRef"
        :model="dataForm"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        :rules="getRules()"
      >
        <a-form-item
          :label="getI18nText('roomID')"
          name="roomID"
        >
          <a-input
            v-model:value="dataForm.roomID"
            disabled
          />
        </a-form-item>

        <a-form-item
          :label="getI18nText('announcement')"
          name="announcement"
        >
          <a-textarea
            v-model:value="dataForm.announcement"
            :rows="3"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeDialogForm">
          {{ t('cancel') }}
        </a-button>
        <a-button
          type="primary"
          @click="submitForm"
        >
          {{ t('update') }}
        </a-button>
      </template>
    </a-modal>

    <!-- Dialog2 歷史訊息 -->
    <a-modal
      v-model:open="isDialogForm2"
      :title="dialogTitle2"
      :width="1200"
      :mask-closable="false"
      @cancel="closeDialogForm2"
    >
      <a-form
        ref="dataForm2Ref"
        :model="dataForm2"
        :rules="getRules()"
      >
        <a-form-item name="startTime">
          <div class="wrap">
            <div class="input_group">
              <span>{{ getI18nText('startTime') }}</span>
            </div>
            <div class="input_group">
              <a-date-picker
                v-model:value="dataForm2.startTime"
                show-time
                format="YYYY-MM-DD HH:mm:ss"
              />
              <a-button
                style="margin-left: 10px"
                :loading="isMessageLoading"
                @click="searchMessage"
              >
                {{ t('search') }}
              </a-button>
            </div>
            <div class="input_group">
              <span>{{ getI18nText('messageAlert') }}</span>
            </div>
          </div>
        </a-form-item>
      </a-form>
      <a-table
        :loading="isMessageLoading"
        :data-source="messageData"
        :columns="[
          {
            title: getI18nText('memberID'),
            dataIndex: 'memberID',
            width: 200,
            customRender: ({ record }) => {
              if (record.memberID === 'admin') {
                return record.memberID;
              }
              const memberID = record.memberID.split('@')[0];
              return memberList[memberID] || 'unknown';
            },
          },
          {
            title: getI18nText('message'),
            dataIndex: 'messageStr',
            customRender: ({ record }) => {
              if (record.type === 0 || record.type === 2) {
                return record.messageStr;
              }
              if (record.type === 1) {
                return h('img', {
                  src: record.messageStr,
                  style: { width: '100px', height: '100px' },
                });
              }
              return '';
            },
          },
          {
            title: getI18nText('sendTime'),
            dataIndex: 'sendTime',
            width: 150,
            customRender: ({ record }) => formatToDateTime(record.sendTime),
          },
          {
            title: getI18nText('control'),
            width: 200,
            customRender: ({ record }) => {
              const memberID = record.memberID.split('@')[0];
              const isMuted = checkMuteUser(record.memberID);
              const hasMember = memberList[memberID];
              return h('div', [
                record.memberID !== 'admin' && hasMember
                  ? h('a-button', {
                    type: 'danger',
                    disabled: isMuted,
                    style: { marginRight: '10px' },
                    onClick: () => clickMuteUser(record.memberID),
                  }, () => getI18nText('mute'))
                  : null,
                record.memberID !== 'admin' && hasMember
                  ? h('a-button', {
                    type: 'primary',
                    onClick: () => clickUnMuteUser(record.memberID),
                  }, () => getI18nText('unmute'))
                  : null,
              ]);
            },
          },
        ]"
        :scroll="{ y: 400 }"
      />
      <template #footer>
        <a-button @click="closeDialogForm2">
          {{ t('close') }}
        </a-button>
      </template>
    </a-modal>

    <!-- Dialog3 廣播 -->
    <a-modal
      v-model:open="isDialogForm3"
      :title="dialogTitle3"
      :width="550"
      :mask-closable="false"
      @cancel="closeDialogForm3"
    >
      <a-form
        ref="dataForm3Ref"
        :model="dataForm3"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        :rules="getRules()"
      >
        <a-form-item
          :label="getI18nText('message')"
          name="message"
        >
          <a-input
            v-model:value="dataForm3.message"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeDialogForm3">
          {{ t('cancel') }}
        </a-button>
        <a-button
          type="primary"
          @click="submitForm3"
        >
          {{ t('submit') }}
        </a-button>
      </template>
    </a-modal>

    <!-- Dialog4 禁言 -->
    <a-modal
      v-model:open="isDialogForm4"
      :title="dialogTitle4"
      :width="800"
      :mask-closable="false"
      @cancel="closeDialogForm4"
    >
      <a-table
        :loading="isTable4Loading"
        :data-source="relationshipsList"
        :columns="columns4"
        :scroll="{ y: 400 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'control'">
            <a-button
              type="primary"
              @click="clickUnMuteUser(record.memberID)"
            >
              {{ getI18nText('unmute') }}
            </a-button>
          </template>
        </template>
      </a-table>
      <template #footer>
        <a-button @click="closeDialogForm4">
          {{ t('close') }}
        </a-button>
      </template>
    </a-modal>

    <!-- Dialog5 短暫禁言確認 -->
    <a-modal
      v-model:open="isDialogForm5"
      :title="getI18nText('temporaryMuteConfirm')"
      :width="550"
      :mask-closable="false"
      @cancel="closeDialogForm5"
    >
      <a-form
        ref="dataForm5Ref"
        :model="dataForm5"
        :label-col="{ span: 8 }"
        :wrapper-col="{ span: 16 }"
        :rules="getRules()"
      >
        <a-form-item
          :label="getI18nText('durationSecType')"
        >
          <a-radio-group v-model:value="dataForm5.durationSecType">
            <a-radio-button
              v-for="item in durationSecTypeList"
              :key="item"
              :value="item"
            >
              {{ getI18nText(`durationSec.${item}`) }}
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          :label="getI18nText('durationSecTime')"
          name="durationSec"
        >
          <a-input-number
            v-model:value="dataForm5.durationSec"
            :min="1"
            :max="999"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="closeDialogForm5">
          {{ t('cancel') }}
        </a-button>
        <a-button
          type="primary"
          @click="submitForm5"
        >
          {{ t('submit') }}
        </a-button>
      </template>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.chatroom-rooms {
  // 確保表格寬度為 100%
  :deep(.ant-table-wrapper) {
    width: 100%;
  }

  .wrap {
    display: flex;
    flex-wrap: wrap;
    .item {
      margin-top: 10px;
    }
    .search_btn {
      margin: 10px 0;
    }
    .sendBtn {
      margin: 15px 0;
    }
    .input_group {
      display: flex;
      padding: 10px;
      align-items: center;
      .txt {
        width: 100px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .my_input {
        width: 200px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    }
  }
}
</style>
