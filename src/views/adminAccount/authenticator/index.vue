<script setup lang="tsx">
/**
 * 【Page Context Declaration｜頁面與站長 Context 關係】
 *
 * 頁面類型：C（Context Ignorer）
 * - 定義：本頁不需要站長參數，也不依賴站長
 * - 行為：站長僅 UI 顯示，不參與本頁任何查詢/狀態
 * - API payload 需帶入 masterAgent：否
 * - 來源：既有系統值（userStore.masterAgent），僅用於前端過濾邏輯
 * - 切換站長不觸發本頁 reload：是
 *
 * 約束：
 * - 不得修改 Layout / Breadcrumb / Context Provider
 * - 不得使用 MutationObserver 或任何 DOM 監聽方式追蹤 Breadcrumb
 * - 不得新增 watch / computed 來追蹤站長切換
 */
import type { TableColumnItem, TableListItem } from './columns';
import type { LoadDataParams } from '@/components/core/dynamic-table';
import { message, Modal, Tag } from 'ant-design-vue';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import AuthenticatorApi from '@/api/backend/adminAccount/authenticator';
import { useTable } from '@/components/core/dynamic-table';
import { useUserStore } from '@/store/modules/user';
import { useTableConfig } from '../masterAgent/useTableConfig';
import { baseColumns } from './columns';

defineOptions({ name: 'AdminAccountAuthenticator' });

// SearchMode 定義
type SearchMode = 'FRONTEND' | 'HYBRID' | 'BACKEND';

const userStore = useUserStore();
const saving = ref(false);

const [DynamicTable, tableInstance] = useTable({
  search: true,
});

const list = ref<TableListItem[]>([]);
const changes = reactive(new Map<number, { id: number; account: string; authenticator: boolean }>());

const authLevel = computed(() => Number(userStore.level ?? -1));
const canEditAuthenticator = computed(() => authLevel.value <= 2);
const canSave = computed(() => canEditAuthenticator.value && changes.size > 0);

const toBase32 = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
};

const generateBackendKey = () => {
  const bytes = window.crypto.getRandomValues(new Uint8Array(20));
  return toBase32(bytes);
};

const buildOtpauth = (account: string, backendKey: string) => {
  // Vue2：otpauth://totp/${account}?secret=${backendKey}
  return `otpauth://totp/${encodeURIComponent(account)}?secret=${encodeURIComponent(backendKey)}`;
};

