#!/usr/bin/env bash
# Mac 版を組み立てて、Kikitori.app と zip を build/ に作る（macOS で実行する。Apple Silicon と Intel の両方で動く形）。
#   tools/build-app.sh <版>
set -euo pipefail
version=${1:?version}
here=$(cd "$(dirname "$0")/.." && pwd)
cd "$here"
# 2 つの向けを一度に組む --arch arm64 --arch x86_64 は、言語の版の設定（swiftLanguageMode）を受け付けないので、
# 向けごとに組んでから lipo で 1 つにする
binaries=()
for triple in arm64-apple-macosx14.0 x86_64-apple-macosx14.0; do
  swift build -c release --triple "$triple" --scratch-path ".build/$triple"
  binaries+=("$(swift build -c release --triple "$triple" --scratch-path ".build/$triple" --show-bin-path)/Kikitori")
done
app=build/Kikitori.app
rm -rf build && mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
lipo -create "${binaries[@]}" -output "$app/Contents/MacOS/Kikitori"
sed "s/__VERSION__/$version/g" Resources/Info.plist > "$app/Contents/Info.plist"
cp Resources/AppIcon.icns "$app/Contents/Resources/AppIcon.icns"
# 署名は自分で作った印（ad-hoc）だけ。初回はシステム設定の「プライバシーとセキュリティ」で「このまま開く」を押すか、
# xattr -dr com.apple.quarantine Kikitori.app で「ダウンロードしたもの」の印を外してから開く
codesign --force --sign - "$app"
ditto -c -k --keepParent "$app" build/Kikitori-macos.zip
echo "built $app"
