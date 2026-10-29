#if os(macOS)
import AVFoundation
import Foundation
import KikitoriCore

/// 16kHz・モノラル・16bit の PCM を 100ms ずつ出すもの。onFrame は録音の糸から呼ばれる。
protocol AudioSource: AnyObject {
    func start(onFrame: @escaping (Data, Float) -> Void) throws
    func stop()
}

enum AudioSourceError: Error {
    case unsupportedFormat
}

/// 既定のマイク。AVAudioEngine の入力を AVAudioConverter で 16kHz・モノラル・16bit に変える。
final class MicrophoneSource: AudioSource {
    private let engine = AVAudioEngine()
    private var framer = PcmFramer()

    func start(onFrame: @escaping (Data, Float) -> Void) throws {
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        guard let targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16, sampleRate: Double(PcmFramer.sampleRate), channels: 1, interleaved: true),
              let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            throw AudioSourceError.unsupportedFormat
        }
        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
            guard let self else { return }
            let capacity = AVAudioFrameCount(Double(buffer.frameLength) * targetFormat.sampleRate / inputFormat.sampleRate) + 64
            guard let converted = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }
            var consumed = false
            var error: NSError?
            converter.convert(to: converted, error: &error) { _, status in
                if consumed {
                    status.pointee = .noDataNow
                    return nil
                }
                consumed = true
                status.pointee = .haveData
                return buffer
            }
            guard error == nil, let channel = converted.int16ChannelData?[0] else { return }
            let samples = Array(UnsafeBufferPointer(start: channel, count: Int(converted.frameLength)))
            for frame in self.framer.append(samples) {
                onFrame(PcmFramer.littleEndianData(frame), PcmFramer.level(frame))
            }
        }
        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }
}

/// 試験用。16kHz・モノラル・16bit の WAV を、話す速さで流す。
final class WavFileSource: AudioSource {
    private let url: URL
    private var running = false

    init(url: URL) {
        self.url = url
    }

    func start(onFrame: @escaping (Data, Float) -> Void) throws {
        let pcm = try Self.pcmData(of: Data(contentsOf: url))
        running = true
        Thread.detachNewThread { [weak self] in
            let frameBytes = PcmFramer.samplesPerFrame * 2
            let started = Date()
            var offset = 0
            while let self, self.running, offset < pcm.count {
                let chunk = pcm.subdata(in: offset..<min(offset + frameBytes, pcm.count))
                let samples = chunk.withUnsafeBytes { Array($0.bindMemory(to: Int16.self)) }
                onFrame(chunk, PcmFramer.level(samples))
                offset += chunk.count
                let due = started.addingTimeInterval(Double(offset) / Double(PcmFramer.sampleRate * 2))
                let wait = due.timeIntervalSinceNow
                if wait > 0 { Thread.sleep(forTimeInterval: wait) }
            }
        }
    }

    func stop() {
        running = false
    }

    /// RIFF の頭のあと、"data" の塊が見つかるまで塊を読み飛ばす（ffmpeg は LIST の塊も書く）。
    private static func pcmData(of wav: Data) throws -> Data {
        var offset = 12
        while offset + 8 <= wav.count {
            let identifier = String(decoding: wav[offset..<offset + 4], as: UTF8.self)
            let size = wav[offset + 4..<offset + 8].withUnsafeBytes { $0.loadUnaligned(as: UInt32.self).littleEndian }
            let body = offset + 8
            if identifier == "data" {
                return wav.subdata(in: body..<min(body + Int(size), wav.count))
            }
            offset = body + Int(size) + Int(size % 2)
        }
        throw AudioSourceError.unsupportedFormat
    }
}
#endif
