import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Classic imperative sign-in/up flow. @clerk/expo's main entry now exports the
// newer "signals" API; the { isLoaded, signIn, setActive } hooks live here.
import { useSignIn, useSignUp } from '@clerk/expo/legacy';

import { colors, fonts, radius } from '@/constants/theme';

type Mode = 'signIn' | 'signUp';

// Custom native auth flow (Clerk has no drop-in <SignIn> for React Native).
// Email + password, with an email verification code on sign-up. This is the
// canonical Clerk Expo quickstart flow and needs no external OAuth provider.
export function SignInScreen() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = signInLoaded && signUpLoaded;

  // Clerk returns structured errors under err.errors[].longMessage.
  const showError = (err: unknown) => {
    const msg =
      (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0]
        ?.longMessage ??
      (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
      'Something went wrong. Please try again.';
    setError(msg);
  };

  const onSignIn = async () => {
    if (!signInLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === 'complete') {
        await setSignInActive({ session: attempt.createdSessionId });
      } else {
        setError('Additional verification is required to sign in.');
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async () => {
    if (!signUpLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!signUpLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setSignUpActive({ session: attempt.createdSessionId });
      } else {
        setError('That code didn’t verify. Check it and try again.');
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPendingVerification(false);
    setCode('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>
            t<Text style={{ color: colors.primary }}>a</Text>n
            <Text style={{ color: colors.accent }}>s</Text>
          </Text>
          <Text style={styles.tagline}>
            {pendingVerification
              ? 'Check your email for a verification code.'
              : 'Build the habit. Earn the piece.'}
          </Text>

          {pendingVerification ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Verification code"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoFocus
                editable={!busy}
              />
              <PrimaryButton label="Verify email" onPress={onVerify} busy={busy} disabled={!ready} />
              <Pressable onPress={() => switchMode('signUp')} hitSlop={8}>
                <Text style={styles.switchText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                editable={!busy}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                editable={!busy}
              />
              <PrimaryButton
                label={mode === 'signIn' ? 'Sign in' : 'Create account'}
                onPress={mode === 'signIn' ? onSignIn : onSignUp}
                busy={busy}
                disabled={!ready}
              />
              <Pressable
                onPress={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                hitSlop={8}
              >
                <Text style={styles.switchText}>
                  {mode === 'signIn'
                    ? 'New here? Create an account'
                    : 'Already have an account? Sign in'}
                </Text>
              </Pressable>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.button, (busy || disabled) && styles.buttonDisabled]}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 8,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.foreground,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.foreground,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.primaryForeground,
  },
  switchText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: 16,
  },
});
