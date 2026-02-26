<script setup lang="ts">
import type { FuzzyQueryUserItem } from '@/api/backend/adminSystem/accountSystem';
import type { DefaultAvatarItem } from '@/api/backend/profileSystem';

import { message, Modal } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import { computed, inject, ref, watch } from 'vue';

import { changeNickname, checkNickname, fuzzyQueryUser } from '@/api/backend/adminSystem/accountSystem';
import { getDefaultAvatar, getUserProfile, updateUserProfile } from '@/api/backend/profileSystem';
import { useI18n } from '@/hooks/useI18n';
import { useUserStore } from '@/store/modules/user';
import { MASTER_AGENT_SELECT_KEY } from '@/views/adminAccount/agent/constants';

defineOptions({
  name: 'MemberNicknameAvatar',
});

const i18n = useI18n('routes.member.memberNicknameAvatarPage');
const t = i18n.t;

const userStore = useUserStore();
const hasPermission = computed(() => userStore.level <= 3);

// ===== Page Context: Context Reader (Type B) =====
// 依賴 Breadcrumb 站長，不自行切換站長
// 切換站長時，需自動 reset 頁面資料

// 從 Layout inject 站長選單狀態（與其他 member 頁面一致）
const masterAgentCtx = inject<{
  masterAgentOptions: { value: { label: string; value: string }[] };
  selectedMasterAgent: { value: string | undefined };
  canSelectMasterAgent: { value: boolean };
  contextVersion: { value: number };
  onMasterAgentChanged: (value: string) => void;
} | undefined>(MASTER_AGENT_SELECT_KEY);

// 使用 computed 取得當前選取的站長值
// 優先使用 Layout 提供的值，如果沒有則使用 userStore.masterAgent（Level 4 用戶）
const masterAgent = computed(() => {
  // 優先使用 Layout 提供的站長值
  if (masterAgentCtx?.selectedMasterAgent.value) {
    return String(masterAgentCtx.selectedMasterAgent.value || '').trim();
  }
  // Level 4 用戶：如果 Layout 沒有值，使用 userStore.masterAgent
  if (userStore.level === 4) {
    return String(userStore.masterAgent || '').trim();
  }
  return '';
});

// 使用 computed 取得 contextVersion
const contextVersion = computed(() => masterAgentCtx?.contextVersion.value ?? 0);

// ===== Member Search Logic =====

interface MemberOption {
  label: string;
  value: string;
  raw?: FuzzyQueryUserItem;
}

const memberLoading = ref(false);
const memberOptions = ref<MemberOption[]>([]);
const memberLastQueryText = ref('');
const memberLastAccountID = ref('');
const memberPageSize = 20;

const mapMemberOptions = (list: FuzzyQueryUserItem[]) =>
  (list || []).map((item) => {
    const value = `${item.account}@${item.agentID}`;
    return {
      raw: item,
      value,
      label: `${item.accountID} - ${item.nickName}`,
    };
  });

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
    const list = Array.isArray(res) ? res : [];
    const mapped = mapMemberOptions(list);
    memberOptions.value = append ? [...memberOptions.value, ...mapped] : mapped;
    memberLastAccountID.value = list.length > 0 ? list[list.length - 1].accountID : memberLastAccountID.value;
  }
  finally {
    memberLoading.value = false;
  }
};

const onMemberSearch = debounce((text: string) => fetchMemberOptions(text, false), 250);

const onMemberPopupScroll = async (e: UIEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }
  const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 20;
  if (!nearBottom) {
    return;
  }
  if (!memberLastQueryText.value || !memberLastAccountID.value) {
    return;
  }
  await fetchMemberOptions(memberLastQueryText.value, true);
};

const selectedMemberRaw = ref<FuzzyQueryUserItem | undefined>(undefined);

const onMemberChanged = (val: string) => {
  const matched = memberOptions.value.find(o => o.value === val);
  selectedMemberRaw.value = matched?.raw;
};

// ===== Page data =====

const loading = ref(false);
const hasSearched = ref(false);
const avatarSubmitting = ref(false);
const nicknameSubmitting = ref(false);

