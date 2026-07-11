import type { BusinessWithMembership } from '../types/business.types';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface ApiErrorBody {
  message?: string | string[];
}

async function request<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'GET',
  });

  if (!response.ok) {
    let errorMessage = 'Business request failed.';

    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      const message = errorBody.message;
      errorMessage = Array.isArray(message) ? message.join(' ') : message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

export const businessesApi = {
  list(accessToken: string) {
    return request<BusinessWithMembership[]>('/businesses', accessToken);
  },
};
