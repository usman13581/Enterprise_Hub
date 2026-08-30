import { APP_NAME } from '@marble/types';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, View } from 'react-native';
import { apiFetch } from '../lib/api';
import {
  clearAuthToken,
  getAuthToken,
  getLastSessionActivity,
  getSessionKind,
  markSessionActivity,
} from '../lib/auth';
import { colors } from '../lib/ui';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [kind, setKind] = useState<'company' | 'platform' | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await getAuthToken();
      const sessionKind = await getSessionKind();
      setKind(sessionKind);
      let validated = false;
      if (token && sessionKind === 'company') {
        const session = await apiFetch<{ mustChangePassword?: boolean }>('/auth/session').catch(() => null);
        validated = Boolean(session);
        if (session) {
          setNeedsPassword(Boolean(session.mustChangePassword));
          await markSessionActivity();
        }
      } else if (token && sessionKind === 'platform') {
        const session = await apiFetch('/admin/session').catch(() => null);
        validated = Boolean(session);
        if (session) await markSessionActivity();
      }
      setAuthed(Boolean(await getAuthToken()) && (validated || Boolean(token)));
      setReady(true);
    })();
  }, [segments]);

  useEffect(() => {
    if (!ready || !authed) return;
    let warningShown = false;
    const checkSession = async () => {
      const lastActivity = await getLastSessionActivity();
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= 30 * 60 * 1000) {
        await apiFetch('/auth/session').catch(() => undefined);
        return;
      }
      if (elapsed >= 28 * 60 * 1000 && !warningShown) {
        warningShown = true;
        Alert.alert(
          'Your session is about to expire',
          'Stay signed in to continue working safely.',
          [
            {
              text: 'Sign out',
              style: 'cancel',
              onPress: () => {
                void clearAuthToken().then(() => router.replace('/login' as never));
              },
            },
            {
              text: 'Stay signed in',
              onPress: () => {
                void apiFetch('/auth/session').then(() => markSessionActivity());
              },
            },
          ],
        );
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkSession();
    });
    const timer = setInterval(() => void checkSession(), 30_000);
    void checkSession();
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [authed, ready]);

  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    const onCompanyLogin = root === 'login';
    const onAdminLogin = root === 'admin-login';
    const inAdmin = root === 'admin';
    const onPublic = onCompanyLogin || onAdminLogin;

    if (!authed) {
      if (!onPublic) {
        router.replace((inAdmin ? '/admin-login' : '/login') as never);
      }
      return;
    }

    if (kind === 'platform') {
      if (onAdminLogin) {
        router.replace('/admin' as never);
      } else if (!inAdmin) {
        // Platform sessions never land on marble company modules.
        router.replace('/admin' as never);
      }
      return;
    }

    if (needsPassword && root !== 'change-password') {
      router.replace('/change-password' as never);
      return;
    }
    if (onCompanyLogin) {
      router.replace('/' as never);
    } else if (inAdmin || onAdminLogin) {
      router.replace('/' as never);
    }
  }, [ready, authed, kind, needsPassword, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#14202b',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#f4f6f8' },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="admin-login" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ title: 'Set password' }} />
        <Stack.Screen name="index" options={{ title: APP_NAME }} />
        <Stack.Screen name="admin/index" options={{ title: 'Platform admin' }} />
        <Stack.Screen name="admin/companies" options={{ title: 'Companies' }} />
        <Stack.Screen
          name="admin/companies/[id]"
          options={{ title: 'Company' }}
        />
        <Stack.Screen
          name="admin/applications"
          options={{ title: 'Applications' }}
        />
        <Stack.Screen name="admin/plans" options={{ title: 'Plans' }} />
        <Stack.Screen name="admin/renewals" options={{ title: 'Renewals' }} />
        <Stack.Screen
          name="admin/notifications"
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen name="admin/support" options={{ title: 'Support' }} />
        <Stack.Screen name="admin/audit" options={{ title: 'Audit' }} />
        <Stack.Screen name="module/customers" options={{ title: 'Customers' }} />
        <Stack.Screen name="module/suppliers" options={{ title: 'Suppliers' }} />
        <Stack.Screen name="module/products" options={{ title: 'Products' }} />
        <Stack.Screen name="module/quotations" options={{ title: 'Quotations' }} />
        <Stack.Screen
          name="module/quotations-counter-top"
          options={{ title: 'Counter Top' }}
        />
        <Stack.Screen name="module/jobs" options={{ title: 'Jobs' }} />
        <Stack.Screen name="module/invoices" options={{ title: 'Invoices' }} />
        <Stack.Screen name="module/advances" options={{ title: 'Advances' }} />
        <Stack.Screen name="module/accounts" options={{ title: 'Accounts' }} />
        <Stack.Screen name="module/reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="module/profile" options={{ title: 'Company profile' }} />
        <Stack.Screen name="module/audit" options={{ title: 'Audit' }} />
        <Stack.Screen name="module/team" options={{ title: 'Team' }} />
        <Stack.Screen
          name="module/subscription"
          options={{ title: 'Subscription' }}
        />
        <Stack.Screen name="module/support" options={{ title: 'Support' }} />
        <Stack.Screen
          name="module/notifications"
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen name="module/[key]" options={{ title: 'Module' }} />
      </Stack>
    </>
  );
}
