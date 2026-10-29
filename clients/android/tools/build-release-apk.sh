#!/usr/bin/env bash
# 配る版の APK を組み立てて、clients/Kikitori-android.apk に置く。使い方: tools/build-release-apk.sh
# 鍵は ~/.config/kikitori/ にある（android-release.env のパスワードと、android-release-keystore.b64 の鍵のファイル）。
# 鍵のファイルは組み立てる間だけ戻し、終わったら消す。
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
secrets=${KIKITORI_SECRETS_DIR:-$HOME/.config/kikitori}
cache=${KIKITORI_ANDROID_CACHE:-$HOME/.cache}
mkdir -p "$cache/kikitori-gradle" "$cache/kikitori-android-home"
keystore_dir=$(mktemp -d -p "$cache/kikitori-android-home")
trap 'rm -rf "$keystore_dir"' EXIT
chmod 700 "$keystore_dir"
base64 -d "$secrets/android-release-keystore.b64" > "$keystore_dir/release.p12"
# パスワードはコマンドの引数に出さず、--env-file で渡す
docker run --rm --user "$(id -u):$(id -g)" \
  -e HOME=/android-home -e GRADLE_USER_HOME=/gradle-home \
  -e KIKITORI_RELEASE_KEYSTORE="/android-home/$(basename "$keystore_dir")/release.p12" \
  --env-file "$secrets/android-release.env" \
  -v "$cache/kikitori-gradle:/gradle-home" -v "$cache/kikitori-android-home:/android-home" \
  -v "$here:/src" -w /src kikitori-android-sdk:37 \
  ./gradlew assembleRelease --no-daemon -q
cp "$here/app/build/outputs/apk/release/app-release.apk" "$here/../Kikitori-android.apk"
echo "built $(cd "$here/.." && pwd)/Kikitori-android.apk"
