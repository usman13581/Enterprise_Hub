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
import { apiChangePassword } from '../lib/api';
import { setAuthToken, setSessionKind } from '../lib/auth';
import { ScreenScroll } from '../components/ScreenScroll';
import { colors, ui } from '../lib/ui';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiChangePassword(password);
      await setAuthToken(result.token);
      await setSessionKind('company');
      router.replace('/' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <Text style={ui.title}>Change password</Text>
      <Text style={ui.lede}>Choose a new password for your account.</Text>
      <View style={ui.card}>
        <Text style={ui.label}>New password</Text>
        <TextInput
          style={ui.input}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 12 characters"
          placeholderTextColor={colors.soft}
        />
        <Text style={ui.label}>Confirm new password</Text>
        <TextInput
          style={ui.input}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="Repeat your new password"
          placeholderTextColor={colors.soft}
        />
        {error ? <Text style={ui.error}>{error}</Text> : null}
        <Pressable
          style={[ui.button, styles.submit, saving && styles.disabled]}
          disabled={saving}
          onPress={() => void submit()}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={ui.buttonText}>Save password</Text>}
        </Pressable>
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  submit: {
    marginTop: 16,
  },
  disabled: { opacity: 0.6 },
});
