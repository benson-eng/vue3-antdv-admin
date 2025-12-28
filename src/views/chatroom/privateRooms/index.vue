<script setup lang="ts">
import type { Rule } from 'ant-design-vue/es/form';
import type { Dayjs } from 'dayjs';
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type {
  PrivateTeamInfo,
  PrivateTeamSearchType,
  TextHistoryMessage,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import type { TableColumn } from '@/components/core/dynamic-table';

import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';
import { computed, h, nextTick, onMounted, reactive, ref } from 'vue';
import { getMasterAgentAccountList } from '@/api/backend/adminAccount/masterAgent';
import { fuzzyQueryUser, queryAccountBaseInfo } from '@/api/backend/adminSystem/accountSystem';
import {
  broadcast,
  privateTeamDel,
  privateTeamHistoryMessages,
  privateTeamKick,
  privateTeamQuery,
  roomBroadcast,
  PrivateTeamSearchType as SearchTypeEnum,
} from '@/api/backend/adminSystem/gameChatroomSystem';
import { treasureItemList } from '@/api/backend/treasureChestSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { formatToDateTime } from '@/utils/dateUtil';

defineOptions({
  name: 'ChatroomPrivateRooms',
});

const { t } = useI18n('page.chatroom');
const userStore = useUserStore();

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
const masterAgent = ref('');
const masterAgentList = ref<Array<{ account: string }>>([]);
const dataList = ref<PrivateTeamInfo[]>([]);
const treasureItemListData = ref<any[]>([]);
const nowMemberID = ref('');
const nowPrivateTeamID = ref('');
const sMemberID = ref('');
const qMemberID = ref('');
const qNickName = ref('');
const nameList = ref<Record<string, string>>({});
const emptyMessage = ref(false);
const sSearchType = ref<PrivateTeamSearchType>(SearchTypeEnum.IS_EXIST);
const qSearchType = ref<PrivateTeamSearchType>(SearchTypeEnum.IS_EXIST);
const searchTypeList = [
  { name: t('PrivateTeamSearchType.1'), value: SearchTypeEnum.IS_EXIST },
  { name: t('PrivateTeamSearchType.2'), value: SearchTypeEnum.IS_NOT_EXIST },
];

// ============ 會員搜索 ============
const memberLoading = ref(false);
const memberOptions = ref<{ label: string; value: string; raw: FuzzyQueryUserItem }[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 10;
const selectedMemberID = ref<string | undefined>(undefined);

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
  startTime: [dayjs().startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs],
});
const messageData = ref<TextHistoryMessage[]>([]);
const memberList = ref<Record<string, string>>({});
const lastPostData = ref<any>({});
const dataForm2Ref = ref();

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
const _isTable4Loading = ref(false);
const _isDialogForm4 = ref(false);
const _dialogTitle4 = ref('');
const _relationshipsList = ref<any[]>([]);
const _relationshipsListObj = ref<Record<string, string>>({});

// dialog5 短暫禁言確認
const dataForm5 = reactive({
  memberID: '',
  durationSecType: DurationSecType.day,
  durationSec: 0 as number,
});
const isDialogForm5 = ref(false);
const dataForm5Ref = ref();
const _durationSecTypeList = Object.keys(DurationSecType) as Array<keyof typeof DurationSecType>;

const getAuthLevel = computed(() => userStore.level);
const getAuthAccount = computed(() => userStore.account);

const getI18nText = (path: string) => {
  return t(path);
};

/**
 * ============ 工具函數 ============
 */
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
};

/**
 * ============ API 調用 ============
 */
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

