#if os(macOS)
import AppKit
import SwiftUI

/// 小窓に出すもの。主の糸から変える。
final class DictationPanelModel: ObservableObject {
    @Published var status = ""
    @Published var listening = false
    @Published var committedText = ""
    @Published var partialText = ""
    @Published var level: Float = 0
    // 清書を待っている区切りより先に、次の区切りの途中結果が届くことがある。どの区切りの途中結果かを持つ
    var partialSegment = -1
    var onStop: () -> Void = {}
    var onCancel: () -> Void = {}

    // 小窓に出す文の長さ。長い入力でも直近の内容だけ見えればよい
    static let transcriptTailCharacters = 80

    func reset() {
        committedText = ""
        partialText = ""
        partialSegment = -1
        level = 0
    }
}

/// 管理画面と同じ色（黒の面 #141414・線 #2A2A2A・文字 #EDEDED・マイクの印は紫の傾き）。
private enum PanelColor {
    static let surface = Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255).opacity(0.97)
    static let border = Color(red: 0x2A / 255, green: 0x2A / 255, blue: 0x2A / 255)
    static let text = Color(red: 0xED / 255, green: 0xED / 255, blue: 0xED / 255)
    static let muted = Color(red: 0x8F / 255, green: 0x8F / 255, blue: 0x8F / 255)
    static let idle = Color(red: 0x3A / 255, green: 0x3A / 255, blue: 0x3A / 255)
    static let accent = Color(red: 0x8B / 255, green: 0x5C / 255, blue: 0xF6 / 255)
    static let accentDeep = Color(red: 0x63 / 255, green: 0x66 / 255, blue: 0xF1 / 255)
}

struct DictationPanelView: View {
    @ObservedObject var model: DictationPanelModel

    var body: some View {
        HStack(spacing: 12) {
            Button(action: model.onStop) {
                ZStack {
                    Circle()
                        .fill(PanelColor.accent.opacity(0.25))
                        .frame(width: 48, height: 48)
                        .scaleEffect(model.listening ? 0.75 + CGFloat(model.level) * 0.25 : 0.75)
                    Circle()
                        .fill(model.listening
                            ? AnyShapeStyle(LinearGradient(colors: [PanelColor.accent, PanelColor.accentDeep], startPoint: .topLeading, endPoint: .bottomTrailing))
                            : AnyShapeStyle(PanelColor.idle))
                        .frame(width: 36, height: 36)
                    Image(systemName: "mic.fill").font(.system(size: 15)).foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .help(UiText.stop)

            VStack(alignment: .leading, spacing: 2) {
                Text(model.status).font(.system(size: 12)).foregroundStyle(PanelColor.muted)
                transcript.font(.system(size: 14)).lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: model.onCancel) {
                Image(systemName: "xmark").font(.system(size: 12, weight: .medium)).foregroundStyle(PanelColor.text.opacity(0.7))
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .help(UiText.cancel)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(width: 520)
        .background(RoundedRectangle(cornerRadius: 12).fill(PanelColor.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(PanelColor.border, lineWidth: 1))
    }

    private var transcript: Text {
        let tail = DictationPanelModel.transcriptTailCharacters
        let partial = String(model.partialText.suffix(tail))
        let committed = String(model.committedText.suffix(max(0, tail - partial.count)))
        return Text(committed).foregroundColor(PanelColor.text) + Text(partial).foregroundColor(PanelColor.muted)
    }
}

/// 画面の下の中央に出る小窓。前面のアプリからフォーカスを奪わない（nonactivatingPanel）ので、文字は元の入力欄へ入り続ける。
final class DictationPanel: NSPanel {
    // 画面の下端（Dock の上）から小窓までの間
    private static let bottomMargin: CGFloat = 32
    private static let hideDelay: TimeInterval = 1.2
    // エラーは読めるように長めに出す
    private static let errorHideDelay: TimeInterval = 4

    let model = DictationPanelModel()
    private var hideWork: DispatchWorkItem?

    init() {
        super.init(contentRect: NSRect(x: 0, y: 0, width: 520, height: 80), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        isFloatingPanel = true
        level = .statusBar
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let hosting = NSHostingView(rootView: DictationPanelView(model: model))
        hosting.setFrameSize(hosting.fittingSize)
        contentView = hosting
        setContentSize(hosting.fittingSize)
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    func showConnecting() {
        hideWork?.cancel()
        model.reset()
        model.status = UiText.connecting
        model.listening = false
        placeAtBottomCenter()
        orderFrontRegardless()
    }

    func showListening() {
        model.status = UiText.listening
        model.listening = true
    }

    func showFinishing() {
        model.status = UiText.finishing
        model.listening = false
        model.level = 0
    }

    func showPartial(segment: Int, text: String) {
        model.partialSegment = segment
        model.partialText = text
    }

    func showCommitted(segment: Int, text: String) {
        model.committedText += text
        if model.partialSegment <= segment {
            model.partialText = ""
        }
    }

    func showFinished(_ status: String) {
        model.status = status
        model.listening = false
        model.level = 0
        hide(after: Self.hideDelay)
    }

    func showError(_ message: String) {
        if !isVisible {
            placeAtBottomCenter()
            orderFrontRegardless()
        }
        model.status = message
        model.listening = false
        hide(after: Self.errorHideDelay)
    }

    private func hide(after delay: TimeInterval) {
        hideWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.orderOut(nil) }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func placeAtBottomCenter() {
        let screen = NSScreen.screens.first { $0.frame.contains(NSEvent.mouseLocation) } ?? NSScreen.main
        guard let area = screen?.visibleFrame else { return }
        let size = contentView?.fittingSize ?? frame.size
        setFrame(NSRect(x: area.midX - size.width / 2, y: area.minY + Self.bottomMargin, width: size.width, height: size.height), display: true)
    }
}
#endif
