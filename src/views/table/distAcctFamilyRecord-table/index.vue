<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { GameInfo } from '@/api/backend/adminSystem/gameManagerServer';
import type { StationMasterItem } from '@/api/backend/agentHubManager';
import type { TableColumn } from '@/components/core/dynamic-table';

import { PrinterOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import { gameList as fetchGameList } from '@/api/backend/adminSystem/gameManagerServer';
import { getStationMasters, queryStationMaster, queryAgent } from '@/api/backend/agentHubManager';
import { financialSystemGetData } from '@/api/backend/financialSystem';
import { useTable } from '@/components/core/dynamic-table';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'DistAcctFamilyRecordTable',
});

const { t } = useI18n('page.distAcctFamilyRecord');
const userStore = useUserStore();

const permissionsLevel = 4;

/**
 * ============ 工具函數 ============
 */
function formatNumber(value: number | string): string {
  if (value === null || value === undefined) {
    return '0';
  }
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return '0';
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(date: Date | string): string {
  if (!date) {
    return '';
  }
  const d = new Date(date);
  return `${d.getFullYear()}年${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}月${d.getDate().toString().padStart(2, '0')}日`;
}

function formatDate2(date: Date | string): string {
  if (!date) {
    return '';
  }
  const d = new Date(date);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} `
    + `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

// ============ 查詢條件 ============
interface QueryState {
  date: [Dayjs, Dayjs];
}

const queryForm = ref<QueryState>({
  date: [
    dayjs().startOf('day'),
    dayjs().endOf('day'),
  ],
});

// ============ 站台和家族列表 ============
const stationList = ref<StationMasterItem[]>([]);
const station = ref<string>('');
const familyList = ref<StationMasterItem[]>([]);
const family = ref<string>('');

// ============ 報表資料 ============
const isDialog = ref(false);
const reportType1Data = ref<any[]>([]);
const type1Total = ref<number>(0);
const reportType2Data = ref<any[]>([]);
const type2Total = ref<number>(0);
const reportType3Data = ref<any[]>([]);
const type3Total = ref<number>(0);
const reportType4Data = ref<any[]>([]);
const type4Total = ref<number>(0);
const reportType5Data = ref<any[]>([]);
const type5Total = ref<number>(0);
const reportType6Data = ref<any[]>([]);
const type6Total = ref<number>(0);
const billPrintDate = ref<string>('');
const tableTitle = ref<string>('');
const tableTitle2 = ref<string>('');
const gameNameList = ref<Record<string, string>>({});

interface FamilyRowData extends StationMasterItem {
  pk?: string;
}

/**
 * ============ 事件處理 ============
 */
const dataInPage = (data: any[]) => {
  reportType1Data.value = [];
  type1Total.value = 0;
  reportType2Data.value = [];
  type2Total.value = 0;
  reportType3Data.value = [];
  type3Total.value = 0;
  reportType4Data.value = [];
  type4Total.value = 0;
  reportType5Data.value = [];
  type5Total.value = 0;
  reportType6Data.value = [];
  type6Total.value = 0;

  data.forEach((item: any) => {
    const one: any = {
      ...item,
      createdAt: formatDate2(item.createdAt),
      updatedAt: formatDate2(item.updatedAt),
    };

    switch (item.type) {
      case 'GameWinLose':
        if (gameNameList.value[one.sourceStatus]) {
          one.sourceStatus = gameNameList.value[one.sourceStatus];
        }
        reportType4Data.value.push(one);
        type4Total.value += Number.parseFloat(one.agentAmount || 0);
        break;
      case 'Purchase':
        reportType2Data.value.push(one);
        type2Total.value += Number.parseFloat(one.agentAmount || 0);
        break;
      case 'Bonus':
        one.agentAmount = (Number.parseFloat(one.agentAmount || 0) * -1).toString().replace(/^-0$/, '0');
        one.masterAgentAmount = (Number.parseFloat(one.masterAgentAmount || 0) * -1).toString().replace(/^-0$/, '0');
        reportType5Data.value.push(one);
        type5Total.value += Number.parseFloat(one.agentAmount || 0);
        break;
      case 'Transfer':
        break;
      case 'ServiceFee':
        reportType6Data.value.push(one);
        type6Total.value += Number.parseFloat(one.agentAmount || 0);
        break;
      case 'PurchaseServiceCost':
      case 'SMSServiceCost':
      case 'PlatformMonthlyFee':
        one.agentAmount = (Number.parseFloat(one.agentAmount || 0) * -1).toString().replace(/^-0$/, '0');
        one.masterAgentAmount = (Number.parseFloat(one.masterAgentAmount || 0) * -1).toString().replace(/^-0$/, '0');
        reportType1Data.value.push(one);
        type1Total.value += Number.parseFloat(one.agentAmount || 0);
        break;
    }
  });
};

const getDataList = async (type: 'Payable' | 'Receivable') => {
  tableTitle.value = t(`label.${type}`) || type;
  tableTitle2.value = t(`label.${type}2`) || type;
  const postData = {
    startSearchTime: queryForm.value.date[0].toDate(),
    endSearchTime: queryForm.value.date[1].toDate(),
    level: 'masterAgent',
    to: 'agent',
    masterAgent: station.value,
    agent: family.value,
  };
  billPrintDate.value = `${formatDate(queryForm.value.date[0].toDate())} ~ ${formatDate(queryForm.value.date[1].toDate())}`;

  // 先打開視窗，無論是否有資料都要顯示
  isDialog.value = true;

  try {
    const res = await financialSystemGetData(postData);
    const items = (res as any)?.items;

    if (Array.isArray(items)) {
      dataInPage(items);
    }
    else {
      dataInPage([]);
    }
  }
  catch (error) {
    console.error('[getDataList] Failed to get data list:', error);
    dataInPage([]);
  }
};

const getGameList = async () => {
  gameNameList.value = {};
  try {
    const res = await fetchGameList({ masterAgent: station.value });
    if (res) {
      res.forEach((item: GameInfo) => {
        gameNameList.value[item.gameID] = item.gameName || '';
        if (item.language && item.language.tw) {
          gameNameList.value[item.gameID] = item.language.tw;
        }
      });
    }
  }
  catch (error) {
    console.error('[getGameList] Failed to get game list:', error);
  }
};

const onEditBtnHandler = async (data: StationMasterItem, type: 'Payable' | 'Receivable') => {
  if (!data || !data.name) {
    console.error('[onEditBtnHandler] invalid data', data);
    return;
  }
  family.value = data.name;
  await getGameList();
  await getDataList(type);
};

const changeStation = async () => {
  family.value = '';
  await getFamilyList();
};

// ============ 表格 ============
const [DynamicTable, dynamicTableInstance] = useTable({
  search: false,
  showActionColumn: true,
  actionColumn: {
    title: t('label.control') || '控制',
    width: 150,
    fixed: 'right',
    actions: ({ record }) => {
      return [
        {
          label: t('label.viewTable') || '查看報表',
          type: 'link',
          onClick: (params) => {
            const currentRecord = params?.record || record;
            if (currentRecord) {
              onEditBtnHandler(currentRecord as StationMasterItem, 'Payable');
            }
          },
        },
      ];
    },
  },
});

const closeDialog = () => {
  isDialog.value = false;
};

const printBill = () => {
  const printElement = document.getElementById('printArea');
  if (!printElement) {
    console.error('printArea 元素未找到！');
    return;
  }
  const printContent = printElement.innerHTML;
  const printWindow = window.open('/printTemplate.html', 'PRINT');
  if (printWindow) {
    printWindow.onload = () => {
      const printArea = printWindow.document.getElementById('printArea');
      if (printArea) {
        printArea.innerHTML = printContent;
      }
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  }
};

const getStationList = async () => {
  stationList.value = [];
  station.value = '';

  if (userStore.level <= 2) {
    try {
      const response = await getStationMasters({});
      if (response && response.result === true && response.value) {
        response.value.forEach((item: StationMasterItem) => {
          if (station.value === '') {
            station.value = item.name || '';
          }
          stationList.value.push({
            ...item,
            value: item.name,
          });
        });
        await getFamilyList();
      }
    }
    catch (error) {
      console.error('Failed to get station list:', error);
    }
  }
  else {
    station.value = userStore.masterAgent || '';
    if (userStore.level >= 3) {
      family.value = userStore.account || '';
    }
    await getFamilyList();
  }

  // 確保表格重新加載數據
  if (dynamicTableInstance) {
    await dynamicTableInstance.reload?.(true);
  }
};

const getFamilyList = async () => {
  familyList.value = [];
  if (userStore.level <= 3) {
    if (!station.value) {
      return;
    }
    try {
      const postData = {
        name: station.value,
      };
      const response = await queryStationMaster(postData);
      if (response && response.result && response.value) {
        const agents = (response.value as any).agents || [];
        agents.forEach((item: any) => {
          familyList.value.push({
            ...item,
            name: item.name,
            value: item.name,
            pk: item.name || `family-${item.id || Math.random()}`,
          });
        });
      }
    }
    catch (error) {
      console.error('Failed to get family list:', error);
    }
  }
  else {
    if (!station.value || !family.value) {
      return;
    }
    try {
      const postData = {
        stationMasterName: station.value,
        name: family.value,
      };
      const response = await queryAgent(postData);
      if (response && response.result && response.value) {
        familyList.value.push({
          ...response.value,
          name: response.value.name,
          value: response.value.name,
          pk: response.value.name || `family-${response.value.id || Math.random()}`,
        });
      }
    }
    catch (error) {
      console.error('Failed to query agent:', error);
    }
  }

  // 確保表格重新加載數據
  if (dynamicTableInstance) {
    await dynamicTableInstance.reload?.(true);
  }
};

const loadTableData = async () => {
  // 確保數據已加載
  if (familyList.value.length === 0) {
    await getFamilyList();
  }

  const items = familyList.value.map(item => ({
    ...item,
    pk: item.pk || item.name || `family-${item.id || Math.random()}`,
  }));

  return {
    items,
    meta: {
      totalItems: familyList.value.length,
    },
  };
};

const columns = ref<TableColumn<FamilyRowData>[]>([
  {
    title: t('label.family') || '家族',
    dataIndex: 'name',
    width: 200,
  },
]);

// ============ 初始化 ============
onMounted(async () => {
  await getStationList();
});
</script>

<template>
  <div class="app-container dist-acct-family-record-table">
    <div v-if="userStore.level <= permissionsLevel" class="app-container">
      <div class="filter-container">
        <div v-if="userStore.level < 3" class="wrap">
          <div class="input_group">
            <div class="txt">
              <label style="color: #ff4949">{{ t('label.station') || '站台' }}</label>
            </div>
            <a-select
              v-model:value="station"
              style="width: 200px"
              :disabled="false"
              @change="changeStation"
            >
              <a-select-option
                v-for="item in stationList"
                :key="item.value || item.name"
                :value="item.name"
              >
                {{ item.name }}
              </a-select-option>
            </a-select>
          </div>
        </div>

        <div v-if="userStore.level < 4" class="wrap">
          <div class="input_group">
            <div class="txt">
              <label style="color: #ff4949">{{ t('label.dateRange') || '日期範圍' }}</label>
            </div>
            <div class="my_jcCenter">
              <a-range-picker
                v-model:value="queryForm.date"
                show-time
                format="YYYY-MM-DD HH:mm:ss"
                style="width: 400px"
                :placeholder="['開始時間', '結束時間']"
              />
            </div>
          </div>
        </div>
      </div>

      <DynamicTable
        row-key="pk"
        :columns="columns"
        :data-request="loadTableData"
        :show-action-column="true"
        :scroll="{ x: 'max-content' }"
      />

      <a-modal
        v-model:open="isDialog"
        :title="t('dialog.title') || '家族報表查詢'"
        :width="1200"
        :footer="null"
        @cancel="closeDialog"
      >
        <div class="dialog-header" />
        <div id="printArea" class="bill-container">
          <div class="bill-section">
            <h2 class="bill-header">
              <span>{{ t('label.target') || '對象' }}：{{ family }}</span>
              <span class="">
                {{ t('label.amount') || '款項' }}：{{ formatNumber(type1Total) }}{{ t('label.currency') || '元' }} / {{ formatNumber((type2Total + type3Total + type4Total) + (type5Total + type6Total)) }}{{ t('label.points') || '點數' }}
              </span>
            </h2>
            <p>{{ t('dialog.description') || '此帳單為' }} {{ billPrintDate }} {{ t('dialog.description2') || '的對帳報表，請確認內容無誤。' }}</p>
          </div>

          <div class="bill-section">
            <h3>{{ t('table.accountDetails') || '帳務明細' }}</h3>

            <!-- 基礎費用 -->
            <div v-if="reportType1Data.length > 0" class="bill-table">
              <h4>{{ t('table.BasicFee') || '基礎費用' }}</h4>
              <div class="row header">
                <div class="cell center-align" style="min-width: 140px">
                  {{ t('table.timeRange') || '時間區間' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.item') || '項目' }}
                </div>
                <div class="cell center-align" style="width: 25%">
                  {{ t('table.detail') || '細項' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.fee') || '費用' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.commissionRate') || '抽成比例' }}
                </div>
                <div class="cell center-align">
                  {{ tableTitle2 }}
                </div>
              </div>
              <div v-for="item in reportType1Data" :key="item.id" class="row">
                <div class="cell center-align" style="min-width: 140px">
                  {{ item.createdAt }} <br> {{ item.updatedAt }}
                </div>
                <div class="cell">
                  {{ t(`subType.${item.subType}`) || item.subType }}
                </div>
                <div class="cell" style="width: 25%">
                  {{ item.sourceStatus }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.masterAgentAmount) }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber((item.agentRate || 0) * 100) }}%
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.agentAmount) }}
                </div>
              </div>

              <div class="statistics">
                <div class="label">
                  {{ t('table.total') || '總計' }}：
                </div>
                <div id="type1TotalAmount" class="value">
                  {{ formatNumber(type1Total) }}
                </div>
              </div>
            </div>

            <!-- 金流費用 -->
            <div v-if="reportType2Data.length > 0" class="bill-table">
              <h4>{{ t('table.PaymentServiceCost') || '金流費用' }}</h4>
              <div class="row header">
                <div class="cell center-align" style="min-width: 140px">
                  {{ t('table.timeRange') || '時間區間' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.item') || '項目' }}
                </div>
                <div class="cell center-align" style="width: 25%">
                  {{ t('table.detail') || '細項' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.totalDeposit') || '總儲值額' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.commissionRate') || '抽成比例' }}
                </div>
                <div class="cell center-align">
                  {{ tableTitle }}
                </div>
              </div>
              <div v-for="item in reportType2Data" :key="item.id" class="row">
                <div class="cell center-align" style="min-width: 140px">
                  {{ item.createdAt }} <br> {{ item.updatedAt }}
                </div>
                <div class="cell">
                  {{ t(`subType.${item.subType}`) || item.subType }}
                </div>
                <div class="cell" style="width: 25%">
                  {{ item.sourceStatus }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.masterAgentAmount) }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber((item.agentRate || 0) * 100) }}%
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.agentAmount) }}
                </div>
              </div>

              <div class="statistics">
                <div class="label">
                  {{ t('table.total') || '總計' }}：
                </div>
                <div id="type2TotalAmount" class="value">
                  {{ formatNumber(type2Total) }}
                </div>
              </div>
            </div>

            <!-- 金流手續費 -->
            <div v-if="reportType3Data.length > 0" class="bill-table">
              <h4>{{ t('table.PurchaseServiceCost') || '金流手續費' }}</h4>
              <div class="row header">
                <div class="cell center-align" style="min-width: 140px">
                  {{ t('table.timeRange') || '時間區間' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.item') || '項目' }}
                </div>
                <div class="cell center-align" style="width: 25%">
                  {{ t('table.detail') || '細項' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.totalAmount') || '總額' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.commissionRate') || '抽成比例' }}
                </div>
                <div class="cell center-align">
                  {{ tableTitle }}
                </div>
              </div>
              <div v-for="item in reportType3Data" :key="item.id" class="row">
                <div class="cell center-align" style="min-width: 140px">
                  {{ item.createdAt }} <br> {{ item.updatedAt }}
                </div>
                <div class="cell">
                  {{ t(`subType.${item.subType}`) || item.subType }}
                </div>
                <div class="cell" style="width: 25%">
                  {{ item.sourceStatus }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.masterAgentAmount) }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber((item.agentRate || 0) * 100) }}%
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.agentAmount) }}
                </div>
              </div>

              <div class="statistics">
                <div class="label">
                  {{ t('table.total') || '總計' }}：
                </div>
                <div id="type3TotalAmount" class="value">
                  {{ formatNumber(type3Total) }}
                </div>
              </div>
            </div>

            <!-- 遊戲輸贏 -->
            <div v-if="reportType4Data.length > 0" class="bill-table">
              <h4>{{ t('table.GameWinLose') || '遊戲輸贏' }}</h4>
              <div class="row header">
                <div class="cell center-align" style="min-width: 140px">
                  {{ t('table.timeRange') || '時間區間' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.item') || '項目' }}
                </div>
                <div class="cell center-align" style="width: 25%">
                  {{ t('table.detail') || '細項' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.totalAmount') || '總額' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.commissionRate') || '抽成比例' }}
                </div>
                <div class="cell center-align">
                  {{ tableTitle }}
                </div>
              </div>
              <div v-for="item in reportType4Data" :key="item.id" class="row">
                <div class="cell center-align" style="min-width: 140px">
                  {{ item.createdAt }} <br> {{ item.updatedAt }}
                </div>
                <div class="cell">
                  {{ t(`subType.${item.subType}`) || item.subType }}
                </div>
                <div class="cell" style="width: 25%">
                  {{ item.sourceStatus }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.masterAgentAmount) }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber((item.agentRate || 0) * 100) }}%
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.agentAmount) }}
                </div>
              </div>

              <div class="statistics">
                <div class="label">
                  {{ t('table.total') || '總計' }}：
                </div>
                <div id="type4TotalAmount" class="value">
                  {{ formatNumber(type4Total) }}
                </div>
              </div>
            </div>

            <!-- 紅利 -->
            <div v-if="reportType5Data.length > 0" class="bill-table">
              <h4>{{ t('table.Bonus') || '紅利' }}</h4>
              <div class="row header">
                <div class="cell center-align" style="min-width: 140px">
                  {{ t('table.timeRange') || '時間區間' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.item') || '項目' }}
                </div>
                <div class="cell center-align" style="width: 25%">
                  {{ t('table.detail') || '細項' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.totalBonus') || '總贈額' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.commissionRate') || '抽成比例' }}
                </div>
                <div class="cell center-align">
                  {{ tableTitle2 }}
                </div>
              </div>
              <div v-for="item in reportType5Data" :key="item.id" class="row">
                <div class="cell center-align" style="min-width: 140px">
                  {{ item.createdAt }} <br> {{ item.updatedAt }}
                </div>
                <div class="cell">
                  {{ t(`subType.${item.subType}`) || item.subType }}
                </div>
                <div class="cell" style="width: 25%">
                  {{ item.sourceStatus }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.masterAgentAmount) }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber((item.agentRate || 0) * 100) }}%
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.agentAmount) }}
                </div>
              </div>

              <div class="statistics">
                <div class="label">
                  {{ t('table.total') || '總計' }}：
                </div>
                <div id="type5TotalAmount" class="value">
                  {{ formatNumber(type5Total) }}
                </div>
              </div>
            </div>

            <!-- 手續費 -->
            <div v-if="reportType6Data.length > 0" class="bill-table">
              <h4>{{ t('table.ServiceFee') || '手續費' }}</h4>
              <div class="row header">
                <div class="cell center-align" style="min-width: 140px">
                  {{ t('table.timeRange') || '時間區間' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.item') || '項目' }}
                </div>
                <div class="cell center-align" style="width: 25%">
                  {{ t('table.detail') || '細項' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.totalAmount') || '總額' }}
                </div>
                <div class="cell center-align">
                  {{ t('table.commissionRate') || '抽成比例' }}
                </div>
                <div class="cell center-align">
                  {{ tableTitle2 }}
                </div>
              </div>
              <div v-for="item in reportType6Data" :key="item.id" class="row">
                <div class="cell center-align" style="min-width: 140px">
                  {{ item.createdAt }} <br> {{ item.updatedAt }}
                </div>
                <div class="cell">
                  {{ t(`subType.${item.subType}`) || item.subType }}
                </div>
                <div class="cell" style="width: 25%">
                  {{ item.sourceStatus }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.masterAgentAmount) }}
                </div>
                <div class="cell right-align">
                  {{ formatNumber((item.agentRate || 0) * 100) }}%
                </div>
                <div class="cell right-align">
                  {{ formatNumber(item.agentAmount) }}
                </div>
              </div>

              <div class="statistics">
                <div class="label">
                  {{ t('table.total') || '總計' }}：
                </div>
                <div id="type6TotalAmount" class="value">
                  {{ formatNumber(type6Total) }}
                </div>
              </div>
            </div>
          </div>

          <div class="bill-section" style="text-align: right;">
            <div class="bill-summary">
              <div class="summary-row">
                <span>{{ t('table.totalAmount') || '本帳單合計金額' }}：</span>
                <strong>{{ formatNumber(type1Total) }}</strong>
              </div>
              <div class="summary-row">
                <span>{{ t('table.totalPoints') || '本帳單合計點數' }}：</span>
                <strong>{{ formatNumber((type2Total + type3Total + type4Total) + (type5Total + type6Total)) }}</strong>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <a-button @click="closeDialog">
            {{ t('close') || '關閉' }}
          </a-button>
          <a-button type="primary" @click="printBill">
            <template #icon>
              <PrinterOutlined />
            </template>
            {{ t('print') || '列印' }}
          </a-button>
        </template>
      </a-modal>
    </div>
    <div v-else>
      <!-- 權限錯誤提示 -->
      <div style="text-align: center; padding: 50px;">
        <p>{{ t('error.noPermission') || '您沒有權限訪問此頁面' }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.dist-acct-family-record-table {
  .wrap {
    display: flex;
    flex-wrap: wrap;
    background-color: #e7e7e7;
    .input_group {
      display: flex;
      padding: 10px;
      .txt {
        width: 100px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .my_jcCenter {
        display: flex;
        align-items: center;
      }
    }
  }

  .bill-container {
    padding: 5px;
    background: #fff;
    width: 95%;
    max-height: 70vh;
    overflow-y: auto;
  }

  .bill-section {
    width: 100%;
    margin-bottom: 10px;
    padding: 10px;
    border: 2px solid #ccc;
  }

  .bill-table {
    width: 100%;
    margin-top: 5px;
    border: 1px solid #000;
    table-layout: fixed;
  }

  .row {
    display: flex;
  }

  .row.header {
    background: #ddd;
    font-weight: bold;
  }

  .cell {
    flex: 1;
    padding: 5px;
    border: 1px solid #000;
  }

  .cell.right-align {
    text-align: right;
  }

  .cell.center-align {
    text-align: center;
  }

  .statistics {
    display: flex;
    justify-content: flex-end;
    padding-top: 10px;
    font-weight: bold;
  }

  .statistics .label {
    width: 80%;
  }

  .statistics .value {
    width: 20%;
    text-align: right;
  }

  .bill-summary {
    width: 35%;
    margin-left: auto;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
  }

  .summary-row span {
    text-align: left;
    flex: 1;
  }

  .summary-row strong {
    text-align: right;
    flex: 1;
  }

  .bill-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .right-info {
    font-size: 16px;
    font-weight: normal;
    color: #666;
  }
}
</style>


