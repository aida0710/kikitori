#if os(macOS)
import AppKit
import KikitoriCore

/// 常駐の入口。メニューバーに居て、ショートカットで小窓を出して音声入力を始める（Windows 版の App と同じ役目）。
final class AppDelegate: NSObject, NSApplicationDelegate {
    private static let logURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/Kikitori/kikitori.log")
    // 見た目の確認用の見本の小窓を出しておく時間
    private static let panelDemoSeconds: TimeInterval = 6

    private let arguments: [String]
    private var statusItem: NSStatusItem?
    private let panel = DictationPanel()
    private let hotkey = GlobalHotkey()
    private var controller: DictationController!
    private var settingsWindow: SettingsWindowController?
    private var startItem: NSMenuItem?

    init(arguments: [String]) {
        self.arguments = arguments
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if arguments.contains("--show-panel-demo") {
            showPanelDemo()
            return
        }
        let wavPath = argument(after: "--wav")
        controller = DictationController(
            panel: panel,
            createAudioSource: { wavPath.map { WavFileSource(url: URL(fileURLWithPath: $0)) } ?? MicrophoneSource() },
            log: Self.log
        )
        controller.onNeedsSettings = { [weak self] in self?.openSettings() }
        if arguments.contains("--exit-after-dictation") {
            controller.onFinished = { DispatchQueue.main.asyncAfter(deadline: .now() + 2) { NSApp.terminate(nil) } }
        }
        setUpStatusItem()
        hotkey.onPressed = { [weak self] in self?.controller.toggle() }
        registerHotkey(ClientSettings.load())

        let settings = ClientSettings.load()
        if settings.serverAddress == nil || AccessKeyStore.read() == nil {
            openSettings()
        } else if arguments.contains("--start") {
            controller.toggle()
        }
    }

    private func argument(after flag: String) -> String? {
        guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else { return nil }
        return arguments[index + 1]
    }

    private func setUpStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = NSImage(systemSymbolName: "mic.fill", accessibilityDescription: "Kikitori")
        let menu = NSMenu()
        let start = NSMenuItem(title: "", action: #selector(toggleDictation), keyEquivalent: "")
        start.target = self
        menu.addItem(start)
        let settings = NSMenuItem(title: UiText.menuSettings, action: #selector(openSettings), keyEquivalent: ",")
        settings.target = self
        menu.addItem(settings)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: UiText.menuQuit, action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quit)
        item.menu = menu
        statusItem = item
        startItem = start
    }

    private func registerHotkey(_ settings: ClientSettings) {
        startItem?.title = UiText.menuStart(settings.hotkey)
        guard let parsed = Hotkey(settings.hotkey), hotkey.register(parsed) else {
            Self.log("hotkey \(settings.hotkey) is not available")
            panel.showError(UiText.hotkeyTaken(settings.hotkey))
            return
        }
    }

    @objc private func toggleDictation() {
        controller.toggle()
    }

    @objc private func openSettings() {
        if settingsWindow == nil {
            settingsWindow = SettingsWindowController { [weak self] saved in
                self?.registerHotkey(saved)
            }
        }
        settingsWindow?.present()
    }

    /// 見た目の確認用。見本の文で小窓を出して、少し待って終わる（CI で画面を撮る）。
    private func showPanelDemo() {
        panel.showConnecting()
        panel.showListening()
        panel.model.level = 0.6
        panel.showCommitted(segment: 0, text: "明日の打ち合わせは十時からに変更します。")
        panel.showPartial(segment: 1, text: "資料は前日までに")
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.panelDemoSeconds) { NSApp.terminate(nil) }
    }

    private static func log(_ message: String) {
        let directory = logURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
        if let handle = try? FileHandle(forWritingTo: logURL) {
            handle.seekToEndOfFile()
            handle.write(Data(line.utf8))
            try? handle.close()
        } else {
            try? Data(line.utf8).write(to: logURL)
        }
    }
}
#endif
