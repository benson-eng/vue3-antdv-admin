import type { ISettings } from '@/api/backend/agentHubManager';
import { createCurrencyType } from '@/api/backend/adminAccount/currency';
import { createToken } from '@/api/backend/adminAccount/token';
import { OTPTemplateTypeMember, setOTPSmsTemplateMember } from '@/api/backend/adminSystem/accountSystem';
import { uploadRemoteConfig } from '@/api/backend/adminSystem/slotgameServer';
import { setSMSServiceCost } from '@/api/backend/adminSystem/smsSystem';
import { editAgentSettings, queryAgent, queryStationMaster } from '@/api/backend/agentHubManager';
import { setMissionSetting } from '@/api/backend/gameMissionSystem';
import { setGuildCreateSetting, setGuildLevelsSetting } from '@/api/backend/guildServer';
import { createVipSetting } from '@/api/backend/member/vipServer';
import { getPaymentServiceCostItems, setPaymentServiceCost } from '@/api/backend/paymentServer';
import { setOTPSmsTemplate } from '@/api/backend/transactionSystem';
import { AchievementTaskCondType, addIcon, addItemTag, addTaskItem, addTreasureItem, itemTagList } from '@/api/backend/treasureChestSystem';

/**
 * 取得預設分成設定
 * @param stationMasterName 站台主名稱
 * @param use 使用類型：'station' | 'family'
 * @param agentName 代理名稱（可選）
 * @returns 預設設定陣列
 */
export function getDefDistAcctSettings(
  stationMasterName: string,
  use: 'station' | 'family',
  agentName?: string,
): ISettings[] {
  const re: ISettings[] = [
    {
      stationMasterName,
      name: 'Purchase',
      type: 'Purchase',
      subType: 'Purchase',
      description: '儲值預設分成比例',
      percentage: 0.15, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'ServiceFee',
      type: 'ServiceFee',
      subType: 'ServiceFee',
      description: '手續費預設分成比例',
      percentage: 0.5, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'SMSServiceCost',
      type: 'SMSServiceCost',
      subType: 'SMSServiceCost',
      description: '服務簡訊費成本預設分成比例',
      percentage: 0.1, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'PurchaseServiceCost',
      type: 'PurchaseServiceCost',
      subType: 'PurchaseServiceCost',
      description: '服務金流手續費成本預設分成比例',
      percentage: 0.3, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'Bonus',
      type: 'Bonus',
      subType: 'Bonus',
      description: '紅利預設分成比例',
      percentage: 0.5, // ex: 10% => 0.1
      agentName,
    },
    {
      stationMasterName,
      name: 'GameWinLose',
      type: 'GameWinLose',
      subType: 'GameWinLose',
      description: '遊戲輸贏預設分成比例',
      percentage: 0.15, // ex: 10% => 0.1
      agentName,
    },
  ];
  if (use === 'station') {
    // 預備環境客製使用
  }
  else if (use === 'family') {
    // 預備環境客製使用
  }
  return re;
}

/**
 * 幣別預設資料
 */
const setCurrencyDefaultData = async (adminAccountId: number, masterAgent: string) => {
  const tempCurrencyDataLock = {
    adminAccountId,
    currencyCode: '🔒-gold',
    currencyIndex: 1,
    currencyName: '金幣保險箱',
    currencySymbol: '',
    id: 0,
    masterAgent,
  };
  await createCurrencyType(tempCurrencyDataLock);
  const tempCurrencyDataServiceFee = {
    ...tempCurrencyDataLock,
    currencyCode: 'ntd-service-fee',
    currencyIndex: 2,
    currencyName: 'ntd-service-fee',
  };
  await createCurrencyType(tempCurrencyDataServiceFee);
};

/**
 * 根據文件名推斷 MIME 類型
 */
const getMimeTypeFromFileName = (fileName: string): string => {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return mimeTypes[ext || ''] || 'image/png';
};

/**
 * 轉換圖片 URL 為 File 物件
 */
