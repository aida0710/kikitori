import Foundation

/// サーバーから届く知らせ。形は docs/dictation-protocol.md。
public enum DictationEvent: Equatable {
    case ready(dictationId: Int)
    case partial(segment: Int, text: String)
    case segment(segment: Int, raw: String, text: String, corrected: Bool)
    case end(text: String, cancelled: Bool)
    case error(code: String, message: String)

    private struct Wire: Decodable {
        let type: String
        let dictationId: Int?
        let segment: Int?
        let raw: String?
        let text: String?
        let corrected: Bool?
        let cancelled: Bool?
        let code: String?
        let message: String?
    }

    /// 知らない種類や壊れた JSON は nil（新しいサーバーが種類を足しても止まらないように）。
    public static func parse(_ data: Data) -> DictationEvent? {
        guard let wire = try? JSONDecoder().decode(Wire.self, from: data) else { return nil }
        switch wire.type {
        case "ready":
            return .ready(dictationId: wire.dictationId ?? 0)
        case "partial":
            return .partial(segment: wire.segment ?? 0, text: wire.text ?? "")
        case "segment":
            return .segment(segment: wire.segment ?? 0, raw: wire.raw ?? "", text: wire.text ?? "", corrected: wire.corrected ?? false)
        case "end":
            return .end(text: wire.text ?? "", cancelled: wire.cancelled ?? false)
        case "error":
            return .error(code: wire.code ?? "", message: wire.message ?? "")
        default:
            return nil
        }
    }
}

/// 最初に送る start の知らせ。
public func dictationStartMessage(correction: Bool) -> String {
    let body: [String: Any] = ["type": "start", "client": "macos", "correction": correction]
    let data = try! JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
    return String(decoding: data, as: UTF8.self)
}
