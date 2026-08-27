#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -z "${LAN_IP:-}" ]]; then
  echo "Could not detect LAN IP. Set LAN_IP manually." >&2
  exit 1
fi
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:3001"
export EXPO_PUBLIC_BOOTSTRAP_TOKEN="${EXPO_PUBLIC_BOOTSTRAP_TOKEN:-binhaj-dev-token}"
EXP_URL="exp://${LAN_IP}:8081"
echo "API:  $EXPO_PUBLIC_API_URL"
echo "Expo: $EXP_URL"
echo "Phone + Mac must be on the same Wi‑Fi."
echo ""
npx --yes qrcode-terminal "$EXP_URL" || true
npx --yes qrcode -o "$ROOT/.expo-go-qr.png" "$EXP_URL"
echo "QR image: $ROOT/.expo-go-qr.png"
exec npx expo start --lan --clear
