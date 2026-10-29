package io.github.aida0710.kikitori.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.File
import java.io.RandomAccessFile
import kotlin.concurrent.thread
import kotlin.math.sqrt

/** 16kHz・モノラル・16bit の PCM を 100ms ずつ出すもの。 */
interface AudioSource {
    /** onFrame には PCM と、その区間の音の大きさ（0〜1。画面のマイクの印に使う）が届く。録音の糸から呼ばれる。 */
    fun start(onFrame: (pcm: ByteArray, level: Float) -> Unit)
    fun stop()
}

object Pcm16 {
    const val SAMPLE_RATE = 16000
    const val FRAME_MILLISECONDS = 100
    const val FRAME_BYTES = SAMPLE_RATE * 2 * FRAME_MILLISECONDS / 1000

    fun level(pcm: ByteArray, length: Int): Float {
        var sumOfSquares = 0.0
        var offset = 0
        while (offset + 1 < length) {
            val sample = ((pcm[offset + 1].toInt() shl 8) or (pcm[offset].toInt() and 0xFF)).toShort() / 32768.0
            sumOfSquares += sample * sample
            offset += 2
        }
        val samples = length / 2
        val rms = if (samples == 0) 0.0 else sqrt(sumOfSquares / samples)
        // 話し声の RMS はおよそ 0.02〜0.2。画面の印が動いて見えるように広げる
        return (rms * 6).coerceIn(0.0, 1.0).toFloat()
    }
}

/** マイク。音声認識向けの入力（VOICE_RECOGNITION）を使う。RECORD_AUDIO の許可が要る。 */
class MicrophoneSource : AudioSource {
    @Volatile
    private var running = false
    private var worker: Thread? = null

    @SuppressLint("MissingPermission") // 許可は呼ぶ側（KikitoriInputMethodService）で確かめる
    override fun start(onFrame: (pcm: ByteArray, level: Float) -> Unit) {
        val minimumBuffer = AudioRecord.getMinBufferSize(
            Pcm16.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
        )
        val record = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            Pcm16.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minimumBuffer, Pcm16.FRAME_BYTES * 4),
        )
        check(record.state == AudioRecord.STATE_INITIALIZED) { "AudioRecord could not be initialized" }
        running = true
        record.startRecording()
        worker = thread(name = "kikitori-microphone") {
            val frame = ByteArray(Pcm16.FRAME_BYTES)
            try {
                while (running) {
                    val read = record.read(frame, 0, frame.size)
                    if (read > 0) {
                        onFrame(frame.copyOf(read), Pcm16.level(frame, read))
                    }
                }
            } finally {
                record.stop()
                record.release()
            }
        }
    }

    override fun stop() {
        running = false
    }
}

/** 試験用。16kHz・モノラル・16bit の WAV を、話す速さで流す。 */
class WavFileSource(private val file: File) : AudioSource {
    @Volatile
    private var running = false

    override fun start(onFrame: (pcm: ByteArray, level: Float) -> Unit) {
        running = true
        thread(name = "kikitori-test-audio") {
            RandomAccessFile(file, "r").use { input ->
                seekToDataChunk(input)
                val frame = ByteArray(Pcm16.FRAME_BYTES)
                val started = System.nanoTime()
                var sentBytes = 0L
                while (running) {
                    val read = input.read(frame)
                    if (read <= 0) break
                    onFrame(frame.copyOf(read), Pcm16.level(frame, read))
                    sentBytes += read
                    val dueNanos = started + sentBytes * 1_000_000_000L / (Pcm16.SAMPLE_RATE * 2)
                    val waitMillis = (dueNanos - System.nanoTime()) / 1_000_000
                    if (waitMillis > 0) Thread.sleep(waitMillis)
                }
            }
        }
    }

    override fun stop() {
        running = false
    }

    /** RIFF の頭（12 バイト）のあと、"data" の塊が見つかるまで塊を読み飛ばす（ffmpeg は LIST の塊も書く）。 */
    private fun seekToDataChunk(input: RandomAccessFile) {
        input.seek(RIFF_HEADER_BYTES)
        val chunkId = ByteArray(4)
        while (true) {
            input.readFully(chunkId)
            val size = Integer.reverseBytes(input.readInt()).toLong() and 0xFFFFFFFFL
            if (String(chunkId, Charsets.US_ASCII) == "data") return
            input.seek(input.filePointer + size + (size and 1))
        }
    }

    private companion object {
        const val RIFF_HEADER_BYTES = 12L
    }
}
