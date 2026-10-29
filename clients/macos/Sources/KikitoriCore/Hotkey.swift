import Foundation

/// "Shift+Option+Space" のような書き方のショートカット。
public struct Hotkey: Equatable {
    public enum Modifier: String, CaseIterable {
        case control, option, shift, command
    }

    // macOS の既定で ⌃Space・⌃⌥Space は入力ソースの切り替え、⌘Space は Spotlight なので避ける
    public static let defaultText = "Shift+Option+Space"

    public let modifiers: Set<Modifier>
    /// "Space"・"A"〜"Z"・"0"〜"9"
    public let key: String

    public init?(_ text: String) {
        var modifiers = Set<Modifier>()
        var key: String?
        for part in text.split(separator: "+").map({ $0.trimmingCharacters(in: .whitespaces).lowercased() }) where !part.isEmpty {
            switch part {
            case "ctrl", "control": modifiers.insert(.control)
            case "alt", "option", "opt": modifiers.insert(.option)
            case "shift": modifiers.insert(.shift)
            case "cmd", "command": modifiers.insert(.command)
            case "space": key = "Space"
            default:
                guard part.count == 1, let character = part.uppercased().first, character.isLetter || character.isNumber else { return nil }
                key = String(character)
            }
        }
        guard let key, !modifiers.isEmpty else { return nil }
        self.modifiers = modifiers
        self.key = key
    }
}
