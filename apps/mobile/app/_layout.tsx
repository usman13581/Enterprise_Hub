import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getAuthToken } from '../lib/auth';
import { colors } from '../lib/ui';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    void getAuthToken().then((token) => {
      setAuthed(Boolean(token));
      setReady(true);
    });
  }, [segments]);

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === 'login';
    if (!authed && !onLogin) {
      router.replace('/login' as never);
    } else if (authed && onLogin) {
      router.replace('/' as never);
    }
  }, [ready, authed, segments, router]);

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
        <Stack.Screen name="index" options={{ title: 'Marble with Nuage' }} />
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
        <Stack.Screen name="module/profile" options={{ title: 'Company profile' }} />
        <Stack.Screen name="module/audit" options={{ title: 'Audit' }} />
        <Stack.Screen name="module/[key]" options={{ title: 'Module' }} />
      </Stack>
    </>
  );
}
