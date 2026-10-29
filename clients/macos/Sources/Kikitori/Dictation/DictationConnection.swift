#if os(macOS)
import Foundation
import KikitoriCore

/// 1 回の音声入力の WebSocket（/v1/dictation）。URLSession は接続前に送ったものも並べておき、接続しだい順に送る。
final class DictationConnection {
    private let task: URLSessionWebSocketTask
    private let onEvent: (DictationEvent) -> Void
    private let onFailure: (Error) -> Void

    init(url: URL, accessKey: String, onEvent: @escaping (DictationEvent) -> Void, onFailure: @escaping (Error) -> Void) {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessKey)", forHTTPHeaderField: "Authorization")
        task = URLSession.shared.webSocketTask(with: request)
        self.onEvent = onEvent
        self.onFailure = onFailure
    }

    func start(correction: Bool) {
        task.resume()
        send(.string(dictationStartMessage(correction: correction)))
        receiveNext()
    }

    func sendAudio(_ pcm: Data) {
        send(.data(pcm))
    }

    func stop() {
        send(.string(#"{"type":"stop"}"#))
    }

    func cancel() {
        send(.string(#"{"type":"cancel"}"#))
    }

    func close() {
        task.cancel(with: .normalClosure, reason: nil)
    }

    private func send(_ message: URLSessionWebSocketTask.Message) {
        task.send(message) { [weak self] error in
            if let error { self?.onFailure(error) }
        }
    }

    private func receiveNext() {
        task.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(.string(let text)):
                if let event = DictationEvent.parse(Data(text.utf8)) { self.onEvent(event) }
                self.receiveNext()
            case .success:
                self.receiveNext()
            case .failure(let error):
                // サーバーが end のあとに閉じたときもここに来る。呼ぶ側は end を受け取っていれば無視する
                self.onFailure(error)
            }
        }
    }
}
#endif
