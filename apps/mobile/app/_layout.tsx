import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';
import { AuthLoadingScreen, useAuthStore } from '../src/features/auth';
import config from '../tamagui.config';

function AuthRouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const status = useAuthStore((state) => state.status);
  const isAuthRoute = segments[0] === 'auth';

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (status === 'restoring') {
      return;
    }

    if (status === 'unauthenticated' && !isAuthRoute) {
      router.replace('/auth/login');
      return;
    }

    if (status === 'authenticated' && isAuthRoute) {
      router.replace('/');
    }
  }, [isAuthRoute, router, status]);

  if (
    status === 'restoring' ||
    (status === 'unauthenticated' && !isAuthRoute) ||
    (status === 'authenticated' && isAuthRoute)
  ) {
    return <AuthLoadingScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const themeName = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <TamaguiProvider config={config} defaultTheme={themeName}>
      <Theme name={themeName}>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1 }}>
            <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
            <AuthRouteGuard />
          </SafeAreaView>
        </SafeAreaProvider>
      </Theme>
    </TamaguiProvider>
  );
}
