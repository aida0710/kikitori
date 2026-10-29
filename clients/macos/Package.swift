// swift-tools-version: 6.0
// Mac 版。KikitoriCore は Foundation だけで書き、Linux でも試験できるようにする。アプリ本体は macOS だけ
import PackageDescription

let package = Package(
    name: "Kikitori",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "KikitoriCore", swiftSettings: [.swiftLanguageMode(.v5)]),
        .executableTarget(name: "Kikitori", dependencies: ["KikitoriCore"], swiftSettings: [.swiftLanguageMode(.v5)]),
        .testTarget(name: "KikitoriCoreTests", dependencies: ["KikitoriCore"], swiftSettings: [.swiftLanguageMode(.v5)]),
    ]
)
