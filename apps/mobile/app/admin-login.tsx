import { APP_NAME, APP_POWERED_BY, APP_VERSION } from '@marble/types';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiAdminLogin } from '../lib/api';
import { setAuthToken, setSessionKind } from '../lib/auth';
import { ScreenScroll } from '../components/ScreenScroll';
import { colors, ui } from '../lib/ui';

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiAdminLogin({ email, password });
      await setAuthToken(result.token);
      await setSessionKind('platform');
      router.replace('/admin' as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll
      keyboardLift="gentle"
      contentContainerStyle={styles.content}
    >
      <Image
        source={require('../assets/prequaliq-mark.png')}
        style={styles.mark}
        accessibilityLabel="Prequaliq"
      />
      <Text style={styles.brand}>{APP_NAME}</Text>
      <Text style={ui.title}>Platform admin</Text>
      <Text style={ui.lede}>
        Sign in with a platform admin account. Company modules are not available
        here.
      </Text>

      <View style={ui.card}>
        <Text style={ui.label}>Email</Text>
        <TextInput
          style={ui.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="admin@prequaliq.com"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Password</Text>
        <TextInput
          style={ui.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.soft}
        />
        {error ? <Text style={ui.error}>{error}</Text> : null}
        <Pressable
          style={[ui.button, { marginTop: 16 }, saving && styles.disabled]}
          disabled={saving}
          onPress={() => void submit()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={ui.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        style={styles.backLink}
        onPress={() => router.replace('/login' as never)}
      >
        <Text style={styles.backLinkText}>Company sign in</Text>
      </Pressable>

      <Text style={styles.credit}>{APP_POWERED_BY}</Text>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 56,
    paddingBottom: 24,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginBottom: 12,
  },
  brand: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  backLink: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backLinkText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  credit: {
    marginTop: 28,
    color: colors.soft,
    fontSize: 11,
    textAlign: 'center',
  },
  version: {
    marginTop: 2,
    marginBottom: 8,
    color: colors.soft,
    fontSize: 11,
    textAlign: 'center',
  },
  disabled: { opacity: 0.6 },
});
