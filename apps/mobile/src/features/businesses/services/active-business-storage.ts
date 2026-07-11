import * as SecureStore from 'expo-secure-store';

const activeBusinessIdKey = 'finance_ai_active_business_id';

export async function saveActiveBusinessId(businessId: string) {
  await SecureStore.setItemAsync(activeBusinessIdKey, businessId);
}

export async function getStoredActiveBusinessId() {
  return (await SecureStore.getItemAsync(activeBusinessIdKey)) ?? undefined;
}

export async function clearStoredActiveBusinessId() {
  await SecureStore.deleteItemAsync(activeBusinessIdKey);
}
