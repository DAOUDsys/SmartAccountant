import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Button, H1, Input, Label, Paragraph, Text, XStack, YStack } from 'tamagui';
import { useAuthStore } from '../store/auth.store';

function validatePassword(password: string) {
  return {
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasValidLength: password.length >= 10,
  };
}

export function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const register = useAuthStore((state) => state.register);

  const passwordState = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordValid = Object.values(passwordState).every(Boolean);
  const canSubmit =
    email.trim().length > 0 && passwordValid && passwordsMatch && !isLoading;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    void register({
      displayName: displayName.trim() || undefined,
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
            <H1 color="$color" fontSize={38} lineHeight={44}>
              Create account
            </H1>
            <Paragraph color="$gray11" lineHeight={24} size="$4">
              Secure your AI accounting workspace before backend tools are connected.
            </Paragraph>
          </YStack>

          <YStack gap="$3">
            <YStack gap="$1.5">
              <Label htmlFor="register-display-name">Display name</Label>
              <Input
                accessibilityLabel="Display name"
                autoComplete="name"
                id="register-display-name"
                onChangeText={setDisplayName}
                placeholder="Your name"
                textContentType="name"
                value={displayName}
              />
            </YStack>

            <YStack gap="$1.5">
              <Label htmlFor="register-email">Email</Label>
              <Input
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                id="register-email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />
            </YStack>

            <YStack gap="$1.5">
              <Label htmlFor="register-password">Password</Label>
              <Input
                accessibilityLabel="Password"
                autoComplete="new-password"
                id="register-password"
                onChangeText={setPassword}
                placeholder="At least 10 characters"
                secureTextEntry
                textContentType="newPassword"
                value={password}
              />
              <Paragraph color={passwordValid ? '$green10' : '$gray11'} size="$2">
                Use 10+ characters with uppercase, lowercase, and a number.
              </Paragraph>
            </YStack>

            <YStack gap="$1.5">
              <Label htmlFor="register-confirm-password">Confirm password</Label>
              <Input
                accessibilityLabel="Confirm password"
                autoComplete="new-password"
                id="register-confirm-password"
                onChangeText={setConfirmPassword}
                placeholder="Repeat your password"
                secureTextEntry
                textContentType="newPassword"
                value={confirmPassword}
              />
              {confirmPassword.length > 0 ? (
                <Paragraph color={passwordsMatch ? '$green10' : '$red10'} size="$2">
                  {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
                </Paragraph>
              ) : null}
            </YStack>

            {error ? (
              <Paragraph accessibilityRole="alert" color="$red10">
                {error}
              </Paragraph>
            ) : null}

            <Button
              accessibilityLabel="Create account"
              disabled={!canSubmit}
              onPress={handleSubmit}
              size="$5"
              theme="active"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </YStack>

          <XStack alignItems="center" justifyContent="center" gap="$1.5">
            <Text color="$gray11">Already have an account?</Text>
            <Link href="/auth/login" asChild>
              <Button chromeless size="$3">
                Sign in
              </Button>
            </Link>
          </XStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
