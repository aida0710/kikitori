#if os(macOS)
import Carbon
import Foundation

/// 音声入力の間だけ、入力ソースを英字（ABC など）にする。
///
/// 日本語の入力中（ひらがな）だと、送った文字が入力メソッドに取り込まれて変換されてしまう。Windows 版と同じく、
/// 始めるときに一度だけ英字にして、切り替わったことを確かめてから打ち、終わってから元の入力ソースへ戻す。
final class InputSourceSuspension {
    // 切り替わるのを待つ上限。ふつうはすぐ切り替わる。切り替わらなければ、そのまま打つ
    private static let switchConfirmLimit: TimeInterval = 0.6
    private static let switchConfirmPollInterval: TimeInterval = 0.015

    private let original: TISInputSource

    private init(original: TISInputSource) {
        self.original = original
    }

    /// 今の入力ソースで英字を直接打てないなら、英字の入力ソースに切り替えて、戻すためのものを返す。打てるなら nil。
    static func suspendIfNeeded(log: (String) -> Void) -> InputSourceSuspension? {
        guard let current = TISCopyCurrentKeyboardInputSource()?.takeRetainedValue(), !typesLatinDirectly(current) else {
            return nil
        }
        guard let latin = TISCopyCurrentASCIICapableKeyboardLayoutInputSource()?.takeRetainedValue() else { return nil }
        TISSelectInputSource(latin)
        let deadline = Date().addingTimeInterval(switchConfirmLimit)
        while let selected = TISCopyCurrentKeyboardInputSource()?.takeRetainedValue(), !typesLatinDirectly(selected) {
            if Date() > deadline {
                log("the input source did not switch in time")
                break
            }
            RunLoop.current.run(until: Date().addingTimeInterval(switchConfirmPollInterval))
        }
        return InputSourceSuspension(original: current)
    }

    func resume() {
        TISSelectInputSource(original)
    }

    /// キー配列（ABC・U.S. など）なら英字をそのまま打てる。入力メソッドの入力モード（ひらがな・カタカナなど）は打てない。
    private static func typesLatinDirectly(_ source: TISInputSource) -> Bool {
        guard let typePointer = TISGetInputSourceProperty(source, kTISPropertyInputSourceType) else { return false }
        let type = Unmanaged<CFString>.fromOpaque(typePointer).takeUnretainedValue() as String
        return type == (kTISTypeKeyboardLayout as String)
    }
}
#endif
