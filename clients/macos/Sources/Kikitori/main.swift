// Mac 版の入口。メニューバーに常駐する（Dock には出さない）。
//
// 試験用の引数:
//   --wav <16kHz・モノラル・16bit の WAV>  マイクの代わりに WAV を流す
//   --start                               起動してすぐ音声入力を始める
//   --exit-after-dictation                1 回の音声入力が終わったら終了する
//   --show-panel-demo                     小窓を見本の文で 6 秒出して終了する（見た目の確認用）
//   --show-settings-demo                  設定画面を 6 秒出して終了する（見た目の確認用）
#if os(macOS)
import AppKit

let application = NSApplication.shared
let applicationDelegate = AppDelegate(arguments: CommandLine.arguments)
application.delegate = applicationDelegate
application.setActivationPolicy(.accessory)
application.run()
#else
fatalError("Kikitori for Mac runs only on macOS")
#endif
