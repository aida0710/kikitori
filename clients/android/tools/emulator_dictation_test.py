#!/usr/bin/env python3
"""Android のエミュレーター（Docker のコンテナ）で、Gboard から Kikitori に切り替えて WAV を流し、入った文を確かめる。

  python3 tools/emulator_dictation_test.py --container kikitori-android-emulator \
      --apk /work/clients/android/app/build/outputs/apk/debug/app-debug.apk \
      --wav /work/artifacts/android/test.wav --key-file /work/artifacts/android/access-key \
      --server http://10.0.10.178:8780 --out artifacts/android/<日付>

パスの --apk・--wav・--key-file はコンテナの中から見た場所。アクセスキーは画面に出さない（文字数だけを見る）。
"""

from __future__ import annotations

import argparse
import re
import subprocess
import time
from pathlib import Path

PACKAGE = "io.github.aida0710.kikitori"
KIKITORI_IME = f"{PACKAGE}/.KikitoriInputMethodService"
GBOARD_IME = "com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME"
# 入力欄を押してから、キーボードが出てフォーカスが移るまでの間。短いと打った文字が前の欄に入る
FOCUS_SETTLE_SECONDS = 3
# input text で一度に送る文字数
INPUT_TEXT_CHUNK = 8


class Emulator:
    def __init__(self, container: str) -> None:
        self.container = container

    def shell(self, command: str, check: bool = True) -> str:
        result = subprocess.run(
            ["docker", "exec", self.container, "bash", "-lc", command],
            capture_output=True, text=True, check=check,
        )
        return result.stdout

    def adb(self, arguments: str, check: bool = True) -> str:
        return self.shell(f"adb {arguments}", check=check)

    def screenshot(self, path: Path) -> None:
        png = subprocess.run(
            ["docker", "exec", self.container, "bash", "-lc", "adb exec-out screencap -p"],
            capture_output=True, check=True,
        ).stdout
        path.write_bytes(png)

    def nodes(self) -> dict[str, dict[str, str]]:
        """画面の部品を resource-id ごとに返す（text・bounds・focused）。"""
        self.adb("shell uiautomator dump /sdcard/ui.xml", check=False)
        xml = self.adb("shell cat /sdcard/ui.xml")
        found: dict[str, dict[str, str]] = {}
        for node in re.findall(r"<node [^>]*>", xml):
            identifier = re.search(rf'resource-id="{PACKAGE}:id/([a-z_]+)"', node)
            if identifier:
                found[identifier.group(1)] = dict(re.findall(r'(\w[\w-]*)="([^"]*)"', node))
        return found

    def tap(self, resource_id: str) -> None:
        node = self.nodes()[resource_id]
        left, top, right, bottom = map(int, re.findall(r"\d+", node["bounds"]))
        self.adb(f"shell input tap {(left + right) // 2} {(top + bottom) // 2}")


def replace_text(emulator: Emulator, resource_id: str, text_command: str) -> None:
    emulator.tap(resource_id)
    time.sleep(FOCUS_SETTLE_SECONDS)
    emulator.adb("shell input keycombination 113 29")  # Ctrl+A
    emulator.adb("shell input keyevent 67")  # Delete
    # input text は、長い文を一度に送るとエミュレーターが文字を取りこぼすので、短く分けて送る
    emulator.shell(
        f'text="{text_command}"; '
        f'for i in $(seq 0 {INPUT_TEXT_CHUNK} $((${{#text}} - 1))); do '
        f'adb shell input text "${{text:$i:{INPUT_TEXT_CHUNK}}}"; done'
    )
    time.sleep(1)
    emulator.adb("shell input keyevent 4")  # キーボードを閉じる
    time.sleep(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", default="kikitori-android-emulator")
    parser.add_argument("--apk", required=True)
    parser.add_argument("--wav", required=True)
    parser.add_argument("--key-file", required=True)
    parser.add_argument("--server", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--dictation-seconds", type=int, default=45)
    arguments = parser.parse_args()
    out = Path(arguments.out)
    out.mkdir(parents=True, exist_ok=True)
    emulator = Emulator(arguments.container)

    emulator.adb(f"uninstall {PACKAGE}", check=False)
    emulator.adb(f"install {arguments.apk}")
    emulator.adb(f"shell pm grant {PACKAGE} android.permission.RECORD_AUDIO")
    time.sleep(2)
    emulator.adb(f"shell ime enable {KIKITORI_IME}")
    emulator.adb(f"shell ime set {GBOARD_IME}")
    files = f"/sdcard/Android/data/{PACKAGE}/files"
    emulator.adb(f"shell mkdir -p {files}")
    emulator.adb(f"push {arguments.wav} {files}/test.wav")

    emulator.adb(f"shell am start -n {PACKAGE}/.MainActivity")
    time.sleep(3)
    replace_text(emulator, "server_url_input", arguments.server)
    replace_text(emulator, "access_key_input", f"$(cat {arguments.key_file})")
    typed_key_length = len(emulator.nodes()["access_key_input"].get("text", ""))
    key_length = len(emulator.shell(f"cat {arguments.key_file}").strip())
    print(f"access key typed: {typed_key_length == key_length} ({typed_key_length}/{key_length} chars)")
    emulator.tap("save_button")
    time.sleep(1)
    emulator.tap("test_button")
    time.sleep(4)
    print("connection test:", emulator.nodes()["settings_message"].get("text"))

    # Gboard で試し入力の欄を開いてから Kikitori に切り替え、もう一度欄を押して面を出してもらう
    emulator.tap("try_input")
    time.sleep(FOCUS_SETTLE_SECONDS)
    emulator.screenshot(out / "1-gboard.png")
    emulator.adb(f"shell ime set {KIKITORI_IME}")
    time.sleep(1)
    emulator.tap("try_input")
    time.sleep(12)
    emulator.screenshot(out / "2-during.png")
    time.sleep(arguments.dictation_seconds - 12)
    emulator.screenshot(out / "3-after.png")
    current_ime = re.search(r"mCurId=(\S+)", emulator.adb("shell dumpsys input_method"))
    print("keyboard after dictation:", current_ime.group(1) if current_ime else None)
    print("typed text:", emulator.nodes()["try_input"].get("text"))


if __name__ == "__main__":
    main()