const cdnBaseUrl = import.meta.env.VITE_APP_CDN_BASE_URL || '';
const toCdnUrl = (url?: string) => {
  if (!url) {
    return '';
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return cdnBaseUrl ? `${cdnBaseUrl}${url}` : url;
};

const avatarList = ref<DefaultAvatarItem[]>([]);

const form = ref<{
  memberID: string;
  accountText: string;
  nickName: string;
  oriNickName: string;
  avatarUrl: string;
  avatarID: number | undefined;
  oriAvatarID: number | undefined;
}>({
  memberID: '',
  accountText: '',
  nickName: '',
  oriNickName: '',
  avatarUrl: '',
  avatarID: undefined,
  oriAvatarID: undefined,
});

// ===== Nickname Logic =====

const nicknameChecking = ref(false);
const nicknameError = ref('');

const resetAll = () => {
  form.value = {
    memberID: '',
    accountText: '',
    nickName: '',
    oriNickName: '',
    avatarUrl: '',
    avatarID: undefined,
    oriAvatarID: undefined,
  };
  avatarList.value = [];
  selectedMemberRaw.value = undefined;
  memberOptions.value = [];
  memberLastQueryText.value = '';
  memberLastAccountID.value = '';
  nicknameError.value = '';
  nicknameChecking.value = false;
  hasSearched.value = false;
};

// 監聽 contextVersion 變更，當站長切換時自動重置頁面資料
watch(
  () => contextVersion.value,
  () => {
    resetAll();
  },
);

// 對於 Level 4 用戶，同時監聽 userStore.masterAgent 變化
if (userStore.level === 4) {
  watch(
    () => userStore.masterAgent,
    () => {
      resetAll();
    },
  );
}

const checkStrlength = (value: string, limit: number) => {
  const Vietnam = Array.from(
    'ÁáÀàĂăẮắẰằẴẵẲẳÂâẤấẦầẪẫẨẩǍǎÅåǺǻÄäǞǟÃãȦȧǠǡĄąĀāẢảȀȁȂȃẠạẶặẬậḀḁȺⱥᶏḂḃḄḅḆḇɃƀᵬᶀƁɓƂƃĆćĈĉČčĊċÇçḈḉȻȼƇƈɕĎďḊḋḐḑḌḍḒḓḎḏĐđᵭᶁƉɖƊɗᶑƋƌȡÉéÈèĔĕÊêẾếỀềỄễỂểĚěËëẼẽĖėȨȩḜḝĘęĒēḖḗḔḕẺẻȄȅȆȇẸẹỆệḘḙḚḛɆɇᶒḞḟᵮᶂƑƒǴǵĞğĜĝǦǧĠġĢģḠḡǤǥᶃƓɠĤĥȞȟḦḧḢḣḨḩḤḥḪḫH̱ẖĦħⱧⱨÍíÌìĬĭÎîǏǐÏïḮḯĨĩİiĮįĪīỈỉȈȉȊȋỊịḬḭIıƗɨᵻᶖĴĵǰȷɈɉʝɟʄḰḱǨǩĶķḲḳḴḵᶄƘƙⱩⱪĹĺĽľĻļḶḷḸḹḼḽḺḻŁłĿŀȽƚⱠⱡⱢɫɬᶅɭȴḾḿṀṁṂṃᵯᶆɱM̄m̄ŃńǸǹŇňÑñṄṅŅņṆṇṊṋṈṉᵰƝɲȠƞᶇɳȵN̈n̈ÓóÒòŎŏÔôỐốỒồỖỗỔổǑǒÖöȪȫŐőÕõṌṍṎṏȬȭȮȯȰȱØøǾǿǪǫǬǭŌōṒṓṐṑỎỏòȌȍȎȏƠơỚớỜờỠỡỞởỢợỌọỘộƟɵṔṕṖṗⱣᵽᵱᶈƤƥP̃p̃ʠɊɋŔŕŘřṘṙŖŗȐȑȒȓṚṛṜṝṞṟɌɍᵲᶉɼⱤɽɾᵳŚśṤṥŜŝŠšṦṧṠṡẛŞşṢṣṨṩȘșᵴᶊʂȿS̩s̩ŤťT̈ẗṪṫŢţṬṭȚțṰṱṮṯŦŧȾⱦᵵƫƬƭƮʈȶÚúÙùŬŭÛûǓǔŮůÜüǗǘǛǜǙǚǕǖŰűŨũṸṹŲųŪūṺṻỦủȔȕȖȗƯưỨứỪừỮữỬửỰựỤụṲṳṶṷṴṵɄʉᵾᶙṼṽṾṿᶌƲʋⱴẂẃẀẁŴŵW̊ẘẄẅẆẇẈẉẌẍẊẋᶍÝýỲỳŶŷY̊ẙŸÿỸỹẎẏȲȳỶỷỴỵʏɎɏƳƴŹźẐẑŽžŻżẒẓẔẕƵƶᵶᶎȤȥʐʑɀⱫⱬ',
  );

  let checkLength = 0;
  if (value.length > limit * 2) {
    return false;
  }

  Array.from(value).forEach((oneStr) => {
    // eslint-disable-next-line no-control-regex
    if ((/[^\x00-\xFF]/g).test(oneStr)) {
      if (Vietnam.includes(oneStr)) {
        // 越南
        checkLength += 1;
      }
      else {
        // 中文
        checkLength += 2;
      }
    }
    else {
      // 英文
      checkLength += 1;
    }
  });
  return checkLength <= limit;
};

const doValidateNickname = async () => {
  nicknameError.value = '';

  if (!form.value.memberID) {
    return;
  }
  if (!form.value.nickName) {
    nicknameError.value = t('notify.nickName');
    return;
  }
  const limit = 16;
  if (!checkStrlength(form.value.nickName, limit)) {
    nicknameError.value = t('notify.nickNameTooLong', { limit1: '8', limit2: '16' });
    return;
  }
  if (form.value.nickName === form.value.oriNickName) {
    return;
  }
  if (!masterAgent.value) {
    return;
  }

  nicknameChecking.value = true;
  try {
    const res = await checkNickname({ masterAgent: masterAgent.value, nickname: form.value.nickName });
    if (!res?.result) {
      nicknameError.value = t('notify.nickNameExist');
    }
  }
  catch {
    // request 已統一 toast；此處只做保守 fallback
    nicknameError.value = t('notify.failed');
  }
  finally {
    nicknameChecking.value = false;
  }
};

const scheduleValidateNickname = debounce(doValidateNickname, 300);

watch(
  () => form.value.nickName,
  () => {
    scheduleValidateNickname();
  },
);

const canUpdateNickname = computed(() => {
  if (!form.value.memberID) {
    return false;
  }
  if (!form.value.nickName) {
    return false;
  }
  if (form.value.nickName === form.value.oriNickName) {
    return false;
  }
  if (nicknameChecking.value) {
    return false;
  }
  if (nicknameSubmitting.value) {
    return false;
  }
  if (nicknameError.value) {
    return false;
  }
  return true;
});

// ===== Avatar Logic =====

const avatarOptions = computed(() => {
  const ori = Number(form.value.oriAvatarID);
  return (avatarList.value || []).map((a) => {
    const id = Number(a.id);
    const label = id === ori ? `${id} (${t('avatar.original')})` : String(id);
    return { label, value: id };
  });
});

watch(
  () => form.value.avatarID,
  (newVal) => {
    const id = Number(newVal);
    const selected = (avatarList.value || []).find(a => Number(a.id) === id);
    if (selected) {
      form.value.avatarUrl = toCdnUrl(selected.profileUrl);
    }
  },
);

const canUpdateAvatar = computed(() => {
  if (!form.value.memberID) {
    return false;
  }
  if (avatarSubmitting.value) {
    return false;
  }
  if (form.value.avatarID === undefined || form.value.oriAvatarID === undefined) {
    return false;
  }
  return Number(form.value.avatarID) !== Number(form.value.oriAvatarID);
});

// ===== Actions =====

const search = async () => {
  if (!form.value.memberID) {
    message.error(t('notify.memberRequired'));
    return;
  }

  loading.value = true;
  try {
    // 先載入預設頭像列表（供選擇）
    const list = await getDefaultAvatar({ masterAgent: masterAgent.value, isEnabled: true });
    avatarList.value = (Array.isArray(list) ? list : []).map(a => ({ ...a, profileUrl: toCdnUrl(a.profileUrl) }));

    // 再載入會員目前頭像設定
    const profile = await getUserProfile({ memberID: form.value.memberID });
    const avatarID = profile?.avatarID === undefined ? undefined : Number(profile.avatarID);
    form.value.avatarID = avatarID;
    form.value.oriAvatarID = avatarID;
    form.value.avatarUrl = toCdnUrl(profile?.profilePictureUrl);

    // 會員基本顯示資訊（從 fuzzyQueryUser 取）
    const raw = selectedMemberRaw.value;
    const nick = String(raw?.nickName ?? '');
    const accountID = String(raw?.accountID ?? '');
    form.value.nickName = nick;
    form.value.oriNickName = nick;
    form.value.accountText = accountID ? `${accountID} - ${nick}` : '';

    nicknameError.value = '';
    await doValidateNickname();
    hasSearched.value = true;
  }
  finally {
    loading.value = false;
  }
};

const onUpdateNickname = async () => {
  if (!canUpdateNickname.value) {
    return;
  }

  Modal.confirm({
    title: t('buttons.updateNickName'),
    content: `${t('labels.nickName')}：${form.value.oriNickName} → ${form.value.nickName}`,
    okText: t('buttons.confirm'),
    cancelText: t('buttons.cancel'),
    async onOk() {
      nicknameSubmitting.value = true;
      try {
        await changeNickname({ memberID: form.value.memberID, nickname: form.value.nickName, isForce: true });
        form.value.oriNickName = form.value.nickName;
        const accountID = String(selectedMemberRaw.value?.accountID ?? '');
        form.value.accountText = accountID ? `${accountID} - ${form.value.nickName}` : form.value.accountText;
        message.success(t('notify.updateSuccess'));
      }
      catch (e: any) {
        message.error(e?.message || t('notify.failed'));
      }
      finally {
        nicknameSubmitting.value = false;
        await doValidateNickname();
      }
    },
  });
};

const onUpdateAvatar = async () => {
  if (!canUpdateAvatar.value) {
    return;
  }

  const nextId = Number(form.value.avatarID);
  Modal.confirm({
    title: t('buttons.updateAvatar'),
    content: `${t('labels.avatar')}：${form.value.oriAvatarID} → ${nextId}`,
    okText: t('buttons.confirm'),
    cancelText: t('buttons.cancel'),
    async onOk() {
      avatarSubmitting.value = true;
      try {
        await updateUserProfile({ memberID: form.value.memberID, avatarID: nextId });
        message.success(t('notify.updateSuccess'));
        const profile = await getUserProfile({ memberID: form.value.memberID });
        const avatarID = profile?.avatarID === undefined ? undefined : Number(profile.avatarID);
        form.value.avatarID = avatarID;
        form.value.oriAvatarID = avatarID;
        form.value.avatarUrl = toCdnUrl(profile?.profilePictureUrl);
      }
      catch (e: any) {
        message.error(e?.message || t('notify.failed'));
      }
      finally {
        avatarSubmitting.value = false;
      }
    },
  });
};
</script>

<template>
  <div class="member-nickname-avatar-page">
    <a-result
      v-if="!hasPermission"
      status="403"
      :title="t('noPermission.title')"
      :sub-title="t('noPermission.subTitle')"
    />

    <a-card v-else :title="t('title')" :bordered="false">
      <a-form layout="horizontal" :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }" @submit.prevent>
        <!-- 查詢帳戶 -->
        <a-form-item :label="t('labels.search')" required>
          <div class="inline-control">
            <a-select
              v-model:value="form.memberID"
              show-search
              allow-clear
              :filter-option="false"
              :options="memberOptions"
              :loading="memberLoading"
              :disabled="!masterAgent"
              class="inline-flex-1"
              :placeholder="t('form.memberPlaceholder')"
              @search="onMemberSearch"
              @popup-scroll="onMemberPopupScroll"
              @change="onMemberChanged"
            />
            <a-button
              type="button"
              class="inline-btn"
              :disabled="!form.memberID || loading"
              :loading="loading"
              @click="search"
            >
              {{ t('buttons.search') }}
            </a-button>
          </div>
        </a-form-item>

        <!-- 查詢成功後顯示的修改區塊 -->
        <template v-if="hasSearched">
          <!-- 帳號 -->
          <a-form-item :label="t('labels.account')">
            <a-input :value="form.accountText" disabled class="w-420" />
          </a-form-item>

          <!-- 暱稱 -->
          <a-form-item
            :label="t('labels.nickName')"
            :validate-status="nicknameError ? 'error' : undefined"
            :help="nicknameError || ''"
          >
            <div class="inline-control">
              <a-input
                v-model:value="form.nickName"
                class="inline-flex-1"
                :disabled="!form.memberID"
                @keydown.enter.prevent
              />
              <a-button
                type="button"
                class="inline-btn"
                :disabled="!canUpdateNickname"
                :loading="nicknameSubmitting || nicknameChecking"
                @click="onUpdateNickname"
              >
                {{ t('buttons.updateNickName') }}
              </a-button>
            </div>
          </a-form-item>

          <!-- 頭像 -->
          <a-form-item :label="t('labels.avatar')">
            <div class="avatar-row">
              <div class="avatar-preview">
                <img v-if="form.avatarUrl" :src="form.avatarUrl" alt="avatar">
              </div>
              <a-select
                v-model:value="form.avatarID"
                :options="avatarOptions"
                style="width: 240px"
                :disabled="!form.memberID || avatarList.length === 0"
                :placeholder="t('avatar.selectPlaceholder')"
              />
              <a-button
                type="button"
                :disabled="!canUpdateAvatar"
                :loading="avatarSubmitting"
                @click="onUpdateAvatar"
              >
                {{ t('buttons.updateAvatar') }}
              </a-button>
            </div>
          </a-form-item>
        </template>
      </a-form>
    </a-card>
  </div>
</template>

<style scoped>
.inline-control {
  display: flex;
  align-items: center;
  gap: 12px;
}
.inline-flex-1 {
  flex: 1;
  min-width: 260px;
}
.inline-btn {
  width: 120px;
}
.w-240 {
  width: 240px;
}
.w-420 {
  width: 420px;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar-preview {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
