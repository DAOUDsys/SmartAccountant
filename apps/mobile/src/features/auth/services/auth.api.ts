import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '../types/auth.types';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface ApiErrorBody {
  message?: string | string[];
}

interface RequestOptions extends RequestInit {
  accessToken?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'Authentication request failed.';

    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      const message = errorBody.message;
      errorMessage = Array.isArray(message) ? message.join(' ') : message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  login(input: LoginInput) {
    return request<AuthResponse>('/auth/login', {
      body: JSON.stringify(input),
      method: 'POST',
    });
  },

  logout(refreshToken?: string) {
    return request<{ success: boolean }>('/auth/logout', {
      body: JSON.stringify({ refreshToken }),
      method: 'POST',
    });
  },

  me(accessToken: string) {
    return request<AuthUser>('/auth/me', {
      accessToken,
      method: 'GET',
    });
  },

  refresh(refreshToken: string) {
    return request<AuthResponse>('/auth/refresh', {
      body: JSON.stringify({ refreshToken }),
      method: 'POST',
    });
  },

  register(input: RegisterInput) {
    return request<AuthResponse>('/auth/register', {
      body: JSON.stringify(input),
      method: 'POST',
    });
  },
};
