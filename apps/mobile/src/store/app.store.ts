import { create } from 'zustand';

interface AppState {
  apiBaseUrl: string;
  backendStatus: 'configured' | 'unknown';
  setBackendStatus: (status: AppState['backendStatus']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  backendStatus: 'configured',
  setBackendStatus: (backendStatus) => set({ backendStatus }),
}));