const convertImageToFile = async (imagePath: string): Promise<File | null> => {
  let file: File | null = null;
  try {
    const response = await fetch(imagePath);
    if (!response.ok) {
      console.error('獲取圖片失敗:', response.status, response.statusText);
      return null;
    }
    const blob = await response.blob();
    const fileName = imagePath.split('/').pop() || 'image.png';
    // 對齊 vue2：優先使用 blob.type，如果為空則從 response headers 或根據文件擴展名推斷
    // vue2 使用 blob.type 直接，但如果為空可能導致問題，所以這裡做改進
    const fileType = blob.type || response.headers.get('content-type') || getMimeTypeFromFileName(fileName);
    file = new File([blob], fileName, { type: fileType });
  }
  catch (error) {
    console.error('轉換圖片失敗:', error);
  }
  return file;
};

/**
 * Token 預設資料
 */
const setTokenDefaultData = async (masterAgent: string) => {
  try {
    const uploadTokenImage = await convertImageToFile('/defaultImage/dailyToken.png');
    if (uploadTokenImage) {
      const tempTokenData = {
        masterAgent,
        type: 1,
        name: '每日登入道具',
        iconFile: uploadTokenImage,
        transactionLimit: 0,
      };
      await createToken(tempTokenData);
    }
  }
  catch (error) {
    console.error('設定 Token 預設資料失敗:', error);
  }
};

/**
 * VIP 預設資料
 */
const setVipDefaultData = async (masterAgent: string) => {
  const vipDataList = [
    {
      levelUpNeedPoint: 0,
      extraSettings: [
        { name: 'totalBet', type: 'normal', value: '0' },
        { name: 'levelLimit', type: 'normal', value: '1' },
        { name: 'sendGift', type: 'normal', value: '0' },
        { name: 'receiveGift', type: 'normal', value: '0' },
        { name: 'tip', type: 'normal', value: '0' },
        { name: 'vipLimit', type: 'normal', value: '1' },
        { name: 'transactionMinLevelLimit', type: 'normal', value: '-1' },
        { name: 'transactionReservedBalance', type: 'normal', value: '30000' },
        { name: 'seatKeepTime', type: 'normal', value: '0' },
        { name: 'sendItemCount', type: 'normal', value: '0' },
        { name: 'isCanJoinGuild', type: 'normal', value: '1' },
        { name: 'isCanCreateGuild', type: 'normal', value: '0' },
      ],
    },
    {
      levelUpNeedPoint: 1,
      extraSettings: [
        { name: 'totalBet', type: 'normal', value: '0' },
        { name: 'levelLimit', type: 'normal', value: '1' },
        { name: 'sendGift', type: 'normal', value: '0' },
        { name: 'receiveGift', type: 'normal', value: '1' },
        { name: 'tip', type: 'normal', value: '-1' },
        { name: 'vipLimit', type: 'normal', value: '1' },
        { name: 'transactionMinLevelLimit', type: 'normal', value: '-1' },
        { name: 'transactionReservedBalance', type: 'normal', value: '30000' },
        { name: 'seatKeepTime', type: 'normal', value: '0' },
        { name: 'sendItemCount', type: 'normal', value: '0' },
        { name: 'isCanJoinGuild', type: 'normal', value: '1' },
        { name: 'isCanCreateGuild', type: 'normal', value: '0' },
      ],
    },
    {
      levelUpNeedPoint: 3,
      extraSettings: [
        { name: 'totalBet', type: 'normal', value: '0' },
        { name: 'levelLimit', type: 'normal', value: '1' },
        { name: 'sendGift', type: 'normal', value: '80000' },
        { name: 'receiveGift', type: 'normal', value: '1' },
        { name: 'tip', type: 'normal', value: '2' },
        { name: 'vipLimit', type: 'normal', value: '1' },
        { name: 'transactionMinLevelLimit', type: 'normal', value: '-1' },
        { name: 'transactionReservedBalance', type: 'normal', value: '30000' },
        { name: 'seatKeepTime', type: 'normal', value: '0' },
        { name: 'sendItemCount', type: 'normal', value: '5' },
        { name: 'isCanJoinGuild', type: 'normal', value: '1' },
        { name: 'isCanCreateGuild', type: 'normal', value: '0' },
      ],
    },
    {
      levelUpNeedPoint: 1000,
      extraSettings: [
        { name: 'totalBet', type: 'normal', value: '0' },
        { name: 'levelLimit', type: 'normal', value: '1' },
        { name: 'sendGift', type: 'normal', value: '500000' },
        { name: 'receiveGift', type: 'normal', value: '1' },
        { name: 'tip', type: 'normal', value: '2' },
        { name: 'vipLimit', type: 'normal', value: '0' },
        { name: 'transactionMinLevelLimit', type: 'normal', value: '-1' },
        { name: 'transactionReservedBalance', type: 'normal', value: '30000' },
        { name: 'seatKeepTime', type: 'normal', value: '0' },
        { name: 'sendItemCount', type: 'normal', value: '20' },
        { name: 'isCanJoinGuild', type: 'normal', value: '1' },
        { name: 'isCanCreateGuild', type: 'normal', value: '0' },
      ],
    },
    {
      levelUpNeedPoint: 5000,
      extraSettings: [
        { name: 'totalBet', type: 'normal', value: '25000000' },
        { name: 'levelLimit', type: 'normal', value: '1' },
        { name: 'sendGift', type: 'normal', value: '2000000' },
        { name: 'receiveGift', type: 'normal', value: '1' },
        { name: 'tip', type: 'normal', value: '1.5' },
        { name: 'vipLimit', type: 'normal', value: '0' },
        { name: 'transactionMinLevelLimit', type: 'normal', value: '-1' },
        { name: 'transactionReservedBalance', type: 'normal', value: '30000' },
        { name: 'seatKeepTime', type: 'normal', value: '0' },
        { name: 'sendItemCount', type: 'normal', value: '30' },
        { name: 'isCanJoinGuild', type: 'normal', value: '1' },
        { name: 'isCanCreateGuild', type: 'normal', value: '0' },
      ],
    },
    {
      levelUpNeedPoint: 10000,
      extraSettings: [
        { name: 'totalBet', type: 'normal', value: '50000000' },
        { name: 'levelLimit', type: 'normal', value: '1' },
        { name: 'sendGift', type: 'normal', value: '-1' },
        { name: 'receiveGift', type: 'normal', value: '1' },
        { name: 'tip', type: 'normal', value: '1.5' },
        { name: 'vipLimit', type: 'normal', value: '0' },
        { name: 'transactionMinLevelLimit', type: 'normal', value: '-1' },
        { name: 'transactionReservedBalance', type: 'normal', value: '30000' },
        { name: 'seatKeepTime', type: 'normal', value: '0' },
        { name: 'sendItemCount', type: 'normal', value: '-1' },
        { name: 'isCanJoinGuild', type: 'normal', value: '1' },
        { name: 'isCanCreateGuild', type: 'normal', value: '1' },
      ],
    },
  ];

  for (let index = 0; index < vipDataList.length; index++) {
    const vipLevel = vipDataList[index];
    const vip0Data = {
      id: -1,
      masterAgent,
      vipLevel: index,
      levelUpNeedPoint: vipLevel.levelUpNeedPoint,
      name: `VIP${index}`,
      icon: '',
      iconRaw: null,
      extraSettings: vipLevel.extraSettings,
      lastMonthVip: null,
    };
    await createVipSetting(vip0Data);
  }
};

