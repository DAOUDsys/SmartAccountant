import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Button, H1, Input, Label, Paragraph, Text, XStack, YStack } from 'tamagui';
import { useAuthStore } from '../store/auth.store';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    void login({
      email,
      password,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack backgroundColor="$background" flex={1} justifyContent="center" padding="$5" gap="$5">
          <YStack gap="$2">
            <H1 color="$color" fontSize={40} lineHeight={46}>
              Finance AI
            </H1>
            <Paragraph color="$gray11" lineHeight={24} size="$4">
              Sign in to continue to your AI accounting workspace.
            </Paragraph>
          </YStack>

          <YStack gap="$3">
            <YStack gap="$1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                id="login-email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />
            </YStack>

            <YStack gap="$1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                accessibilityLabel="Password"
                autoComplete="password"
                id="login-password"
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                textContentType="password"
                value={password}
              />
            </YStack>

            {error ? (
              <Paragraph accessibilityRole="alert" color="$red10">
                {error}
              </Paragraph>
            ) : null}

            <Button
              accessibilityLabel="Sign in"
              disabled={!canSubmit}
              onPress={handleSubmit}
              size="$5"
              theme="active"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </YStack>

          <XStack alignItems="center" justifyContent="center" gap="$1.5">
            <Text color="$gray11">New to Finance AI?</Text>
            <Link href="/auth/register" asChild>
              <Button chromeless size="$3">
                Create account
              </Button>
            </Link>
          </XStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
