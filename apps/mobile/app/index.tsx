import { MODULE_NAV } from '@marble/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch, getApiBaseUrl } from '../lib/api';
import { colors, ui } from '../lib/ui';

type Session = {
  companyId: string;
  userId: string;
  email: string;
  companyName: string;
};

const READY = new Set([
  'customers',
  'suppliers',
  'products',
  'quotations',
  'jobs',
  'invoices',
  'advances',
  'accounts',
  'profile',
  'audit',
]);

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Session>('/auth/session')
      .then(setSession)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load session'),
      );
  }, []);

  const modules = MODULE_NAV.filter((m) => m.key !== 'home');

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={styles.brand}>Marble with Nuage</Text>
      <Text style={ui.lede}>Same modules and data as the web app.</Text>
      <Text style={styles.api}>API {getApiBaseUrl()}</Text>

      {error ? <Text style={ui.error}>{error}</Text> : null}
      {session ? (
        <View style={ui.card}>
          <Text style={styles.cardLabel}>Active company</Text>
          <Text style={ui.cardTitle}>{session.companyName}</Text>
          <Text style={ui.cardMeta}>{session.email}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Modules</Text>
      {modules.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push(`/module/${item.key}` as never)}
        >
          <View>
            <Text style={styles.rowText}>{item.label}</Text>
            {!READY.has(item.key) ? (
              <Text style={styles.soon}>Coming in a later phase</Text>
            ) : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  api: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 8,
  },
  cardLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  section: {
    marginTop: 22,
    marginBottom: 8,
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  rowPressed: {
    backgroundColor: colors.accentSoft,
  },
  rowText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '500',
  },
  soon: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '300',
  },
});
