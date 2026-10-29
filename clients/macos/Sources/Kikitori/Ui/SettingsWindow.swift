#if os(macOS)
import AppKit
import KikitoriCore
import SwiftUI

/// サーバーの URL・アクセスキー・ショートカットなどを入れる画面と、アクセシビリティの許可の状態。
final class SettingsWindowController: NSWindowController {
    init(onSaved: @escaping (ClientSettings) -> Void) {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 460, height: 420), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = UiText.settingsTitle
        window.isReleasedWhenClosed = false
        super.init(window: window)
        let form = NSHostingView(rootView: SettingsForm(initial: ClientSettings.load()) { [weak self] saved in
            onSaved(saved)
            self?.close()
        })
        window.contentView = form
        // 窓の高さを中身に合わせる（決め打ちの高さだと、下に空きが出る）
        window.setContentSize(form.fittingSize)
        window.center()
    }

    required init?(coder: NSCoder) {
        fatalError("not used")
    }

    func present() {
        NSApp.activate(ignoringOtherApps: true)
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }
}

private struct SettingsForm: View {
    @State private var serverURL: String
    @State private var accessKey = ""
    @State private var hotkey: String
    @State private var autoStopSeconds: String
    @State private var correction: Bool
    @State private var message: String?
    @State private var messageIsError = false
    @State private var accessibilityAllowed = TextTyper.isTrusted
    let onSaved: (ClientSettings) -> Void

    init(initial: ClientSettings, onSaved: @escaping (ClientSettings) -> Void) {
        _serverURL = State(initialValue: initial.serverURL)
        _hotkey = State(initialValue: initial.hotkey)
        _autoStopSeconds = State(initialValue: String(initial.autoStopSeconds))
        _correction = State(initialValue: initial.correction)
        self.onSaved = onSaved
    }

    var body: some View {
        Form {
            TextField(UiText.serverURL, text: $serverURL, prompt: Text("http://10.0.10.178:8780"))
            SecureField(UiText.accessKey, text: $accessKey, prompt: Text(UiText.accessKeyKeep))
            TextField(UiText.hotkey, text: $hotkey)
            TextField(UiText.autoStop, text: $autoStopSeconds)
            Toggle(UiText.correction, isOn: $correction)
            LabeledContent(UiText.accessibility) {
                if accessibilityAllowed {
                    Text(UiText.accessibilityAllowed)
                } else {
                    Button(UiText.accessibilityOpen) {
                        TextTyper.requestTrust()
                        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!)
                    }
                }
            }
            if let message {
                Text(message).foregroundStyle(messageIsError ? Color.red : Color.green)
            }
            HStack {
                Spacer()
                Button(UiText.test) { Task { await testConnection() } }
                Button(UiText.save) { save() }.keyboardShortcut(.defaultAction)
            }
        }
        .formStyle(.grouped)
        // 項目は少ないので、スクロールさせずに中身の高さの窓にする
        .scrollDisabled(true)
        .fixedSize(horizontal: false, vertical: true)
        .padding(8)
        .frame(width: 460)
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            // システム設定で許可したら、画面を開いたままでも表示を変える
            accessibilityAllowed = TextTyper.isTrusted
        }
    }

    private func readForm() -> Result<ClientSettings, ValidationFailure> {
        guard ServerAddress(serverURL) != nil else { return .failure(ValidationFailure(UiText.serverURL)) }
        guard Hotkey(hotkey) != nil else { return .failure(ValidationFailure(UiText.hotkey)) }
        guard let seconds = Int(autoStopSeconds), seconds >= 2 else { return .failure(ValidationFailure(UiText.autoStop)) }
        return .success(ClientSettings(serverURL: serverURL.trimmingCharacters(in: .whitespaces), hotkey: hotkey, autoStopSeconds: seconds, correction: correction))
    }

    private func save() {
        switch readForm() {
        case .failure(let failure):
            show(UiText.invalid(failure.field), isError: true)
        case .success(let settings):
            settings.save()
            if !accessKey.isEmpty { AccessKeyStore.write(accessKey.trimmingCharacters(in: .whitespaces)) }
            onSaved(settings)
        }
    }

    private func testConnection() async {
        guard case .success(let settings) = readForm(), let address = settings.serverAddress else {
            show(UiText.invalid(UiText.serverURL), isError: true)
            return
        }
        var request = URLRequest(url: address.meURL, timeoutInterval: 10)
        let key = accessKey.isEmpty ? (AccessKeyStore.read() ?? "") : accessKey.trimmingCharacters(in: .whitespaces)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            if (response as? HTTPURLResponse)?.statusCode == 200 {
                show(UiText.connectedAs(body?["username"] as? String ?? ""), isError: false)
            } else {
                // サーバーの文をそのまま出す
                show(body?["error"] as? String ?? String(decoding: data, as: UTF8.self), isError: true)
            }
        } catch {
            show("\(UiText.connectionFailed): \(error.localizedDescription)", isError: true)
        }
    }

    private func show(_ text: String, isError: Bool) {
        message = text
        messageIsError = isError
    }
}

private struct ValidationFailure: Error {
    let field: String
    init(_ field: String) { self.field = field }
}
#endif
