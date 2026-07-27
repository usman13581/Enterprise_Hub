import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
        <Stack.Screen name="index" options={{ title: 'Marble with Nuage' }} />
        <Stack.Screen name="module/customers" options={{ title: 'Customers' }} />
        <Stack.Screen name="module/suppliers" options={{ title: 'Suppliers' }} />
        <Stack.Screen name="module/products" options={{ title: 'Products' }} />
        <Stack.Screen name="module/profile" options={{ title: 'Company profile' }} />
        <Stack.Screen name="module/audit" options={{ title: 'Audit' }} />
        <Stack.Screen name="module/[key]" options={{ title: 'Module' }} />
      </Stack>
    </>
  );
}
