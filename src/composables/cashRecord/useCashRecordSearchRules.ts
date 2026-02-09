/**
 * CashRecord 搜尋規則 Composable
 *
 * 負責 Type → SubType → Source → SourceStatus 的業務規則
 * 純函數實現，不依賴任何 UI 元件或 Vue 響應式特性
 */

export interface OptionItem {
  value: string;
  label: string;
}

export interface TypeConfig {
  subType?: OptionItem[];
  source?: OptionItem[];
  sourceStatus?: OptionItem[];
  /** 根據 subType 提供不同的 source（可選） */
  subTypeSourceMap?: Record<string, OptionItem[]>;
}

export interface UseCashRecordSearchRulesParams {
  authLevel: number;
  gameSourceList: OptionItem[];
  /**
   * 網站列表（用於 Transfer 的 source，當 authLevel <= 2 時）
   */
  websiteList?: string[];
  t: (key: string) => string;
}

/**
 * 建立類型配置映射
 */
function buildTypeConfigMap(
  authLevel: number,
  gameSourceList: OptionItem[],
  websiteList: string[] = [],
  t: (key: string) => string,
): Record<string, TypeConfig> {
  const gameSourceOptions = gameSourceList;

  /** Transfer 的 source（根據用戶等級） */
  // 當 authLevel <= 2 時，Transfer 的 source 應該從 getAllWebsite API 獲取
  const transferSource: OptionItem[] = authLevel <= 2 && websiteList.length > 0
    ? websiteList.map(s => ({ value: s, label: s }))
    : [];

  return {
    Bet: {
      subType: ['General'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
      source: gameSourceOptions,
      sourceStatus: ['NormalGame', 'DoubleGame'].map(g => ({
        value: g,
        label: g,
      })),
    },
    Win: {
      subType: ['General', 'ForceSettle', 'Award'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
      source: gameSourceOptions,
      sourceStatus: ['NormalGame', 'FreeGame', 'DoubleGame', 'JackpotGame'].map(s => ({
        value: s,
        label: s,
      })),
    },
    Transfer: {
      subType: ['KeyIn', 'KeyOut'].map(s => ({
        value: s,
        label: s,
      })),
      source: transferSource,
    },
    Promote: {
      subType: ['Award', 'General', 'Activity'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
      source: gameSourceOptions,
      sourceStatus: ['LobbyGame', 'NormalGame', 'FreeGame', 'DoubleGame', 'JackpotGame'].map(s => ({
        value: s,
        label: s,
      })),
    },
    Mission: {
      subType: ['Reward', 'Mission'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    MailAttachment: {
      subType: ['Transaction'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    RedemptionCode: {
      subType: ['Redeem'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    Transaction: {
      subType: ['Withhold', 'ServiceFee', 'Recover', 'Receive'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    DailyRewardPass: {
      subType: ['Reward', 'Deduct'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    SafetyBox: {
      subType: ['Withdrawal', 'Deposit', 'ServiceFee'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    singleWallet: {
      subType: ['gameBet', 'gamePlay', 'gameWin'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    Purchase: {
      subType: ['FreeBalance'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    Manual: {
      subType: ['add', 'sub'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    GameWinLose: {
      subType: ['GamePlay', 'BuyGift'].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
    Bonus: {
      subType: [
        'Activity',
        'Mail',
        'DailySignIn',
        'NoviceMission',
        'DailyMission',
        'GuildMission',
        'ContinuousDailyMission',
        'ContinuousWeeklyMission',
        'Other',
      ].map((subType) => {
        const i18nKey = subType === 'Activity' ? 'BonusActivity' : subType;
        return {
          value: subType,
          label: t(`record.subTypes.${i18nKey}`) || subType,
        };
      }),
    },
    ServiceFee: {
      subType: [
        'CreateGuildServiceFee',
        'RefundGuildServiceFee',
        'TransactionServiceFee',
        'SafetyBoxServiceFee',
      ].map(subType => ({
        value: subType,
        label: t(`record.subTypes.${subType}`) || subType,
      })),
    },
  };
}

/**
 * 建立類型選項列表
 */
function buildTypeOptions(t: (key: string) => string): OptionItem[] {
  const types = [
    'Bet',
    'Win',
    'Transfer',
    'Promote',
    'Mission',
    'MailAttachment',
    'RedemptionCode',
    'Transaction',
    'DailyRewardPass',
    'SafetyBox',
    'singleWallet',
    'Purchase',
    'Manual',
    'GameWinLose',
    'Bonus',
    'ServiceFee',
  ];

  return types.map(type => ({
    label: t(`record.types.${type}`) || type,
    value: type,
  }));
}

/**
 * CashRecord 搜尋規則 Composable
 */
export function useCashRecordSearchRules(params: UseCashRecordSearchRulesParams) {
  const { authLevel, gameSourceList, websiteList = [], t } = params;

  // 建立配置映射（每次調用時重新計算，確保資料最新）
  const typeConfigMap = buildTypeConfigMap(authLevel, gameSourceList, websiteList, t);
  const typeOptions = buildTypeOptions(t);

  /**
   * 獲取類型選項列表
   */
  function getTypeOptions(): OptionItem[] {
    return typeOptions;
  }

  /**
   * 獲取子類型選項列表
   * @param type 類型
   */
  function getSubTypeOptions(type?: string): OptionItem[] {
    if (!type || !typeConfigMap[type]) {
      return [];
    }
    return typeConfigMap[type].subType || [];
  }

  /**
   * 獲取來源選項列表
   * @param type 類型
   * @param subType 子類型（可選）
   */
  function getSourceOptions(type?: string, subType?: string): OptionItem[] {
    if (!type || !typeConfigMap[type]) {
      return [];
    }

    const config = typeConfigMap[type];

    // 如果該 subType 有專屬的 source 列表，使用它
    if (subType && config.subTypeSourceMap && config.subTypeSourceMap[subType]) {
      return config.subTypeSourceMap[subType];
    }

    // 否則使用通用的 source 列表
    return config.source || [];
  }

  /**
   * 獲取來源狀態選項列表
   * @param type 類型
   */
  function getSourceStatusOptions(type?: string): OptionItem[] {
    if (!type || !typeConfigMap[type]) {
      return [];
    }
    return typeConfigMap[type].sourceStatus || [];
  }

  /**
   * 檢查指定類型是否有 source 選項
   * @param type 類型
   */
  function hasSource(type?: string): boolean {
    if (!type || !typeConfigMap[type]) {
      return false;
    }
    const sourceOptions = getSourceOptions(type);
    return sourceOptions.length > 0;
  }

  /**
   * 檢查指定類型是否有 sourceStatus 選項
   * @param type 類型
   */
  function hasSourceStatus(type?: string): boolean {
    if (!type || !typeConfigMap[type]) {
      return false;
    }
    const sourceStatusOptions = getSourceStatusOptions(type);
    return sourceStatusOptions.length > 0;
  }

  return {
    getTypeOptions,
    getSubTypeOptions,
    getSourceOptions,
    getSourceStatusOptions,
    hasSource,
    hasSourceStatus,
  };
}
