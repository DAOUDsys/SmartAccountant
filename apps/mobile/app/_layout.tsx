import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';
import { useAuthStore } from '../src/features/auth';
import config from '../tamagui.config';

function AuthSessionHydrator() {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

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
            <AuthSessionHydrator />
          </SafeAreaView>
        </SafeAreaProvider>
      </Theme>
    </TamaguiProvider>
  );
}