/**
 * 分發配置預設資料
 */
const setDistributionConfigDefaultData = async (masterAgent: string) => {
  const defaultConfig = [
    { name: 'ScratchCard', nameTitle: '活動－客製化刮刮卡', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'DailyAward', nameTitle: '活動－每日登入', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'FBLoginIn', nameTitle: 'facebook 登入', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'guestLoginIn', nameTitle: '訪客登入', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'LevelLock', nameTitle: '遊戲等級機制', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'FirstPayment', nameTitle: '活動－首儲', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'Safe', nameTitle: '保險箱', type: 'boolean', value: false, index: null, canDel: false, showLv: 2 },
    { name: 'MainColor', nameTitle: '平台主色系', type: 'color', value: '#D50303', index: null, canDel: false, showLv: 3 },
    { name: 'MainBorderColor', nameTitle: '平台邊框主色系', type: 'color', value: '#FF0000', index: null, canDel: false, showLv: 3 },
    { name: 'TipColor', nameTitle: '提示顏色', type: 'color', value: '#0148A8', index: null, canDel: false, showLv: 3 },
    { canDel: true, diff: false, index: null, name: 'guildPrivacy', nameTitle: '公會權益', type: 'string2', value: '', showLv: 3 },
    { canDel: true, diff: false, index: null, name: 'gamerule', nameTitle: '遊戲規章', type: 'string2', value: '', showLv: 3 },
    { canDel: true, diff: false, index: null, name: 'privacy', nameTitle: '隱私條款', type: 'string2', value: '', showLv: 3 },
    { canDel: true, diff: false, index: null, name: 'service', nameTitle: '服務條款', type: 'string2', value: '', showLv: 3 },
  ];

  const jsonObj: any = {};
  defaultConfig.forEach((i: any) => {
    switch (i.type) {
      case 'boolean':
      case 'string':
      case 'color':
      case 'string2':
        jsonObj[i.name] = i.value;
        break;
      case 'number':
        jsonObj[i.name] = Number(i.value);
        break;
    }
  });

  jsonObj.bgInfo = defaultConfig.filter((el: any) => el);
  const sssss = JSON.stringify(jsonObj);
  const file = new File([sssss], 'remoteConfigsss');
  const uploadData = {
    masterAgent,
    imageFile: file,
    name: 'distributionConfig',
  };
  await uploadRemoteConfig(uploadData);
};

