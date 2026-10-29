#!/usr/bin/env bash
# Android のアプリを Docker の中で組み立てる。使い方: tools/build-apk.sh [Gradle のタスク（既定 assembleDebug）]
# 先に tools/android-sdk.Dockerfile から kikitori-android-sdk:37 を作っておく。
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
cache=${KIKITORI_ANDROID_CACHE:-$HOME/.cache}
mkdir -p "$cache/kikitori-gradle" "$cache/kikitori-android-home"
docker run --rm --user "$(id -u):$(id -g)" \
  -e HOME=/android-home -e GRADLE_USER_HOME=/gradle-home \
  -e KIKITORI_DEBUG_KEYSTORE=/android-home/debug.keystore \
  -v "$cache/kikitori-gradle:/gradle-home" -v "$cache/kikitori-android-home:/android-home" \
  -v "$here:/src" -w /src kikitori-android-sdk:37 \
  ./gradlew "${1:-assembleDebug}" --no-daemon -q
