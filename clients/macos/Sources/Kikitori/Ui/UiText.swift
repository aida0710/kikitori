#if os(macOS)
import Foundation

/// 画面の文言。Mac の言語の設定が日本語なら日本語、それ以外は英語。
enum UiText {
    private static let isJapanese = Locale.preferredLanguages.first?.hasPrefix("ja") ?? false

    private static func pick(_ japanese: String, _ english: String) -> String { isJapanese ? japanese : english }

    static var connecting: String { pick("接続しています…", "Connecting…") }
    static var listening: String { pick("聞いています", "Listening") }
    static var finishing: String { pick("清書しています…", "Polishing…") }
    static var done: String { pick("入力しました", "Done") }
    static var cancelled: String { pick("取り消しました", "Cancelled") }
    static var noAccessKey: String { pick("サーバーとアクセスキーを設定してください", "Set the server and access key") }
    static var connectionFailed: String { pick("サーバーにつながりません", "Cannot reach the server") }
    static var microphoneFailed: String { pick("マイクを使えません", "Cannot use the microphone") }
    static var microphoneDenied: String { pick("マイクが許可されていません（システム設定 → プライバシーとセキュリティ → マイク）", "Allow the microphone in System Settings → Privacy & Security → Microphone") }
    static var accessibilityMissing: String { pick("文字を入れるには、アクセシビリティでKikitoriを許可してください", "Allow Kikitori in Accessibility to type text") }
    static func hotkeyTaken(_ hotkey: String) -> String { pick("ショートカット \(hotkey) を使えません", "Cannot use the shortcut \(hotkey)") }

    static func menuStart(_ hotkey: String) -> String { pick("音声入力（\(hotkey)）", "Dictate (\(hotkey))") }
    static var menuSettings: String { pick("設定…", "Settings…") }
    static var menuQuit: String { pick("Kikitoriを終了", "Quit Kikitori") }

    static var settingsTitle: String { pick("Kikitoriの設定", "Kikitori settings") }
    static var serverURL: String { pick("サーバーのURL", "Server URL") }
    static var accessKey: String { pick("アクセスキー（管理画面で作ったもの）", "Access key (create it in the dashboard)") }
    static var accessKeyKeep: String { pick("空欄のままなら、保存済みのアクセスキーを使います", "Leave empty to keep the saved key") }
    static var hotkey: String { pick("ショートカット（例: Shift+Option+Space）", "Shortcut (e.g. Shift+Option+Space)") }
    static var autoStop: String { pick("声が無いときに自動で止めるまでの秒数", "Seconds of silence before stopping") }
    static var correction: String { pick("Claudeで清書する", "Polish with Claude") }
    static var accessibility: String { pick("アクセシビリティ", "Accessibility") }
    static var accessibilityAllowed: String { pick("許可済み", "Allowed") }
    static var accessibilityOpen: String { pick("システム設定を開く", "Open System Settings") }
    static var save: String { pick("保存", "Save") }
    static var test: String { pick("接続を試す", "Test connection") }
    static func connectedAs(_ username: String) -> String { pick("\(username)として接続できました", "Connected as \(username)") }
    static func invalid(_ reason: String) -> String { pick("保存できません: \(reason)", "Cannot save: \(reason)") }
    static var stop: String { pick("止める", "Stop") }
    static var cancel: String { pick("取り消す", "Cancel") }
}
#endif