/**
 * 分發網站配置預設資料
 */
const setDistributionWebConfigDefaultData = async (masterAgent: string, webName: string, webSide: string) => {
  const defaultConfig = [
    { canDel: true, diff: false, index: null, name: 'webName', nameTitle: '網站名稱', type: 'string', value: webName },
    { canDel: true, diff: false, index: null, name: 'webSide', nameTitle: '網域名稱', type: 'string', value: webSide },
    { canDel: true, diff: false, index: null, name: 'masterAgent', nameTitle: '總代理名稱', type: 'string', value: masterAgent },
  ];

  const jsonObj: any = {};
  defaultConfig.forEach((i: any) => {
    switch (i.type) {
      case 'boolean':
      case 'string':
      case 'color':
      case 'string2':
        jsonObj[i.name] = i.value;
        break;
      case 'number':
        jsonObj[i.name] = Number(i.value);
        break;
    }
  });

  jsonObj.bgInfo = defaultConfig.filter((el: any) => el);
  const sssss = JSON.stringify(jsonObj);
  const file = new File([sssss], 'remoteConfigsss');
  const uploadData = {
    masterAgent,
    imageFile: file,
    name: 'distributionWebConfig',
  };
  await uploadRemoteConfig(uploadData);
};

/**
 * SMS 服務成本預設資料
 */
const setSMSServiceCosts = async (masterAgent: string) => {
  try {
    const postDataSms: any = {
      settings: [
        {
          provider: 'Mitake',
          serviceCost: 0.6,
          masterAgent,
        },
      ],
    };
    await setSMSServiceCost(postDataSms);
  }
  catch (error) {
    console.error('設定 SMS 服務成本失敗:', error);
  }
};

/**
 * 支付服務成本預設資料
 */
const setPaymentServiceCosts = async (masterAgent: string) => {
  try {
    const res = await getPaymentServiceCostItems({});
    const defValue: Record<string, number> = {
      COSTPOINT: 21,
      HE0033: 5,
      INGAME: 21,
      HE0003: 13,
      HE0030: 13,
      HE0001: 13,
      HE0004: 13,
      FS0018: 13,
      HC0036: 8,
      DF6500001: 8,
      DF1200002: 5,
    };
    const postDataPayment: { settings: Array<{ paymentType: string; paymentTypeName: string; serviceCost: number; masterAgent: string }> } = {
      settings: [],
    };
    if (res.data) {
      res.data.forEach((item: { paymentType: string; paymentTypeName: string }) => {
        if (defValue[item.paymentType]) {
          postDataPayment.settings.push({
            paymentType: item.paymentType,
            paymentTypeName: item.paymentTypeName,
            serviceCost: defValue[item.paymentType],
            masterAgent,
          });
        }
      });
      if (postDataPayment.settings.length > 0) {
        await setPaymentServiceCost(postDataPayment);
      }
    }
  }
  catch (error) {
    console.error('設定支付服務成本失敗:', error);
  }
};

/**
 * 公會預設資料
 */
