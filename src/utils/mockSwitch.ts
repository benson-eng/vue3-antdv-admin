const MOCK_API_PREFIX = '/api';
const ADMIN_SYSTEM_API_PREFIX = '/AdminSystem/api';

const adminSystemToMockMap: Record<string, string> = {
  '/AdminSystem/api/login': '/api/auth/login',
  '/AdminSystem/api/getUserInfo': '/api/auth/getUserInfo',
  '/AdminSystem/api/logout': '/api/auth/logout',
  '/AdminSystem/api/getBackendKey': '/api/auth/getBackendKey',
  '/AdminSystem/api/getCurrencyType': '/api/adminAccount/currency',
  '/AdminSystem/api/createCurrencyType': '/api/adminAccount/currency',
  '/AdminSystem/api/updateCurrencyType': '/api/adminAccount/currency',
  '/AdminSystem/api/deleteCurrencyType': '/api/adminAccount/currency',
};

export const isMockEnabled =
  import.meta.env.VITE_ENABLE_MOCK === 'true' || import.meta.env.VITE_MOCK_IN_PROD === 'true';

export const resolveAdminSystemPath = (path: string) => {
  if (!path.startsWith(ADMIN_SYSTEM_API_PREFIX)) {
    return path;
  }
  if (!isMockEnabled) {
    return path;
  }
  return adminSystemToMockMap[path] || `${MOCK_API_PREFIX}${path.slice(ADMIN_SYSTEM_API_PREFIX.length)}`;
};

export const ensureMockPath = (path: string) => {
  return `${MOCK_API_PREFIX}${path}`;
};

