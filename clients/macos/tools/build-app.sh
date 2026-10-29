#!/usr/bin/env bash
# Mac 版を組み立てて、Kikitori.app と zip を build/ に作る（macOS で実行する。Apple Silicon と Intel の両方で動く形）。
#   tools/build-app.sh <版>
set -euo pipefail
version=${1:?version}
here=$(cd "$(dirname "$0")/.." && pwd)
cd "$here"
swift build -c release --arch arm64 --arch x86_64
binary="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/Kikitori"
app=build/Kikitori.app
rm -rf build && mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$binary" "$app/Contents/MacOS/Kikitori"
sed "s/__VERSION__/$version/g" Resources/Info.plist > "$app/Contents/Info.plist"
# 署名は自分で作った印（ad-hoc）だけ。初回は Finder で右クリック →「開く」で起動する
codesign --force --sign - "$app"
ditto -c -k --keepParent "$app" build/Kikitori-macos.zip
echo "built $app"