const setGuildDefaultData = async (masterAgent: string) => {
  const guildCreateSettingData = {
    masterAgent,
    user: 'DIST_CG',
    createNeedCostCoins: '100000.00',
  };
  await setGuildCreateSetting(guildCreateSettingData);

  const guildLvSettingData = [
    { id: undefined, masterAgent, level: '0', levelName: '0等公會', maxCounts: 30, guildAccumulationFund: null, betFee: '0.50', topUpFee: '0.20', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '1', levelName: '1等公會', maxCounts: 40, guildAccumulationFund: '80000.00', betFee: '0.50', topUpFee: '0.20', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '2', levelName: '2等公會', maxCounts: 50, guildAccumulationFund: '280000.00', betFee: '0.50', topUpFee: '0.30', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '3', levelName: '3等公會', maxCounts: 60, guildAccumulationFund: '580000.00', betFee: '0.50', topUpFee: '0.30', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '4', levelName: '4等公會', maxCounts: 70, guildAccumulationFund: '2880000.00', betFee: '0.50', topUpFee: '0.50', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '5', levelName: '5等公會', maxCounts: 80, guildAccumulationFund: '8880000.00', betFee: '0.50', topUpFee: '0.50', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '6', levelName: '6等公會', maxCounts: 100, guildAccumulationFund: '28880000.00', betFee: '0.50', topUpFee: '0.60', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '7', levelName: '7等公會', maxCounts: 120, guildAccumulationFund: '38880000.00', betFee: '0.50', topUpFee: '0.60', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '8', levelName: '8等公會', maxCounts: 150, guildAccumulationFund: '58880000.00', betFee: '0.50', topUpFee: '0.80', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '9', levelName: '9等公會', maxCounts: 180, guildAccumulationFund: '88880000.00', betFee: '0.50', topUpFee: '0.80', gameWinLoseFee: '0' },
    { id: undefined, masterAgent, level: '10', levelName: '10等公會', maxCounts: 200, guildAccumulationFund: '100000000.00', betFee: '0.50', topUpFee: '0.80', gameWinLoseFee: '0' },
  ];
  await setGuildLevelsSetting({ settings: guildLvSettingData });
};

/**
 * 新手任務預設資料
 */
