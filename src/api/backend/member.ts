import { request } from '@/utils/request';

const memberApiPath = {
  list: '/api/member/list',
  detail: '/api/member',
  add: '/api/member',
  update: '/api/member',
  delete: '/api/member',
};

export interface MemberItem {
  id: number;
  account: string;
  status: number;
  superior?: string;
  memberLevel?: string;
  returnWaterLevel?: string;
  vipLevel?: string;
  promotionCode?: string;
  superiorAccount?: string;
  createdAt?: string;
  updatedAt?: string;
  realName?: string;
  phone?: string;
  idCard?: string;
  line?: string;
  registerIp?: string;
  lastLoginIp?: string;
  registerTime?: string;
  lastLoginTime?: string;
  registerSource?: string;
  depositCount?: number;
  firstDeposit?: string;
  firstWithdraw?: string;
}

export interface MemberListResponse {
  items: MemberItem[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export const getMemberList = (params?: API.PageParams) =>
  request<MemberListResponse>({
    url: memberApiPath.list,
    method: 'get',
    params,
  });

export const getMemberDetail = (id: number) =>
  request<MemberItem>({
    url: `${memberApiPath.detail}/${id}`,
    method: 'get',
  });

export const addMember = (data: Partial<MemberItem>) =>
  request({
    url: memberApiPath.add,
    method: 'post',
    data,
  });

export const updateMember = (id: number, data: Partial<MemberItem>) =>
  request({
    url: `${memberApiPath.update}/${id}`,
    method: 'put',
    data,
  });

export const deleteMember = (id: number) =>
  request({
    url: `${memberApiPath.delete}/${id}`,
    method: 'delete',
  });
