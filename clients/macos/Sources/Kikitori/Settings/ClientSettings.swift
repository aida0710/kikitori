#if os(macOS)
import Foundation
import KikitoriCore

/// 端末の設定。UserDefaults に置く。アクセスキーはここに置かず、キーチェーンに置く。
struct ClientSettings {
    // 話し終えたあと、これだけ声が無ければ自動で止める（Windows・Android と同じ）
    static let defaultAutoStopSeconds = 8

    var serverURL: String
    var hotkey: String
    var autoStopSeconds: Int
    var correction: Bool

    private enum Key {
        static let serverURL = "serverURL"
        static let hotkey = "hotkey"
        static let autoStopSeconds = "autoStopSeconds"
        static let correction = "correction"
    }

    static func load() -> ClientSettings {
        let defaults = UserDefaults.standard
        return ClientSettings(
            serverURL: defaults.string(forKey: Key.serverURL) ?? "",
            hotkey: defaults.string(forKey: Key.hotkey) ?? Hotkey.defaultText,
            autoStopSeconds: defaults.object(forKey: Key.autoStopSeconds) as? Int ?? defaultAutoStopSeconds,
            correction: defaults.object(forKey: Key.correction) as? Bool ?? true
        )
    }

    func save() {
        let defaults = UserDefaults.standard
        defaults.set(serverURL, forKey: Key.serverURL)
        defaults.set(hotkey, forKey: Key.hotkey)
        defaults.set(autoStopSeconds, forKey: Key.autoStopSeconds)
        defaults.set(correction, forKey: Key.correction)
    }

    var serverAddress: ServerAddress? { ServerAddress(serverURL) }
}
#endif