const setNoviceMissionDefaultData = async (masterAgent: string) => {
  try {
    const validFrom = '2024-11-30T16:00:00.000Z';
    const validUntil = '2025-12-31T15:59:59.000Z';
    const taskId = `task-${Date.now()}`;

    const settings = [
      {
        masterAgent: `${masterAgent}`,
        name: '{"default":"會員註冊","cn":"","en":"","vi":"","tw":"會員註冊"}',
        type: 1,
        vip: 0,
        group: 'NoviceMission',
        icon: 'default',
        conditions: [{ type: 30 }],
        accumulatedValue: {
          currentValue: 0,
          limit: 1,
          dispatchType: 0,
          targets: [
            {
              targetValue: 1,
              isReceived: false,
              rewards: [
                {
                  type: 1,
                  currencyType: 'gold',
                  balance: 5000,
                  isFreeBalance: false,
                },
              ],
            },
          ],
        },
        index: 1,
        validFrom,
        validUntil,
        extraInfo: {
          taskId,
          validDate: [validFrom, validUntil],
          mission: {
            missionTitle: '會員註冊',
            missionTitlesZhcustom: false,
            missionTitlesZh: '會員註冊',
            missionTitlesEn: '',
            missionTitlesVn: '',
            missionTitlesCn: '',
            group: 'NoviceMission',
            type: 1,
            gameType: 'novice',
            conditions: '17',
            games: [],
            valueM: null,
            valueK: null,
            valueT: null,
            awardItems: [
              {
                awardType: 0,
                award: 'gold',
                awardAmount: '5000',
                vip: null,
                isFreeBalance: false,
                awardTreasureCardRatio: '1:1',
                unfreezeRatio: null,
                canEdit: true,
              },
            ],
            animation: null,
            index: 1,
            useRedirectUrl: null,
            dispatchType: 0,
          },
          oneTag: '0_NoviceMissionCOMMON_0',
        },
        isAutoCreate: true,
      },
      {
        masterAgent: `${masterAgent}`,
        name: '{"default":"綁定手機","cn":"","en":"","vi":"","tw":"綁定手機"}',
        type: 1,
        vip: 0,
        group: 'NoviceMission',
        icon: 'default',
        conditions: [{ type: 31 }],
        accumulatedValue: {
          currentValue: 0,
          limit: 1,
          dispatchType: 0,
          targets: [
            {
              targetValue: 1,
              isReceived: false,
              rewards: [
                {
                  type: 1,
                  currencyType: 'gold',
                  balance: 5000,
                  isFreeBalance: false,
                },
                {
                  type: 5,
                  point: 1,
                },
              ],
            },
          ],
        },
        clientAction: {
          type: 3,
          page: 'OTP',
        },
        index: 2,
        validFrom,
        validUntil,
        extraInfo: {
          taskId,
          validDate: [validFrom, validUntil],
          mission: {
            missionTitle: '綁定手機',
            missionTitlesZhcustom: false,
            missionTitlesZh: '綁定手機',
            missionTitlesEn: '',
            missionTitlesVn: '',
            missionTitlesCn: '',
            group: 'NoviceMission',
            type: 1,
            gameType: 'novice',
            conditions: '18',
            games: [],
            valueM: null,
            valueK: null,
            valueT: null,
            awardItems: [
              {
                awardType: 0,
                award: 'gold',
                awardAmount: '5000',
                vip: null,
                isFreeBalance: false,
                awardTreasureCardRatio: '1:1',
                unfreezeRatio: null,
                canEdit: true,
              },
              {
                awardType: 6,
                awardAmount: '1',
                vip: null,
                isFreeBalance: false,
                awardTreasureCardRatio: '1:1',
                unfreezeRatio: null,
                canEdit: true,
              },
            ],
            animation: null,
            index: 2,
            useRedirectUrl: null,
            dispatchType: 0,
          },
          oneTag: '0_NoviceMissionCOMMON_1',
        },
        isAutoCreate: true,
      },
      {
        masterAgent: `${masterAgent}`,
        name: '{"default":"安裝桌面贈點","cn":"","en":"","vi":"","tw":"安裝桌面贈點"}',
        type: 1,
        vip: 0,
        group: 'NoviceMission',
        icon: 'default',
        conditions: [{ type: 38 }],
        accumulatedValue: {
          currentValue: 1,
          limit: 0,
          dispatchType: 0,
          targets: [
            {
              targetValue: 1,
              isReceived: false,
              rewards: [
                {
                  type: 1,
                  currencyType: 'gold',
                  balance: 5000,
                  isFreeBalance: false,
                },
              ],
            },
          ],
        },
        clientAction: {
          type: 3,
          page: 'OTP',
        },
        index: 3,
        validFrom,
        validUntil,
        extraInfo: {
          taskId,
          validDate: [validFrom, validUntil],
          mission: {
            missionTitle: '安裝桌面贈點',
            missionTitlesZhcustom: false,
            missionTitlesZh: '安裝桌面贈點',
            missionTitlesEn: '',
            missionTitlesVn: '',
            missionTitlesCn: '',
            group: 'NoviceMission',
            type: 1,
            gameType: 'novice',
            conditions: '21',
            games: [],
            valueM: null,
            valueK: null,
            valueT: null,
            awardItems: [
              {
                awardType: 0,
                award: 'gold',
                awardAmount: '5000',
                vip: null,
                isFreeBalance: false,
                awardTreasureCardRatio: '1:1',
                unfreezeRatio: null,
                canEdit: true,
              },
            ],
            animation: null,
            index: 3,
            useRedirectUrl: null,
            dispatchType: 0,
          },
          oneTag: '0_NoviceMissionCOMMON_2',
        },
        isAutoCreate: true,
      },
      {
        masterAgent: `${masterAgent}`,
        name: '{"default":"加官方LINE好友","cn":"","en":"","vi":"","tw":"加官方LINE好友"}',
        type: 1,
        vip: 0,
        group: 'NoviceMission',
        icon: 'default',
        conditions: [{ type: 39 }],
        accumulatedValue: {
          currentValue: 1,
          limit: 0,
          dispatchType: 0,
          targets: [
            {
              targetValue: 1,
              isReceived: false,
              rewards: [
                {
                  type: 1,
                  currencyType: 'gold',
                  balance: 1000,
                  isFreeBalance: false,
                },
              ],
            },
          ],
        },
        clientAction: {
          type: 3,
          page: 'OTP',
        },
        index: 4,
        validFrom,
        validUntil,
        extraInfo: {
          taskId,
          validDate: [validFrom, validUntil],
          mission: {
            missionTitle: '加官方LINE好友',
            missionTitlesZhcustom: false,
            missionTitlesZh: '加官方LINE好友',
            missionTitlesEn: '',
            missionTitlesVn: '',
            missionTitlesCn: '',
            group: 'NoviceMission',
            type: 1,
            gameType: 'novice',
            conditions: '22',
            games: [],
            valueM: null,
            valueK: null,
            valueT: null,
            awardItems: [
              {
                awardType: 0,
                award: 'gold',
                awardAmount: '1000',
                vip: null,
                isFreeBalance: false,
                awardTreasureCardRatio: '1:1',
                unfreezeRatio: null,
                canEdit: true,
              },
            ],
            animation: null,
            index: 4,
            useRedirectUrl: null,
            dispatchType: 0,
          },
          oneTag: '0_NoviceMissionCOMMON_3',
        },
        isAutoCreate: true,
      },
    ];

    await setMissionSetting({ masterAgent, settings });
  }
  catch (error) {
    console.error('設定新手任務預設資料失敗:', error);
  }
};

