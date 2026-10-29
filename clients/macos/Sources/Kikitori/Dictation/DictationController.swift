#if os(macOS)
import AVFoundation
import Foundation
import KikitoriCore

/// 音声入力の状態（待機 → 聞いている → 清書を待つ → 待機）を進める。Windows 版の DictationController と同じ流れ。
/// 話している間は、文字起こしの結果を小窓にだけ出す。話し終えたら、清書した全文を前面のアプリへ一度に打つ
/// （取り消したときは打たない）。打った文を消して直すと崩れるアプリがあるので、打つのは 1 回だけにする。どれも主の糸で動かす。
final class DictationController {
    private enum State { case idle, listening, finishing }

    private static let autoStopCheckInterval: TimeInterval = 1
    // 清書した全文を打ってから入力ソースを戻すまでの間。打った文字をアプリが受け取り終えるのを待つ
    // （終わったことを知る手段が無いので時間で待つ。小窓が消えるのと同じ頃）
    private static let inputSourceResumeDelay: TimeInterval = 1

    private let panel: DictationPanel
    private let createAudioSource: () -> AudioSource
    private let log: (String) -> Void
    private var state = State.idle
    private var connection: DictationConnection?
    private var audio: AudioSource?
    private var inputSourceSuspension: InputSourceSuspension?
    private var lastActivity = Date()
    private var autoStopAfter: TimeInterval = 8
    private var autoStopTimer: Timer?

    var onFinished: () -> Void = {}
    var onNeedsSettings: () -> Void = {}

    init(panel: DictationPanel, createAudioSource: @escaping () -> AudioSource, log: @escaping (String) -> Void) {
        self.panel = panel
        self.createAudioSource = createAudioSource
        self.log = log
        panel.model.onStop = { [weak self] in self?.toggle() }
        panel.model.onCancel = { [weak self] in self?.cancel() }
    }

    func toggle() {
        switch state {
        case .idle: start()
        case .listening: stop()
        case .finishing: break
        }
    }

    private func start() {
        let settings = ClientSettings.load()
        guard let address = settings.serverAddress, let accessKey = AccessKeyStore.read(), !accessKey.isEmpty else {
            panel.showError(UiText.noAccessKey)
            onNeedsSettings()
            return
        }
        guard TextTyper.isTrusted else {
            panel.showError(UiText.accessibilityMissing)
            TextTyper.requestTrust()
            return
        }
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
            DispatchQueue.main.async {
                guard let self else { return }
                if granted {
                    self.begin(settings: settings, address: address, accessKey: accessKey)
                } else {
                    self.panel.showError(UiText.microphoneDenied)
                }
            }
        }
    }

    private func begin(settings: ClientSettings, address: ServerAddress, accessKey: String) {
        guard state == .idle else { return }
        state = .listening
        autoStopAfter = TimeInterval(settings.autoStopSeconds)
        lastActivity = Date()
        panel.showConnecting()

        var current: DictationConnection!
        current = DictationConnection(
            url: address.dictationURL,
            accessKey: accessKey,
            onEvent: { [weak self] event in DispatchQueue.main.async { self?.handle(event, from: current) } },
            onFailure: { [weak self] error in DispatchQueue.main.async { self?.fail(current, UiText.connectionFailed, error) } }
        )
        connection = current
        // 接続を待たずに録音を始める（話し始めを取りこぼさないため。送ったものは URLSession が並べておく）
        let source = createAudioSource()
        audio = source
        do {
            try source.start { [weak self] pcm, level in
                current.sendAudio(pcm)
                DispatchQueue.main.async { if self?.connection === current { self?.panel.model.level = level } }
            }
        } catch {
            fail(current, UiText.microphoneFailed, error)
            return
        }
        // 打つのは話し終えたあとなので、録音を始めてから入力ソースを切り替えても間に合う
        inputSourceSuspension = InputSourceSuspension.suspendIfNeeded(log: log)
        current.start(correction: settings.correction)
        autoStopTimer = Timer.scheduledTimer(withTimeInterval: Self.autoStopCheckInterval, repeats: true) { [weak self] _ in
            self?.stopIfSilent()
        }
    }

    private func stop() {
        guard state == .listening, let connection else { return }
        state = .finishing
        autoStopTimer?.invalidate()
        audio?.stop()
        connection.stop()
        panel.showFinishing()
    }

    private func cancel() {
        guard state != .idle, let connection else {
            panel.orderOut(nil)
            return
        }
        connection.cancel()
        finish(connection, status: UiText.cancelled)
    }

    private func stopIfSilent() {
        if state == .listening, Date().timeIntervalSince(lastActivity) > autoStopAfter {
            log("auto stop after silence")
            stop()
        }
    }

    private func handle(_ event: DictationEvent, from source: DictationConnection) {
        guard source === connection else { return }
        switch event {
        case .ready(let dictationId):
            log("ready dictation=\(dictationId)")
            panel.showListening()
        case .partial(let segment, let text):
            lastActivity = Date()
            panel.showPartial(segment: segment, text: text)
        case .segment(let segment, let text):
            lastActivity = Date()
            log("segment \(segment) text=\(text)")
            panel.showCommitted(segment: segment, text: text)
        case .error(let code, let message):
            log("error \(code): \(message)")
            panel.showError(message)
        case .end(let text, let corrected, let cancelled):
            log("end cancelled=\(cancelled) corrected=\(corrected) text=\(text)")
            if !cancelled {
                panel.showFinalText(text)
                TextTyper.type(text)
            }
            finish(source, status: cancelled ? UiText.cancelled : UiText.done)
        }
    }

    private func fail(_ source: DictationConnection, _ message: String, _ error: Error) {
        guard source === connection else { return }
        log("\(message): \(error.localizedDescription)")
        panel.showError(message)
        finish(source, status: nil)
    }

    private func finish(_ source: DictationConnection, status: String?) {
        guard source === connection else { return }
        state = .idle
        autoStopTimer?.invalidate()
        audio?.stop()
        audio = nil
        connection = nil
        source.close()
        if let status { panel.showFinished(status) }
        let suspension = inputSourceSuspension
        inputSourceSuspension = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + (suspension == nil ? 0 : Self.inputSourceResumeDelay)) { [weak self] in
            suspension?.resume()
            self?.onFinished()
        }
    }
}
#endif
