import { MODULE_NAV } from '@marble/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch, getApiBaseUrl } from '../lib/api';
import {
  runSync,
  subscribeSyncStatus,
  type SyncStatus,
} from '../lib/offline/syncEngine';
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
  const [sync, setSync] = useState<SyncStatus | null>(null);

  useEffect(() => {
    apiFetch<Session>('/auth/session')
      .then(setSession)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load session'),
      );
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setSync);
    void runSync();
    const id = setInterval(() => void runSync(), 30_000);
    return () => {
      unsubscribe();
      clearInterval(id);
    };
  }, []);

  const modules = MODULE_NAV.filter((m) => m.key !== 'home');
  const pending =
    (sync?.pendingMutations ?? 0) + (sync?.pendingImages ?? 0);

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

      <View style={styles.syncCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Offline sync</Text>
          <Text style={styles.syncLine}>
            {sync?.online === false ? 'Offline' : 'Online'}
            {sync?.syncing ? ' · syncing…' : ''}
            {pending > 0 ? ` · ${pending} queued` : ''}
          </Text>
          {sync?.lastSyncAt ? (
            <Text style={styles.syncMeta}>
              Last sync {new Date(sync.lastSyncAt).toLocaleString()}
            </Text>
          ) : (
            <Text style={styles.syncMeta}>Not synced yet</Text>
          )}
          {sync?.lastError ? (
            <Text style={ui.error}>{sync.lastError}</Text>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.syncButton,
            pressed && styles.rowPressed,
          ]}
          onPress={() => void runSync()}
        >
          <Text style={styles.syncButtonText}>Sync now</Text>
        </Pressable>
      </View>

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
  syncCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  syncLine: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  syncMeta: {
    color: colors.soft,
    fontSize: 12,
    marginTop: 2,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
  },
  syncButtonText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
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