/**
 * 道具標籤預設資料
 */
const setItemTagDefaultData = async (masterAgent: string) => {
  await addItemTag({ masterAgent, tag: '加入時間', itemType: 'badge' });
  await addItemTag({ masterAgent, tag: '累積投注', itemType: 'badge' });
};

/**
 * OTP SMS 模板預設資料
 */
const setOTPSmsTemplateDefaultData = async (masterAgent: string) => {
  const template = 'LINE娛樂城手機驗證碼是：{otp}，\n請於{expireTimeMin}分鐘內輸入完成認證，\n以免逾時失效，感謝您。 \n';
  await setOTPSmsTemplate({ masterAgent, type: 'BindPhone', template });
  await setOTPSmsTemplate({ masterAgent, type: 'SetTransactionPassword', template });
  await setOTPSmsTemplate({ masterAgent, type: 'TransactionPassword', template });
  await setOTPSmsTemplateMember({ masterAgent, type: OTPTemplateTypeMember.CHANGE_PASSWORD, template });
};

/**
 * 寶箱道具表預設資料
 */
const setTreasureItemTableDefaultData = async (masterAgent: string) => {
  try {
    const res = await itemTagList({ masterAgent });
    let tagID1 = -1;
    let tagID2 = -1;
    if (res && Array.isArray(res)) {
      await Promise.all(res.map(async (item) => {
        if (item.itemType === 'badge' && item.tag === '加入時間') {
          tagID1 = item.id;
        }
        if (item.itemType === 'badge' && item.tag === '累積投注') {
          tagID2 = item.id;
        }
      }));
    }

    const treasureItems = [
      { image: '/defaultImage/fan01.webp', itemName: '加入一年', description: '加入一年', type: AchievementTaskCondType.RegisterDays, value: 365, tagID: tagID1 },
      { image: '/defaultImage/fan02.webp', itemName: '加入兩年', description: '加入兩年', type: AchievementTaskCondType.RegisterDays, value: 730, tagID: tagID1 },
      { image: '/defaultImage/fan03.webp', itemName: '加入三年', description: '加入三年', type: AchievementTaskCondType.RegisterDays, value: 1095, tagID: tagID1 },
      { image: '/defaultImage/bet01.webp', itemName: '100萬押注', description: '100萬押注', type: AchievementTaskCondType.GameTotalBet, value: 1000000, tagID: tagID2 },
      { image: '/defaultImage/bet02.webp', itemName: '1000萬押注', description: '1000萬押注', type: AchievementTaskCondType.GameTotalBet, value: 10000000, tagID: tagID2 },
      { image: '/defaultImage/bet03.webp', itemName: '1億押注', description: '1億押注', type: AchievementTaskCondType.GameTotalBet, value: 100000000, tagID: tagID2 },
      { image: '/defaultImage/bet04.webp', itemName: '10億押注', description: '10億押注', type: AchievementTaskCondType.GameTotalBet, value: 1000000000, tagID: tagID2 },
      { image: '/defaultImage/bet05.webp', itemName: '100億押注', description: '100億押注', type: AchievementTaskCondType.GameTotalBet, value: 10000000000, tagID: tagID2 },
    ];

    const tasks = treasureItems.map(async (item) => {
      const iconFile = await convertImageToFile(item.image);
      if (iconFile) {
        const treasureItem: any = await addTreasureItem({
          masterAgent,
          iconFile,
          currencyType: 'gold',
          itemName: item.itemName,
          description: item.description,
          itemType: 'badge',
          uniqueness: 0,
          tagID: item.tagID,
        });

        if (treasureItem?.data?.treasureItemID) {
          await addTaskItem({
            masterAgent,
            treasureItemID: treasureItem.data.treasureItemID,
            condition: {
              type: item.type,
              value: item.value,
            },
          });
        }
      }
    });

    await Promise.all(tasks);
  }
  catch (error) {
    console.error('設定寶箱道具表預設資料失敗:', error);
  }
};

