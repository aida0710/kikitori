import Foundation

/// 16kHz・モノラル・16bit の音声を、100ms（1600 サンプル）ずつのフレームに切る（端末と同じ大きさ）。
public struct PcmFramer {
    public static let sampleRate = 16000
    public static let samplesPerFrame = 1600

    private var pending: [Int16] = []

    public init() {}

    public mutating func append(_ samples: [Int16]) -> [[Int16]] {
        pending.append(contentsOf: samples)
        var frames: [[Int16]] = []
        while pending.count >= Self.samplesPerFrame {
            frames.append(Array(pending.prefix(Self.samplesPerFrame)))
            pending.removeFirst(Self.samplesPerFrame)
        }
        return frames
    }

    /// フレームをサーバーへ送る形（リトルエンディアンの 16bit）にする。
    public static func littleEndianData(_ frame: [Int16]) -> Data {
        var data = Data(capacity: frame.count * 2)
        for sample in frame {
            withUnsafeBytes(of: sample.littleEndian) { data.append(contentsOf: $0) }
        }
        return data
    }

    /// 画面のマイクの印に使う音の大きさ（0〜1）。話し声の RMS はおよそ 0.02〜0.2 なので広げる（Windows・Android と同じ）。
    public static func level(_ frame: [Int16]) -> Float {
        guard !frame.isEmpty else { return 0 }
        let sumOfSquares = frame.reduce(0.0) { sum, sample in
            let value = Double(sample) / 32768
            return sum + value * value
        }
        return Float(min(1, (sumOfSquares / Double(frame.count)).squareRoot() * 6))
    }
}
