import Foundation
import XCTest
@testable import KikitoriCore

final class KikitoriCoreTests: XCTestCase {
    func test区切りの知らせを読める() {
        let json = #"{"type":"segment","segment":2,"raw":"えー明日","text":"明日","corrected":true}"#
        XCTAssertEqual(DictationEvent.parse(Data(json.utf8)), .segment(segment: 2, raw: "えー明日", text: "明日", corrected: true))
    }

    func test知らない種類の知らせは無視する() {
        XCTAssertNil(DictationEvent.parse(Data(#"{"type":"something-new"}"#.utf8)))
        XCTAssertNil(DictationEvent.parse(Data("not json".utf8)))
    }

    func testHTTPのサーバーからWebSocketの場所を作る() {
        let address = ServerAddress("http://10.0.10.178:8780/")
        XCTAssertEqual(address?.dictationURL.absoluteString, "ws://10.0.10.178:8780/v1/dictation")
        XCTAssertEqual(address?.meURL.absoluteString, "http://10.0.10.178:8780/api/me")
        XCTAssertEqual(ServerAddress("https://example.com/kikitori")?.dictationURL.absoluteString, "wss://example.com/kikitori/v1/dictation")
    }

    func testURLでないものはサーバーとして受け付けない() {
        XCTAssertNil(ServerAddress("10.0.10.178:8780"))
        XCTAssertNil(ServerAddress("ftp://example.com"))
    }

    func testショートカットの書き方を読む() {
        XCTAssertEqual(Hotkey("Shift+Option+Space"), Hotkey("option + shift + space"))
        XCTAssertEqual(Hotkey("Ctrl+Cmd+K")?.key, "K")
        XCTAssertEqual(Hotkey("Ctrl+Cmd+K")?.modifiers, [.control, .command])
        XCTAssertNil(Hotkey("Space"), "修飾キーが無いショートカットは受け付けない")
        XCTAssertNil(Hotkey("Ctrl+F12"))
    }

    func test音声を100msずつに切り端数は次へ持ち越す() {
        var framer = PcmFramer()
        XCTAssertTrue(framer.append(Array(repeating: 1, count: 1000)).isEmpty)
        let frames = framer.append(Array(repeating: 2, count: 2400))
        XCTAssertEqual(frames.count, 2)
        XCTAssertEqual(frames[0].count, 1600)
        XCTAssertEqual(frames[0].first, 1)
        XCTAssertEqual(frames[1].last, 2)
    }

    func testフレームはリトルエンディアンで送る() {
        XCTAssertEqual([UInt8](PcmFramer.littleEndianData([0x0102, -2])), [0x02, 0x01, 0xFE, 0xFF])
    }

    func teststartの知らせ() {
        XCTAssertEqual(dictationStartMessage(correction: false), #"{"client":"macos","correction":false,"type":"start"}"#)
    }
}
