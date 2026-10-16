import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import { theme } from '../constants/theme';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!username || !password) return;
    setBusy(true);
    setErr(null);
    try {
      await signIn(username.trim(), password);
    } catch (e: any) {
      setErr(e?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.brand}>
          <View style={styles.brandBar} />
          <Text style={styles.brandText}>TABL</Text>
          <Text style={styles.brandSub}>SHARED STUDY SPACE</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="your username"
            placeholderTextColor={theme.colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            placeholderTextColor={theme.colors.textFaint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            style={styles.input}
          />

          {err && <Text style={styles.err}>{err}</Text>}

          <Pressable
            onPress={onSubmit}
            disabled={busy || !username || !password}
            style={({ pressed }) => [
              styles.btn,
              (busy || !username || !password) && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.btnText}>{busy ? 'SIGNING IN…' : 'SIGN IN'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  brand: { alignItems: 'flex-start' },
  brandBar: {
    width: 32,
    height: 2,
    backgroundColor: theme.colors.green,
    marginBottom: 12,
  },
  brandText: {
    fontFamily: theme.fonts.display,
    fontSize: 48,
    color: theme.colors.text,
    letterSpacing: 2,
  },
  brandSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 3,
    marginTop: 8,
  },
  spacer: { flex: 1, minHeight: 40 },
  form: {},
  label: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    letterSpacing: 1,
  },
  err: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.red,
    marginTop: 12,
    letterSpacing: 1,
  },
  btn: {
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: '#061a0d',
    letterSpacing: 2,
  },
});