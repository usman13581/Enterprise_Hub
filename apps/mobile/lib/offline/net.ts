import * as Network from 'expo-network';

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    // If the native module is unavailable (web/dev), assume online and let
    // fetch failures drive the offline fallback.
    return true;
  }
}
