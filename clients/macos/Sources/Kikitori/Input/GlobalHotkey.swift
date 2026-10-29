#if os(macOS)
import Carbon
import Foundation
import KikitoriCore

/// どのアプリが前面にあっても効くショートカット（Carbon の RegisterEventHotKey。アクセシビリティの許可は要らない）。
final class GlobalHotkey {
    // "KKTR"
    private static let signature: OSType = 0x4B4B_5452

    var onPressed: (() -> Void)?
    private var hotKeyReference: EventHotKeyRef?
    private var handlerReference: EventHandlerRef?

    init() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let context = Unmanaged.passUnretained(self).toOpaque()
        InstallEventHandler(GetApplicationEventTarget(), { _, _, context in
            guard let context else { return noErr }
            let hotkey = Unmanaged<GlobalHotkey>.fromOpaque(context).takeUnretainedValue()
            DispatchQueue.main.async { hotkey.onPressed?() }
            return noErr
        }, 1, &eventType, context, &handlerReference)
    }

    /// 登録できなければ（ほかのアプリが使っている・書き方が違う）false。
    func register(_ hotkey: Hotkey) -> Bool {
        unregister()
        guard let keyCode = Self.virtualKeyCodes[hotkey.key] else { return false }
        var modifiers: UInt32 = 0
        if hotkey.modifiers.contains(.control) { modifiers |= UInt32(controlKey) }
        if hotkey.modifiers.contains(.option) { modifiers |= UInt32(optionKey) }
        if hotkey.modifiers.contains(.shift) { modifiers |= UInt32(shiftKey) }
        if hotkey.modifiers.contains(.command) { modifiers |= UInt32(cmdKey) }
        let identifier = EventHotKeyID(signature: Self.signature, id: 1)
        return RegisterEventHotKey(UInt32(keyCode), modifiers, identifier, GetApplicationEventTarget(), 0, &hotKeyReference) == noErr
    }

    private func unregister() {
        if let hotKeyReference {
            UnregisterEventHotKey(hotKeyReference)
            self.hotKeyReference = nil
        }
    }

    /// Hotkey の key（"Space"・"A"〜"Z"・"0"〜"9"）から、キー配列に依らないキーの番号へ。
    private static let virtualKeyCodes: [String: Int] = {
        var codes: [String: Int] = ["Space": kVK_Space]
        let letters: [(String, Int)] = [
            ("A", kVK_ANSI_A), ("B", kVK_ANSI_B), ("C", kVK_ANSI_C), ("D", kVK_ANSI_D), ("E", kVK_ANSI_E), ("F", kVK_ANSI_F),
            ("G", kVK_ANSI_G), ("H", kVK_ANSI_H), ("I", kVK_ANSI_I), ("J", kVK_ANSI_J), ("K", kVK_ANSI_K), ("L", kVK_ANSI_L),
            ("M", kVK_ANSI_M), ("N", kVK_ANSI_N), ("O", kVK_ANSI_O), ("P", kVK_ANSI_P), ("Q", kVK_ANSI_Q), ("R", kVK_ANSI_R),
            ("S", kVK_ANSI_S), ("T", kVK_ANSI_T), ("U", kVK_ANSI_U), ("V", kVK_ANSI_V), ("W", kVK_ANSI_W), ("X", kVK_ANSI_X),
            ("Y", kVK_ANSI_Y), ("Z", kVK_ANSI_Z),
            ("0", kVK_ANSI_0), ("1", kVK_ANSI_1), ("2", kVK_ANSI_2), ("3", kVK_ANSI_3), ("4", kVK_ANSI_4),
            ("5", kVK_ANSI_5), ("6", kVK_ANSI_6), ("7", kVK_ANSI_7), ("8", kVK_ANSI_8), ("9", kVK_ANSI_9),
        ]
        for (name, code) in letters { codes[name] = code }
        return codes
    }()
}
#endif