const getList = async () => {
  dataList.value = [];
  emptyMessage.value = true;
  isTableLoading.value = true;
  qSearchType.value = sSearchType.value;
  nameList.value = {};
  if (qMemberID.value) {
    try {
      const postData = {
        memberID: qMemberID.value,
        searchType: sSearchType.value,
      };
      const res = await privateTeamQuery(postData);
      /**
       * 處理不同的回應格式：可能是 { data: { privateTeam: [...] } } 或直接是 { privateTeam: [...] }
       */
      let privateTeamData: any[] = [];
      if (res) {
        if (res.data && res.data.privateTeam && Array.isArray(res.data.privateTeam)) {
          privateTeamData = res.data.privateTeam;
        }
        else if ((res as any).privateTeam && Array.isArray((res as any).privateTeam)) {
          privateTeamData = (res as any).privateTeam;
        }
      }

      if (privateTeamData.length > 0) {
        /**
         * 先提取所有 owner 的 account（從 owner 欄位中提取，格式：account@agentID）
         */
        const idArray: string[] = privateTeamData
          .map((item: any) => {
            return item.owner ? item.owner.split('@')[0] : '';
          })
          .filter((value: any, index: any, array: any) => {
            return value && array.indexOf(value) === index;
          });

        /**
         * 如果有 owner，先查詢 owner 的帳號資訊
         */
        if (idArray.length > 0) {
          try {
            const resAccount = await queryAccountBaseInfo({
              masterAgent: masterAgent.value,
              accounts: idArray,
            });
            if (resAccount && resAccount.data) {
              resAccount.data.forEach((item: any) => {
                if (nameList.value[item.account] === undefined) {
                  nameList.value[item.account] = `${item.id} - ${item.nickName}`;
                }
              });
            }
          }
          catch (error) {
            console.error('Failed to query account base info:', error);
          }
        }

        /**
         * 映射資料並設定 ownerName
         */
        const dataListTemp = privateTeamData.map((item: any) => {
          const ownerID = item.owner ? item.owner.split('@')[0] : '';
          return {
            ...item,
            memberID: sMemberID.value,
            nickName: qNickName.value,
            ownerID,
            ownerName: nameList.value[ownerID] || '',
            searchType: sSearchType.value,
          };
        });

        dataList.value = dataListTemp;
        // eslint-disable-next-line ts/no-use-before-define
        extraDataInit();
        emptyMessage.value = false;
      }
      else {
        dataList.value = [];
        emptyMessage.value = true;
      }
    }
    catch (error) {
      console.error('Failed to get list:', error);
      dataList.value = [];
      emptyMessage.value = true;
      message.error('查詢失敗，請稍後再試');
    }
    finally {
      isTableLoading.value = false;
    }
  }
  else {
    isTableLoading.value = false;
  }
};

const onMasterAgentChanged = async (value: string) => {
  if (!value) {
    masterAgent.value = '';
    dataList.value = [];
    // 清空會員選擇
    selectedMemberID.value = undefined;
    sMemberID.value = '';
    qNickName.value = '';
    memberOptions.value = [];
    return;
  }
  emptyMessage.value = false;
  isTableLoading.value = true;
  masterAgent.value = value;
  await getTreasureItemList(masterAgent.value);
  isTableLoading.value = false;
  qSearchType.value = SearchTypeEnum.IS_EXIST;
  // 清空會員選擇（因為 masterAgent 改變了）
  selectedMemberID.value = undefined;
  sMemberID.value = '';
  qNickName.value = '';
  memberOptions.value = [];
};

/**
 * ============ 會員搜索相關函數 ============
 */
const fetchMemberOptions = async (queryText: string, append = false) => {
  memberLastQueryText.value = queryText;

  if (!masterAgent.value) {
    return;
  }
  if (!queryText || queryText.length < 2) {
    memberOptions.value = [];
    memberLastAccountID.value = '';
    return;
  }

  memberLoading.value = true;
  try {
    const res = await fuzzyQueryUser({
      masterAgent: masterAgent.value,
      queryText,
      limit: memberPageSize,
      lastAccountID: append ? memberLastAccountID.value || undefined : undefined,
    });

    const list = res || [];
    const mapped = list.map(item => ({
      raw: item,
      value: `${item.account}@${item.agentID}`,
      label: `${item.accountID} - ${item.nickName}`,
    }));

    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  catch (error) {
    console.error('Failed to fetch member options:', error);
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => {
  if (text && text.length >= 2) {
    fetchMemberOptions(text, false);
  }
  else {
    memberOptions.value = [];
  }
}, 300);

const onMemberSelectChanged = (value: string | undefined) => {
  if (!value) {
    sMemberID.value = '';
    qNickName.value = '';
    selectedMemberID.value = undefined;
    return;
  }

  const selected = memberOptions.value.find(opt => opt.value === value);
  if (selected) {
    sMemberID.value = `${selected.raw.account}@${selected.raw.agentID}`;
    qNickName.value = `${selected.raw.accountID} - ${selected.raw.nickName}`;
    selectedMemberID.value = value;
  }
};

const onMemberPopupScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    // 滾動到底部，載入更多
    if (memberLastQueryText.value && memberLastQueryText.value.length >= 2) {
      fetchMemberOptions(memberLastQueryText.value, true);
    }
  }
};

