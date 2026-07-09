import { create } from 'zustand';
import { authApi } from '../services/auth.api';
import { clearTokens, getStoredTokens, saveTokens } from '../services/token-storage';
import type { AuthTokens, AuthUser, LoginInput, RegisterInput } from '../types/auth.types';

type AuthStatus = 'authenticated' | 'restoring' | 'unauthenticated';

interface AuthState {
  accessToken?: string;
  error?: string;
  isLoading: boolean;
  refreshToken?: string;
  status: AuthStatus;
  user?: AuthUser;
  clearError: () => void;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  restoreSession: () => Promise<void>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Authentication failed.';
}

function authenticatedState(user: AuthUser, tokens: AuthTokens) {
  return {
    accessToken: tokens.accessToken,
    error: undefined,
    isLoading: false,
    refreshToken: tokens.refreshToken,
    status: 'authenticated' as const,
    user,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoading: false,
  status: 'restoring',

  clearError: () => set({ error: undefined }),

  login: async (input) => {
    set({ error: undefined, isLoading: true });

    try {
      const response = await authApi.login(input);
      await saveTokens(response.tokens);
      set(authenticatedState(response.user, response.tokens));
    } catch (error) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
        status: 'unauthenticated',
      });
    }
  },

  logout: async () => {
    const refreshToken = get().refreshToken ?? (await getStoredTokens()).refreshToken;

    set({ isLoading: true });

    try {
      await authApi.logout(refreshToken);
    } catch {
      // Logout should always clear the local session even if the network request fails.
    }

    await clearTokens();
    set({
      accessToken: undefined,
      error: undefined,
      isLoading: false,
      refreshToken: undefined,
      status: 'unauthenticated',
      user: undefined,
    });
  },

  register: async (input) => {
    set({ error: undefined, isLoading: true });

    try {
      const response = await authApi.register(input);
      await saveTokens(response.tokens);
      set(authenticatedState(response.user, response.tokens));
    } catch (error) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
        status: 'unauthenticated',
      });
    }
  },

  restoreSession: async () => {
    set({ error: undefined, isLoading: true, status: 'restoring' });

    const storedTokens = await getStoredTokens();

    if (!storedTokens.accessToken || !storedTokens.refreshToken) {
      set({ isLoading: false, status: 'unauthenticated' });
      return;
    }

    try {
      const user = await authApi.me(storedTokens.accessToken);
      set(
        authenticatedState(user, {
          accessToken: storedTokens.accessToken,
          refreshToken: storedTokens.refreshToken,
        }),
      );
      return;
    } catch {
      try {
        const response = await authApi.refresh(storedTokens.refreshToken);
        await saveTokens(response.tokens);
        set(authenticatedState(response.user, response.tokens));
        return;
      } catch {
        await clearTokens();
      }
    }

    set({
      accessToken: undefined,
      error: undefined,
      isLoading: false,
      refreshToken: undefined,
      status: 'unauthenticated',
      user: undefined,
    });
  },
}));
