import Foundation

/// 利用者が入れたサーバーの URL（"http://10.0.10.178:8780" など）から、API の場所を作る。
public struct ServerAddress: Equatable {
    public let base: URL

    public init?(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(),
              ["http", "https"].contains(scheme), url.host != nil else { return nil }
        base = url
    }

    /// 音声入力の WebSocket。http は ws、https は wss にする。
    public var dictationURL: URL {
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.scheme = components.scheme?.lowercased() == "https" ? "wss" : "ws"
        components.path = trimmedPath + "/v1/dictation"
        return components.url!
    }

    /// 接続を試すときに呼ぶ、ログインしている利用者の API。
    public var meURL: URL {
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.path = trimmedPath + "/api/me"
        return components.url!
    }

    private var trimmedPath: String {
        var path = URLComponents(url: base, resolvingAgainstBaseURL: false)?.path ?? ""
        while path.hasSuffix("/") { path.removeLast() }
        return path
    }
}
