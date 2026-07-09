import * as SecureStore from 'expo-secure-store';
import type { AuthTokens } from '../types/auth.types';

const accessTokenKey = 'finance_ai_access_token';
const refreshTokenKey = 'finance_ai_refresh_token';

export async function saveTokens(tokens: AuthTokens) {
  await Promise.all([
    SecureStore.setItemAsync(accessTokenKey, tokens.accessToken),
    SecureStore.setItemAsync(refreshTokenKey, tokens.refreshToken),
  ]);
}

export async function getStoredTokens(): Promise<Partial<AuthTokens>> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(accessTokenKey),
    SecureStore.getItemAsync(refreshTokenKey),
  ]);

  return {
    accessToken: accessToken ?? undefined,
    refreshToken: refreshToken ?? undefined,
  };
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(accessTokenKey),
    SecureStore.deleteItemAsync(refreshTokenKey),
  ]);
}