/**
 * 預設郵件圖示
 */
const setDefaultMailIcon = async (masterAgent: string) => {
  const mailIconList = [
    { name: '金幣', imageURL: '/defaultImage/mail/coin.png' },
    { name: '禮物', imageURL: '/defaultImage/mail/gift.png' },
    { name: '信件', imageURL: '/defaultImage/mail/mail.png' },
    { name: '公告', imageURL: '/defaultImage/mail/trumpet.png' },
  ];

  for (const item of mailIconList) {
    try {
      const iconFile = await convertImageToFile(item.imageURL);
      if (iconFile) {
        await addIcon({
          masterAgent,
          name: item.name,
          imageFile: iconFile,
          type: 'mail',
          gameID: undefined,
        });
      }
    }
    catch (error) {
      console.error(`設定 ${item.name} 圖示失敗:`, error);
    }
  }
};

/**
 * 自動建立分站帳戶
 */
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const autoCreateDistAcctStation = async (masterAgent: string) => {
  await delay(3000);

  const postData = { name: masterAgent };
  const response = await queryStationMaster(postData);

  if (response && response.result && response.value) {
    const postData1 = {
      settings: getDefDistAcctSettings(response.value.name, 'station'),
    };
    await editAgentSettings(postData1);

    const postData2 = {
      stationMasterName: response.value.name,
      name: `${response.value.name}agent`,
      isDefaultAgent: true,
    };
    const response2 = await queryAgent(postData2);

    if (response2 && response2.result && response2.value) {
      const postData3 = {
        settings: getDefDistAcctSettings(
          response.value.name,
          'family',
          response2.value.name,
        ),
      };
      await editAgentSettings(postData3);
    }
  }
};

/**
 * 設定新總代理的預設資料
 * @param masterAgentID 總代理 ID
 * @param masterAgentAccount 總代理帳號
 * @param webName 網站名稱
 * @param webSide 網站網域
 */
export const setNewMasterAgentDefaultData = async (
  masterAgentID: number,
  masterAgentAccount: string,
  webName: string,
  webSide: string,
) => {
  await autoCreateDistAcctStation(masterAgentAccount);
  await setTokenDefaultData(masterAgentAccount);
  await setDistributionConfigDefaultData(masterAgentAccount);
  await setDistributionWebConfigDefaultData(masterAgentAccount, webName, webSide);
  await setPaymentServiceCosts(masterAgentAccount);
  await setSMSServiceCosts(masterAgentAccount);
  await setItemTagDefaultData(masterAgentAccount);
  await Promise.all([
    setCurrencyDefaultData(masterAgentID, masterAgentAccount),
    setVipDefaultData(masterAgentAccount),
    setGuildDefaultData(masterAgentAccount),
    setNoviceMissionDefaultData(masterAgentAccount),
    setOTPSmsTemplateDefaultData(masterAgentAccount),
    setTreasureItemTableDefaultData(masterAgentAccount),
    setDefaultMailIcon(masterAgentAccount),
  ]);
};

export {
  setDistributionConfigDefaultData,
  setDistributionWebConfigDefaultData,
};
