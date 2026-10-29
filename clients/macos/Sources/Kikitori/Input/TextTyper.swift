#if os(macOS)
import ApplicationServices
import CoreGraphics

/// 文字を、いま前面にあるアプリへキー入力（CGEvent の Unicode の文字列）として送る。
/// 送るにはアクセシビリティの許可が要る（無いと macOS が黙って捨てる）。
/// 日本語の入力中だと文字が入力メソッドに取り込まれるので、呼ぶ側は先に InputSourceSuspension で英字の入力にしておく。
enum TextTyper {
    static var isTrusted: Bool { AXIsProcessTrusted() }

    /// 許可が無ければ、システム設定のアクセシビリティを開くよう求める画面を出す。
    static func requestTrust() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    static func type(_ text: String) {
        let source = CGEventSource(stateID: .hidSystemState)
        // 改行は送らない（チャットのアプリでは Return で送信されてしまうため）
        for character in text where !character.isNewline {
            // 1 文字（サロゲートペアや結合文字を含む書記素）を 1 回のキー入力で送る。複数文字をまとめると取りこぼすアプリがある
            var units = Array(String(character).utf16)
            for keyDown in [true, false] {
                let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: keyDown)
                event?.flags = []
                event?.keyboardSetUnicodeString(stringLength: units.count, unicodeString: &units)
                event?.post(tap: .cghidEventTap)
            }
        }
    }
}
#endif
