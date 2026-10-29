package io.github.aida0710.kikitori.dictation

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import io.github.aida0710.kikitori.audio.AudioSource
import io.github.aida0710.kikitori.settings.ClientSettings

enum class FinishReason { Done, Cancelled, Failed }

/** 画面と入力欄に出すもの。どれも主の糸（main）から呼ぶ。 */
interface DictationView {
    fun showConnecting()
    fun showListening()
    fun showFinishing()
    fun showLevel(level: Float)
    fun showPartial(segment: Int, text: String)
    fun showSegment(segment: Int, text: String)
    fun showError(message: String)
    /** finalText は入力欄に最後に残す文（清書した全文）。取り消し・失敗のときは null（入れた文字起こしの結果を残す）。 */
    fun finished(reason: FinishReason, finalText: String?)
}

/**
 * 音声入力の状態（待機 → 聞いている → 清書を待つ → 待機）を進める。
 * 届いた知らせは主の糸へ移してから扱う。区切りが届くたびに、文字起こしの結果を入力欄の未確定の文字に足し、
 * 話し終えたら、清書した全文で置き換えて確定する。
 */
class DictationController(
    private val view: DictationView,
    private val createAudioSource: () -> AudioSource,
    private val connectionFailedMessage: () -> String,
) {
    private enum class State { Idle, Listening, Finishing }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var state = State.Idle
    private var connection: DictationConnection? = null
    private var audio: AudioSource? = null
    private var lastActivity = 0L
    private var autoStopMillis = 0L
    private val autoStopCheck = object : Runnable {
        override fun run() {
            if (state != State.Listening) return
            if (SystemClock.elapsedRealtime() - lastActivity > autoStopMillis) {
                stop()
            } else {
                mainHandler.postDelayed(this, AUTO_STOP_CHECK_MILLIS)
            }
        }
    }

    val isIdle: Boolean get() = state == State.Idle

    fun start(settings: ClientSettings, accessKey: String) {
        if (state != State.Idle) return
        state = State.Listening
        autoStopMillis = settings.autoStopSeconds * 1000L
        lastActivity = SystemClock.elapsedRealtime()
        view.showConnecting()
        // 知らせがどの接続から来たかを見分けるため、接続そのものを一緒に渡す（古い接続の知らせは捨てる）
        lateinit var current: DictationConnection
        current = DictationConnection(settings.dictationUrl(), accessKey, settings.correction) { event ->
            mainHandler.post { handle(event, current) }
        }
        connection = current
        // 接続を待たずに録音を始める（話し始めを取りこぼさないため）
        val source = createAudioSource()
        audio = source
        source.start { pcm, level ->
            current.sendAudio(pcm)
            mainHandler.post { if (connection == current) view.showLevel(level) }
        }
        mainHandler.postDelayed(autoStopCheck, AUTO_STOP_CHECK_MILLIS)
    }

    fun stop() {
        if (state != State.Listening) return
        state = State.Finishing
        audio?.stop()
        connection?.stop()
        view.showFinishing()
    }

    fun cancel() {
        if (state == State.Idle) return
        connection?.cancel()
        finish(FinishReason.Cancelled)
    }

    private fun handle(event: DictationEvent, source: DictationConnection) {
        if (source != connection) return
        when (event) {
            is DictationEvent.Ready -> view.showListening()
            is DictationEvent.Partial -> {
                lastActivity = SystemClock.elapsedRealtime()
                view.showPartial(event.segment, event.text)
            }
            is DictationEvent.Segment -> {
                lastActivity = SystemClock.elapsedRealtime()
                view.showSegment(event.segment, event.text)
            }
            is DictationEvent.Error -> view.showError(event.message)
            is DictationEvent.Failed -> {
                view.showError(connectionFailedMessage())
                finish(FinishReason.Failed)
            }
            is DictationEvent.End ->
                if (event.cancelled) finish(FinishReason.Cancelled) else finish(FinishReason.Done, finalText = event.text)
        }
    }

    private fun finish(reason: FinishReason, finalText: String? = null) {
        if (state == State.Idle) return
        state = State.Idle
        mainHandler.removeCallbacks(autoStopCheck)
        audio?.stop()
        audio = null
        connection?.close()
        connection = null
        view.finished(reason, finalText)
    }

    private companion object {
        const val AUTO_STOP_CHECK_MILLIS = 1000L
    }
}