const handleFilter = async () => {
  if (!sMemberID.value) {
    message.error(getI18nText('notify.required'));
    return;
  }
  qMemberID.value = sMemberID.value;
  await getList();
};

// ============ 表格配置 ============
const columns = ref<TableColumn<PrivateTeamInfo>[]>([
  {
    title: getI18nText('privateTeamID'),
    dataIndex: 'privateTeamID',
    width: 200,
  },
  {
    title: getI18nText('privateName'),
    dataIndex: 'name',
    width: 200,
  },
  {
    title: getI18nText('memberID'),
    dataIndex: 'nickName',
    width: 200,
  },
  {
    title: getI18nText('owner'),
    dataIndex: 'ownerName',
    width: 200,
  },
  {
    title: getI18nText('SearchType'),
    dataIndex: 'searchType',
    width: 150,
    customRender: ({ record }) => {
      if (record.searchType === SearchTypeEnum.IS_EXIST) {
        return getI18nText('PrivateTeamSearchType.1');
      }
      else if (record.searchType === SearchTypeEnum.IS_NOT_EXIST) {
        return getI18nText('PrivateTeamSearchType.2');
      }
      return '';
    },
  },
]);

const extraData = ref<any[]>([]);

const extraDataInit = () => {
  const control: any[] = [];
  dataList.value.forEach((row) => {
    const actions: any[] = [
      {
        label: getI18nText('btnHistoryMessage'),
        // eslint-disable-next-line ts/no-use-before-define
        onClick: () => openDialogForm2(row),
      },
      {
        label: getI18nText('btnPrivateTeamKick'),
        // eslint-disable-next-line ts/no-use-before-define
        onClick: () => privateTeamKickAction(row),
        disabled: row.searchType !== SearchTypeEnum.IS_EXIST || row.memberID === row.owner,
      },
      {
        label: getI18nText('btnPrivateTeamDel'),
        // eslint-disable-next-line ts/no-use-before-define
        onClick: () => privateTeamDelAction(row),
        disabled: qSearchType.value === SearchTypeEnum.IS_NOT_EXIST,
      },
    ];
    control.push(actions);
  });
  extraData.value = control;
};

/**
 * ============ Dialog1 編輯 ============
 */
const _openDialogForm = (modeValue: 'add' | 'edit' | 'view', data?: any) => {
  mode.value = modeValue;
  dialogTitle.value = getI18nText('roomEdit');
  isDialogForm.value = true;
  nextTick(() => {
    dataFormRef.value?.clearValidate();
  });
  dataForm.roomID = '';
  dataForm.name = '';
  dataForm.announcement = '';
  if (modeValue === 'edit' && data) {
    const nData = JSON.parse(JSON.stringify(data));
    dataForm.roomID = nData.roomID;
    dataForm.name = nData.name;
    dataForm.announcement = nData.announcement || '';
  }
};

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
    startTime: [
      {
        required: true,
        validator: (_rule: any, value: any) => {
          if (!value || !Array.isArray(value) || value.length !== 2) {
            return Promise.reject(new Error(getI18nText('notify.required')));
          }
          if (value[0].toString() === value[1].toString()) {
            return Promise.reject(new Error(getI18nText('notify.badTime')));
          }
          return Promise.resolve();
        },
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
                return Promise.reject(new Error(getI18nText('notify.durationSecType1')));
              }
              break;
            case DurationSecType.hour:
              if (value < 1 || value > 23) {
                return Promise.reject(new Error(getI18nText('notify.durationSecType2')));
              }
              break;
            case DurationSecType.minute:
            case DurationSecType.second:
              if (value < 1 || value > 59) {
                return Promise.reject(new Error(getI18nText('notify.durationSecType3')));
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
      // 注意：Vue2 版本中雖然有這個功能，但實際上 privateRooms 不需要更新房間資訊
      // 這裡保持與 Vue2 一致，但不調用 updateRoom API
      closeDialogForm();
      isTableLoading.value = true;
      await getTreasureItemList(masterAgent.value);
      isTableLoading.value = false;
    }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form:', error);
  }
};

