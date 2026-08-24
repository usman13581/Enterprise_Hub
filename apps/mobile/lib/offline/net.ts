import * as Network from 'expo-network';

/**
 * For this app "online" means the device has a network interface.
 * Do not require WAN/internet — the Nest API is often on the same LAN,
 * and `isInternetReachable: false` would falsely mark the pilot offline.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false;
  } catch {
    // If the native module is unavailable (web/dev), assume online and let
    // fetch failures drive the offline fallback.
    return true;
  }
}