const buildQrUrl = (otpauth: string) => {
  // Vue2：api.qrserver.com
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpauth)}&size=150x150`;
};

const resolveUserId = (all: any[]) => {
  const level = authLevel.value;
  const account = String(userStore.account ?? '');
  const masterAgent = String(userStore.masterAgent ?? '');
  const targetAccount = level === 4 ? `${account}.${masterAgent}` : account;
  const found = all.find((i: any) => String(i?.account ?? '') === targetAccount);
  return found?.id ? String(found.id) : '';
};

const canInListByLevel = (item: any, userId: string) => {
  const level = authLevel.value;
  const itemLevel = Number(item?.hierarchyLevel ?? item?.hierarchyLevel?.toString?.() ?? -1);

  switch (level) {
    case 1:
      return true;
    case 2:
      return itemLevel >= 2;
    case 3:
      return itemLevel >= 3 && String(item?.masterAgent ?? '') === String(userStore.masterAgent ?? '');
    case 4:
      return String(item?.id ?? '') === userId;
    default:
      return false;
  }
};

const computeCanReset = (item: any) => {
  const current = String(userStore.account ?? '');
  const target = String(item?.account ?? '');
  if (current !== 'admin' && target === 'admin') {
    return false;
  }
  if (current !== 'admin' && current !== 'cg' && target === 'cg') {
    return false;
  }
  return true;
};

const normalize = (raw: any[]): TableListItem[] => {
  const all = Array.isArray(raw) ? raw : [];
  const userId = resolveUserId(all);

  const re: TableListItem[] = [];
  for (const item of all) {
    // Vue2：if (getAuthLevel <= item.hierarchyLevel) ... 再做 canInList
    if (authLevel.value > Number(item?.hierarchyLevel ?? 999)) {
      continue;
    }
    if (!canInListByLevel(item, userId)) {
      continue;
    }

    const account = String(item?.account ?? '');
    const backendKey = item?.backendKey ? String(item.backendKey) : '';
    const authenticator = Boolean(item?.authenticator ?? item?.Authenticator ?? false);
    const otpauth = backendKey ? buildOtpauth(account, backendKey) : '';

    re.push({
      id: Number(item?.id),
      account,
      backendKey: backendKey || undefined,
      authenticator,
      originalAuthenticator: authenticator,
      hierarchyLevel: Number(item?.hierarchyLevel),
      masterAgent: String(item?.masterAgent ?? ''),
      canReset: computeCanReset(item),
      otpauth: otpauth || undefined,
      qrcodeUrl: otpauth ? buildQrUrl(otpauth) : undefined,
    });
  }

  return re;
};

/**
 * 處理表單提交（查詢按鈕）
 * 強制重新載入表格資料（不使用快取）
 */
const handleFormSubmit = () => {
  tableInstance?.reload(true);
};

const loadTableData = async (_params: LoadDataParams) => {
  try {
    const raw = await AuthenticatorApi.getAllAccount();
    const allItems = normalize(raw as any);

    // 獲取搜尋表單的值
    const searchFormRef = tableInstance?.getSearchFormRef?.();
    const formValues = searchFormRef?.getFieldsValue?.() || {};

    // 應用搜尋過濾
    let filtered = allItems;

    // 帳號搜尋
    if (formValues.account) {
      const accountKeyword = String(formValues.account).toLowerCase();
      filtered = filtered.filter(item =>
        item.account.toLowerCase().includes(accountKeyword),
      );
    }

    // 層級篩選
    if (formValues.hierarchyLevel) {
      const level = Number(formValues.hierarchyLevel);
      filtered = filtered.filter(item => Number(item.hierarchyLevel) === level);
    }

    list.value = filtered;
    changes.clear();

    return {
      items: filtered,
      meta: { totalItems: filtered.length },
    };
  }
  catch (e) {
    console.error(e);
    message.error('載入失敗');
    return { items: [], meta: { totalItems: 0 } };
  }
};

const onToggleAuthenticator = (record: TableListItem, checked: boolean) => {
  record.authenticator = Boolean(checked);
  if (record.authenticator === record.originalAuthenticator) {
    changes.delete(record.id);
  }
  else {
    changes.set(record.id, { id: record.id, account: record.account, authenticator: record.authenticator });
  }
};

const save = async () => {
  if (!canSave.value) {
    return;
  }
  saving.value = true;
  try {
    const settings = Array.from(changes.values()).map(i => ({
      id: i.id,
      account: i.account,
      authenticator: i.authenticator,
    }));
    await AuthenticatorApi.bulkUpdateBackendKeyAndAuthenticator({ settings });
    message.success('儲存成功');
    tableInstance?.reload();
  }
  catch (e) {
    console.error(e);
    message.error('儲存失敗');
  }
  finally {
    saving.value = false;
  }
};

const resetBackendKey = async (record: TableListItem) => {
  if (!record?.id || !record?.account) {
    return;
  }
  Modal.confirm({
    title: '重置 BackendKey',
    content: `確定要重置：${record.account}？`,
    okText: '確定',
    cancelText: '取消',
    async onOk() {
      const backendKey = generateBackendKey();
      await AuthenticatorApi.bulkUpdateBackendKeyAndAuthenticator({
        settings: [{ id: record.id, account: record.account, backendKey }],
      });
      message.success('重置成功');
      tableInstance?.reload();
    },
  });
};

const qrModalOpen = ref(false);
const qrModalTitle = ref('');
const qrModalUrl = ref('');
const qrModalOtplink = ref('');

const openQr = (record: TableListItem) => {
  qrModalTitle.value = record.account;
  qrModalUrl.value = record.qrcodeUrl || '';
  qrModalOtplink.value = record.otpauth || '';
  qrModalOpen.value = true;
};

const handleToggleAuthenticator = (record: TableListItem) => {
  const isEnabled = Boolean(record.authenticator);

  // 直接更新本地狀態，等待批量保存
  onToggleAuthenticator(record, !isEnabled);
};

// 定義所有欄位（包含狀態欄位和操作欄）
const baseColumnsWithAction = computed<TableColumnItem[]>(() => {
  return [
    ...baseColumns,
    {
      title: '啟用狀態',
      dataIndex: 'authenticator',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }) => (
        <Tag color={record.authenticator ? 'success' : 'error'}>
          {record.authenticator ? '啟用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'ACTION',
      width: 320, // 調寬操作欄位，避免按鈕換行
      align: 'center',
      fixed: 'right',
      hideInSearch: true,
      /**
       * 防止內容換行
       */
      customCell: () => {
        return {
          style: {
            whiteSpace: 'nowrap', // 禁止換行
          },
        };
      },
      actions: ({ record }) => {
        const actions: any[] = [];

        // 只有權限足夠時才顯示「啟用/停用」按鈕
        if (canEditAuthenticator.value) {
          const isEnabled = Boolean(record.authenticator);
          actions.push({
            label: isEnabled ? '停用' : '啟用',
            type: 'link',
            /** 停用按鈕使用 danger 樣式 */
            danger: isEnabled,
            onClick: () => handleToggleAuthenticator(record),
          });
        }

        // QRcode 按鈕
        actions.push({
          label: 'QRcode',
          type: 'link',
          disabled: !record.qrcodeUrl,
          onClick: () => openQr(record),
        });

        // 重置按鈕
        actions.push({
          label: '重置',
          type: 'link',
          danger: true,
          disabled: !record.canReset,
          popConfirm: {
            title: `確定要重置：${record.account}？`,
            onConfirm: () => resetBackendKey(record),
          },
        });

        return actions;
      },
    },
  ];
});

// 使用表格配置 Hook
const tableConfig = useTableConfig(baseColumnsWithAction);

// 類型 B：有搜尋區頁面 - 使用 computed 組合 scroll 對象
// 只傳入 scroll.x，不傳入 scroll.y，讓 useScroll 根據 autoHeight 自動計算 scroll.y
// useScroll 會在 autoHeight 啟用時自動計算並設置 scroll.y
const tableScroll = computed(() => {
  return {
    x: tableConfig.scrollX.value,
    // 不傳入 y，讓 useScroll 根據 autoHeight: true 自動計算
  };
});

// 根據 visibleColumnKeys 設置欄位的 hideInTable
// 同時確保 flexible 欄位有 minWidth，避免初始 render 時被壓縮為 0
const columns = computed<TableColumnItem[]>(() => {
  const visibleKeys = tableConfig.visibleColumnKeys.value;
  // Guard: 如果 visibleColumnKeys 尚未初始化完成（空或無效），不應用 hideInTable（維持全部顯示）
  // 僅在 visibleColumnKeys 為有效集合時才套用 hideInTable
  const hasValidVisibleKeys = Array.isArray(visibleKeys) && visibleKeys.length > 0;

  return baseColumnsWithAction.value.map((col) => {
    const key = (col.dataIndex as string) || (col.key as string) || '';

    // 如果欄位原本就設定 hideInTable: true（如 ID 欄位），保持隱藏
    if (col.hideInTable === true) {
      return col;
    }

    // 僅在 visibleColumnKeys 有效時才檢查可見性，否則預設顯示
    const isVisible = hasValidVisibleKeys ? visibleKeys.includes(key) : true;

    // 確保 flexible 欄位有 minWidth
    const processedCol: TableColumnItem = {
      ...col,
      hideInTable: !isVisible,
    };

    // 如果欄位是 flexible 但沒有設置 minWidth，設置預設值
    if (processedCol.flexible && !processedCol.minWidth) {
      processedCol.minWidth = 100; // 預設最小寬度 100px
    }

    // 對於 flexible 欄位，如果沒有設置 width，使用 minWidth 作為初始 width
    // 這樣可以避免初始 render 時被壓縮為 0
    if (processedCol.flexible && processedCol.minWidth && !processedCol.width) {
      processedCol.width = processedCol.minWidth;
    }

    return processedCol;
  });
});

// 監聽表格內部 columns 的變化，同步列設置組件的修改到 visibleColumnKeys
// 注意：列設置組件會直接修改傳入表格的 columns，我們需要監聽這個變化
watch(
  () => {
    // 嘗試從 tableInstance 獲取實際的 columns 狀態
    const innerProps = (tableInstance as any)?.innerPropsRef?.value;
    return innerProps?.columns;
  },
  (newColumns) => {
    if (!newColumns || !Array.isArray(newColumns)) {
      return;
    }

    // 根據新的 columns 狀態更新 visibleColumnKeys
    const newVisibleKeys: string[] = [];
    newColumns.forEach((col: TableColumnItem) => {
      const key = (col.dataIndex as string) || (col.key as string) || '';
      if (key && !col.hideInTable) {
        newVisibleKeys.push(key);
      }
    });

    // 只更新有變化的部分，避免循環更新
    const currentKeys = tableConfig.visibleColumnKeys.value;
    const keysChanged = newVisibleKeys.length !== currentKeys.length
      || newVisibleKeys.some(key => !currentKeys.includes(key))
      || currentKeys.some(key => !newVisibleKeys.includes(key));

    if (keysChanged) {
      tableConfig.updateVisibleColumns(newVisibleKeys);
    }
  },
  { deep: true },
);

// 計算 container 的 overflow-x 樣式
// container 預設 overflow-x 為 hidden，確保初始進入頁面時不會出現橫向 scrollbar
// 僅當 scroll.x !== '100%' 且為數字時，才允許 overflow-x: auto
const containerOverflowX = computed(() => {
  const scrollX = tableConfig.scrollX.value;

  // 當 scroll.x !== '100%' 且為數字時，允許橫向滾動
  // 原因：當 scroll.x 為數字時，表示表格內部有固定寬度欄位，且總和超過容器寬度
  // 此時表格內部會出現滾動條，外層 container 也需要允許滾動，以確保表格內容可以完整顯示
  // 使用 'auto' 而非 'scroll'，確保只有在內容超出時才顯示 scrollbar，且能在未滾動到底的情況下看到橫向 scrollbar
  if (scrollX !== '100%' && typeof scrollX === 'number') {
    return 'auto';
  }

  // scroll.x 為 '100%' 或 undefined 時，必須為 hidden
  // 原因：
  // - '100%': 表示有 flexible 欄位，表格會自動適應容器寬度，不需要外層滾動
  //           這樣可以確保初始進入頁面時，不論資料量多少，都不會出現橫向 scrollbar
  // - undefined: 表示沒有固定寬度欄位或固定寬度總和為 0，表格會自適應容器，不需要滾動
  //              這樣可以確保關閉欄位到 1~2 欄時，table 寬度會自適應容器
  return 'hidden';
});

/**
 * 計算 SearchMode（僅用於狀態顯示，不影響功能邏輯）
 * 根據當前實現：
 * - 先調用 API 獲取所有資料
 * - 然後在前端根據搜尋表單的值進行過濾
 * 因此為 FRONTEND 模式
 */
const searchMode = computed<SearchMode>(() => {
  return 'FRONTEND';
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

// 類型 B：有搜尋區頁面 - 在 mounted + nextTick 後再補上 scroll.y
// 使用雙重 nextTick 確保 DOM 完全渲染完成，然後啟用 autoHeight 計算 scroll.y
onMounted(async () => {
  // 使用雙重 nextTick 確保 DOM 完全渲染完成
  await nextTick();
  await nextTick();
  // 額外延遲一小段時間，確保容器高度計算完成
  setTimeout(() => {
    // 啟用 autoHeight，讓 DynamicTable 自動計算 scroll.y
    // 這裡設置為 true，useScroll hook 會自動計算並更新 scrollY
    // 但由於我們使用 computed 控制 scroll.y，需要通過 autoHeight 觸發計算
    // 實際上，我們只需要確保在高度穩定後，讓表格知道需要計算 scroll.y
    // 通過設置 scrollY 為 undefined，然後讓 autoHeight 自動計算
    // 但更好的方式是直接使用 autoHeight prop，讓它自動管理
    // 由於我們已經在模板中設置了 :auto-height="true"，這裡只需要確保時機正確
  }, 100);
});
</script>

<template>
  <div class="agent-page">
    <div
      class="table-container"
      :style="{ overflowX: containerOverflowX }"
    >
      <DynamicTable
        row-key="id"
        :data-request="loadTableData"
        :columns="columns"
        :scroll="tableScroll"
        :auto-height="true"
        :form-props="{
          showSubmitButton: true,
          showResetButton: true,
          showAdvancedButton: true,
          submitOnReset: false,
        }"
        bordered
        @search="handleFormSubmit"
      >
        <template #headerTitle>
          <div style="display: flex; align-items: center; gap: 8px">
            <span>Authenticator 管理</span>
            <Tag :color="searchModeConfig.color" style="margin: 0">
              SearchMode: {{ searchMode }} ({{ searchModeConfig.text }})
            </Tag>
          </div>
        </template>
        <template #toolbar>
          <a-button type="primary" :disabled="!canSave" :loading="saving" @click="save">
            儲存
          </a-button>
        </template>
      </DynamicTable>
    </div>

    <a-modal v-model:open="qrModalOpen" title="QRcode" :footer="null" :destroy-on-close="true">
      <div style="text-align: center">
        <div style="margin-bottom: 12px; font-weight: 600">
          {{ qrModalTitle }}
        </div>
        <img v-if="qrModalUrl" :src="qrModalUrl" alt="qrcode">
        <div v-if="qrModalOtplink" style="margin-top: 12px; word-break: break-all; color: #666">
          {{ qrModalOtplink }}
        </div>
      </div>
    </a-modal>
  </div>
</template>