/**
 * ============ Dialog2 歷史訊息 ============
 */
const openDialogForm2 = (data: any) => {
  const startDate = dayjs().startOf('day');
  const endDate = dayjs().endOf('day');
  dataForm2.startTime = [startDate, endDate];
  messageData.value = [];
  /**
   * 根據 Vue2 的邏輯：如果 type === 1，顯示 RoomType，否則顯示 teamName
   */
  let teamName = '';
  if (data.type === 1) {
    teamName = `${getI18nText(`RoomType.${data.type}`)} ${data.name || ''}`;
  }
  else {
    teamName = findTeamName(data.teamID || '');
    if (!teamName) {
      teamName = data.name || '';
    }
  }
  dialogTitle2.value = `${getI18nText('messageSearch')} ${teamName}`;
  isDialogForm2.value = true;
  nowMemberID.value = data.memberID || '';
  nowPrivateTeamID.value = data.privateTeamID || '';
  nextTick(() => {
    dataForm2Ref.value?.clearValidate();
  });
};

const closeDialogForm2 = () => {
  lastPostData.value = {};
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
      teamID: nowPrivateTeamID.value,
      memberID: nowMemberID.value,
      searchTimes: [
        dataForm2.startTime[0].toDate(),
        dataForm2.startTime[1].toDate(),
      ] as [Date, Date],
      limit: 100,
    };
    memberList.value = {};
    lastPostData.value = postData;
    // eslint-disable-next-line ts/no-use-before-define
    await setMessageData(postData);
  }
  catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to search message:', error);
  }
};

