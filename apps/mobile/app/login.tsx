import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiLogin, getApiBaseUrl } from '../lib/api';
import { setAuthToken } from '../lib/auth';
import { ScreenScroll } from '../components/ScreenScroll';
import { colors, ui } from '../lib/ui';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@binhajmarble.ae');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiLogin({ email, password });
      await setAuthToken(result.token);
      router.replace('/' as never);
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
      <Text style={styles.brand}>Marble with Nuage</Text>
      <Text style={ui.title}>Sign in</Text>
      <Text style={ui.lede}>
        Use your company account on this device.
      </Text>
      <Text style={styles.api}>API {getApiBaseUrl()}</Text>

      <View style={ui.card}>
        <Text style={ui.label}>Email</Text>
        <TextInput
          style={ui.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.ae"
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

      <Text style={styles.hint}>
        Pilot: owner@binhajmarble.ae · default password binhaj123
      </Text>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    // Mid-upper placement so a small keyboard nudge keeps brand + fields
    // visible without the big jump from vertical centering.
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingBottom: 24,
  },
  brand: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  api: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  hint: {
    marginTop: 16,
    color: colors.soft,
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: { opacity: 0.6 },
});
