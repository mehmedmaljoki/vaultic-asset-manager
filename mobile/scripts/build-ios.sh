#!/usr/bin/env bash
# build-ios.sh — Build iOS IPA using EAS Build.
# Usage:
#   ./scripts/build-ios.sh [development|preview|production] [--local]
# Requires macOS for --local builds.
set -euo pipefail

PROFILE="${1:-preview}"
LOCAL_FLAG=""
if [[ "${2:-}" == "--local" ]]; then
  LOCAL_FLAG="--local"
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

for cmd in node npx; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: $cmd not found on PATH." >&2; exit 1; }
done

if [[ ! -f ".env.local" ]] && [[ -z "${EXPO_PUBLIC_API_ENV:-}" ]]; then
  echo "WARNING: .env.local not found. API keys will be empty."
fi

echo "Building iOS [$PROFILE]${LOCAL_FLAG:+ (local)}..."
npx eas build \
  --platform ios \
  --profile "$PROFILE" \
  --non-interactive \
  $LOCAL_FLAG

echo "iOS build complete."