const setMessageData = async (postData: any) => {
  try {
    const res = await privateTeamHistoryMessages(postData);
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
          }
        }
        catch (error) {
          item.messageStr = item.message;
          item.type = 1;
        }
      });
    }
    if (memberIDs.length > 0) {
      const res2 = await queryAccountBaseInfo({
        masterAgent: masterAgent.value,
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
};

/**
 * ============ Dialog3 廣播 ============
 */
const _openDialogForm3 = (type: Dialog3Type, obj?: any) => {
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
    dataForm3.roomID = obj.roomID || '';
    teamName = findTeamName(obj.teamID);
    if (teamName === '') {
      teamName = getI18nText(`RoomType.${obj.type}`);
    }
  }
  dialogTitle3.value
    = `${type === Dialog3Type.masterAgent ? masterAgent.value : teamName
    } ${
      getI18nText('broadcast')}`;
};

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
          masterAgent: masterAgent.value,
          message: dataForm3.message,
        });
        break;
      case Dialog3Type.room:
        res = await roomBroadcast({
          masterAgent: masterAgent.value,
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
const _closeDialogForm4 = () => {
  _isDialogForm4.value = false;
};

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

const _submitForm5 = async () => {
  try {
    await dataForm5Ref.value?.validate();
    const form5 = dataForm5;
    closeDialogForm5();
    const _durationSec = Number(form5.durationSec);
    switch (form5.durationSecType) {
      case DurationSecType.day:
        // durationSec = durationSec * 60 * 60 * 24;
        break;
      case DurationSecType.hour:
        // durationSec = durationSec * 60 * 60;
        break;
      case DurationSecType.minute:
        // durationSec = durationSec * 60;
        break;
    }
    /**
     * 注意：privateRooms 可能不需要 temporaryMuteUser，這裡先保留
     * const postData = {
     *   memberID: form5.memberID,
     *   roomID: nowRoomID.value,
     *   durationSec,
     * };
     * await temporaryMuteUser(postData);
     */
  }
  catch (error) {
    if (error && typeof error === 'object' && 'errorFields' in error) {
      return;
    }
    console.error('Failed to submit form5:', error);
  }
};

/**
 * ============ 群組操作 ============
 */
const privateTeamKickAction = (obj: any) => {
  const content = `${getI18nText('notify.btnPrivateTeamKick')} - ${obj.name}`;
  const title = getI18nText('notify.title');
  Modal.confirm({
    title,
    content,
    okText: t('confirm'),
    cancelText: t('cancel'),
    onOk: async () => {
      try {
        const postData = {
          kickerMemberID: obj.owner,
          memberIDs: [obj.memberID],
          teamID: obj.privateTeamID,
          platformMemberID: getAuthAccount.value,
        };
        const res = await privateTeamKick(postData);
        if (!res.error) {
          await getList();
          message.success(t('success'));
        }
      }
      catch (error) {
        console.error('Failed to kick private team:', error);
        message.error(t('fail'));
      }
    },
  });
};

const privateTeamDelAction = (obj: any) => {
  const content = `${getI18nText('notify.btnPrivateTeamDel')} - ${obj.name}`;
  const title = getI18nText('notify.title');
  Modal.confirm({
    title,
    content,
    okText: t('confirm'),
    cancelText: t('cancel'),
    onOk: async () => {
      try {
        const postData = {
          memberID: obj.memberID,
          teamID: obj.privateTeamID,
          platformMemberID: getAuthAccount.value,
        };
        const res = await privateTeamDel(postData);
        if (!res.error) {
          await getList();
          message.success(t('success'));
        }
      }
      catch (error) {
        console.error('Failed to delete private team:', error);
        message.error(t('fail'));
      }
    },
  });
};

// ============ 表格 ============
const [DynamicTable] = useTable({
  search: false,
  showActionColumn: true,
  actionColumn: {
    title: getI18nText('control'),
    width: 300,
    fixed: 'right',
    actions: ({ record, index }) => {
      const actions = extraData.value[index] || [];
      return actions.map((action: any) => ({
        ...action,
        onClick: () => action.onClick(record),
      }));
    },
  },
});

/**
 * ============ 初始化 ============
 */
const fetchMasterAgentList = async () => {
  try {
    const list = await getMasterAgentAccountList();
    masterAgentList.value = (list || []).map((item: any) => ({ account: item.account }));
  }
  catch (error) {
    console.error('Failed to fetch master agent list:', error);
  }
};

onMounted(async () => {
  if (getAuthLevel.value < 4) {
    await fetchMasterAgentList();
  }
});
</script>

<template>
  <div class="app-container chatroom-private-rooms">
    <div class="filter-container">
      <div class="wrap">
        <div
          v-if="getAuthLevel < 4"
          class="input_group"
        >
          <div class="txt">
            <label>站長</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="masterAgent"
              placeholder="請選擇站長"
              style="width: 200px"
              @change="onMasterAgentChanged"
            >
              <a-select-option
                v-for="item in masterAgentList"
                :key="item.account"
                :value="item.account"
              >
                {{ item.account }}
              </a-select-option>
            </a-select>
          </div>
        </div>
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">
              {{ getI18nText('SearchType') }}
            </label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="sSearchType"
              style="width: 200px"
            >
              <a-select-option
                v-for="platform in searchTypeList"
                :key="platform.value"
                :value="platform.value"
              >
                {{ platform.name }}
              </a-select-option>
            </a-select>
          </div>
        </div>
        <div class="input_group">
          <div class="txt">
            <label style="color: #ff4949">會員</label>
          </div>
          <div class="my_input">
            <a-select
              v-model:value="selectedMemberID"
              show-search
              :filter-option="false"
              :options="memberOptions"
              :loading="memberLoading"
              :disabled="!masterAgent"
              style="width: 200px"
              allow-clear
              placeholder="00001314 - 王小明"
              @search="onMemberSearch"
              @change="onMemberSelectChanged"
              @popup-scroll="onMemberPopupScroll"
            />
          </div>
        </div>
        <div class="input_group">
          <a-button
            type="primary"
            @click="handleFilter"
          >
            {{ t('search') }}
          </a-button>
        </div>
      </div>
    </div>

    <DynamicTable
      :loading="isTableLoading"
      :columns="columns"
      :data-source="dataList"
      :scroll="{ x: 'max-content' }"
    />

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
              <a-range-picker
                v-model:value="dataForm2.startTime"
                show-time
                format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
              <a-button
                style="margin-left: 10px"
                @click="searchMessage"
              >
                {{ t('search') }}
              </a-button>
            </div>
            <div class="input_group">
              <span>{{ getI18nText('messageAlert2') }}</span>
            </div>
          </div>
        </a-form-item>
      </a-form>
      <a-table
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
              if (record.type === 0) {
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
  </div>
</template>

<style lang="less" scoped>
.chatroom-private-rooms {
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
