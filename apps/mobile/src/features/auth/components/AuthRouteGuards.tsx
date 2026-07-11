import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { useAuthStore } from '../store/auth.store';

export function AuthenticatedRoute({ children }: PropsWithChildren) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
    }
  }, [router, status]);

  if (status !== 'authenticated') {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}

export function GuestRoute({ children }: PropsWithChildren) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  if (status !== 'unauthenticated') {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
