import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../services/auth.api';
import { clearTokens, getStoredTokens, saveTokens } from '../services/token-storage';
import { useAuthStore } from './auth.store';
import type { AuthResponse } from '../types/auth.types';

const businessStoreActions = {
  clearActiveBusiness: vi.fn(),
  hydrateFromAuthContext: vi.fn(),
  loadBusinesses: vi.fn(),
};

vi.mock('../../businesses', () => ({
  useBusinessStore: {
    getState: () => businessStoreActions,
  },
}));

vi.mock('../services/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('../services/token-storage', () => ({
  clearTokens: vi.fn(),
  getStoredTokens: vi.fn(),
  saveTokens: vi.fn(),
}));

const authResponse: AuthResponse = {
  tokens: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  },
  user: {
    createdAt: '2026-07-10T10:00:00.000Z',
    email: 'daoud@example.com',
    id: 'user_1',
    role: 'USER',
    updatedAt: '2026-07-10T10:00:00.000Z',
  },
};

function resetAuthStore() {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
}

describe('auth store', () => {
  beforeEach(() => {
    resetAuthStore();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.logout).mockReset();
    vi.mocked(authApi.me).mockReset();
    vi.mocked(authApi.refresh).mockReset();
    vi.mocked(authApi.register).mockReset();
    vi.mocked(clearTokens).mockReset();
    vi.mocked(getStoredTokens).mockReset();
    vi.mocked(saveTokens).mockReset();
    businessStoreActions.clearActiveBusiness.mockReset();
    businessStoreActions.hydrateFromAuthContext.mockReset();
    businessStoreActions.loadBusinesses.mockReset();
  });

  afterEach(() => {
    resetAuthStore();
  });

  it('authenticates and stores tokens after login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(authResponse);

    await useAuthStore.getState().login({
      email: 'daoud@example.com',
      password: 'Password123',
    });

    const state = useAuthStore.getState();

    expect(saveTokens).toHaveBeenCalledWith(authResponse.tokens);
    expect(businessStoreActions.loadBusinesses).toHaveBeenCalledWith('access-token');
    expect(state.status).toBe('authenticated');
    expect(state.user?.email).toBe('daoud@example.com');
    expect(state.accessToken).toBe('access-token');
  });

  it('refreshes stored tokens when the access token no longer validates', async () => {
    vi.mocked(getStoredTokens).mockResolvedValue({
      accessToken: 'expired-access',
      refreshToken: 'refresh-token',
    });
    vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(authApi.refresh).mockResolvedValue(authResponse);

    await useAuthStore.getState().restoreSession();

    expect(authApi.refresh).toHaveBeenCalledWith('refresh-token');
    expect(saveTokens).toHaveBeenCalledWith(authResponse.tokens);
    expect(businessStoreActions.loadBusinesses).toHaveBeenCalledWith('access-token');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('clears local tokens on logout even when the network request fails', async () => {
    useAuthStore.setState({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      status: 'authenticated',
      user: authResponse.user,
    });
    vi.mocked(authApi.logout).mockRejectedValue(new Error('Network unavailable'));

    await useAuthStore.getState().logout();

    expect(clearTokens).toHaveBeenCalled();
    expect(businessStoreActions.clearActiveBusiness).toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeUndefined();
  });
});
