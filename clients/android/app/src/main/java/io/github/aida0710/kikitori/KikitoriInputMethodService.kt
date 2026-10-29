package io.github.aida0710.kikitori

import android.Manifest
import android.content.pm.PackageManager
import android.inputmethodservice.InputMethodService
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.ImageButton
import android.widget.TextView
import io.github.aida0710.kikitori.audio.AudioSource
import io.github.aida0710.kikitori.audio.MicrophoneSource
import io.github.aida0710.kikitori.audio.WavFileSource
import io.github.aida0710.kikitori.dictation.DictationController
import io.github.aida0710.kikitori.dictation.DictationView
import io.github.aida0710.kikitori.dictation.FinishReason
import io.github.aida0710.kikitori.settings.AccessKeyStore
import io.github.aida0710.kikitori.settings.ClientSettings

/**
 * 音声入力だけのキーボード。Gboard などから切り替えて呼ぶと、すぐに聞き始める。
 * 話している間は、文字起こしの結果を入力欄に未確定の文字として出し、話し終えたら清書した全文で置き換えて確定する。
 * 話し終えたら、元のキーボードへ自動で戻る。
 */
class KikitoriInputMethodService : InputMethodService(), DictationView {
    private lateinit var controller: DictationController
    private var statusText: TextView? = null
    private var transcriptText: TextView? = null
    private var levelRing: View? = null
    private var microphoneButton: ImageButton? = null
    // 確定した区切りの文字起こしの結果。話し終えるまでは、これと途中結果を入力欄の未確定の文字にしておく
    private var segmentText = ""
    private var partialText = ""
    // 確定した区切りより前の途中結果が遅れて届いても使わないよう、どの区切りの途中結果かを持つ
    private var partialSegment = -1
    private var lastSegment = -1

    override fun onCreate() {
        super.onCreate()
        controller = DictationController(this, ::createAudioSource) { getString(R.string.error_connection) }
    }

    override fun onCreateInputView(): View {
        val panel = layoutInflater.inflate(R.layout.voice_panel, null)
        statusText = panel.findViewById(R.id.status_text)
        transcriptText = panel.findViewById(R.id.transcript_text)
        levelRing = panel.findViewById(R.id.level_ring)
        microphoneButton = panel.findViewById<ImageButton>(R.id.microphone_button).apply {
            setOnClickListener { if (controller.isIdle) startDictation() else controller.stop() }
        }
        panel.findViewById<ImageButton>(R.id.cancel_button).setOnClickListener {
            if (controller.isIdle) switchBackToPreviousKeyboard() else controller.cancel()
        }
        panel.findViewById<ImageButton>(R.id.keyboard_button).setOnClickListener {
            controller.cancel()
            switchBackToPreviousKeyboard()
        }
        return panel
    }

    /**
     * 既定では、ハードウェアキーボード（Bluetooth のキーボードなど）がつながっていると面を出さない。
     * 音声入力の面はキーの代わりではないので、いつも出す。
     */
    override fun onEvaluateInputViewShown(): Boolean {
        super.onEvaluateInputViewShown()
        return true
    }

    override fun onStartInputView(editorInfo: EditorInfo, restarting: Boolean) {
        super.onStartInputView(editorInfo, restarting)
        // 同じ入力欄で開き直されたとき（確定のあとなど）は、聞き直さない
        if (!restarting && controller.isIdle) {
            startDictation()
        }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        controller.cancel()
        super.onFinishInputView(finishingInput)
    }

    private fun startDictation() {
        segmentText = ""
        partialText = ""
        partialSegment = -1
        lastSegment = -1
        renderTranscript()
        val settings = ClientSettings.load(this)
        val accessKey = AccessKeyStore.read(this)
        if (settings.serverUrl.isEmpty() || accessKey.isNullOrEmpty()) {
            showError(getString(R.string.error_not_configured))
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            showError(getString(R.string.error_microphone_permission))
            return
        }
        try {
            controller.start(settings, accessKey)
        } catch (error: IllegalStateException) {
            showError(getString(R.string.error_microphone))
        }
    }

    /** 試験の版では、アプリの外部ファイルの場所に test.wav があれば、マイクの代わりにそれを流す。 */
    private fun createAudioSource(): AudioSource {
        val testAudio = getExternalFilesDir(null)?.resolve(TEST_AUDIO_FILE_NAME)
        return if (BuildConfig.DEBUG && testAudio?.exists() == true) WavFileSource(testAudio) else MicrophoneSource()
    }

    private fun switchBackToPreviousKeyboard() {
        if (!switchToPreviousInputMethod()) {
            // 前のキーボードが分からないとき（この端末で最初に選んだときなど）は、選ぶ画面を出す
            getSystemService(InputMethodManager::class.java).showInputMethodPicker()
        }
    }

    override fun showConnecting() = setStatus(getString(R.string.status_connecting), listening = false)

    override fun showListening() = setStatus(getString(R.string.status_listening), listening = true)

    override fun showFinishing() = setStatus(getString(R.string.status_finishing), listening = false)

    override fun showLevel(level: Float) {
        val scale = 0.75f + level * 0.25f
        levelRing?.scaleX = scale
        levelRing?.scaleY = scale
    }

    override fun showPartial(segment: Int, text: String) {
        if (segment <= lastSegment) return
        partialSegment = segment
        partialText = text
        currentInputConnection?.setComposingText(segmentText + partialText, 1)
        renderTranscript()
    }

    override fun showSegment(segment: Int, text: String) {
        segmentText += text
        lastSegment = segment
        if (partialSegment <= segment) {
            partialText = ""
        }
        currentInputConnection?.setComposingText(segmentText + partialText, 1)
        renderTranscript()
    }

    override fun showError(message: String) {
        setStatus(message, listening = false)
    }

    override fun finished(reason: FinishReason, finalText: String?) {
        currentInputConnection?.let { connection ->
            if (finalText != null) {
                // 未確定の文字（文字起こしの結果）を、清書した全文で置き換えて確定する
                connection.commitText(finalText, 1)
            } else {
                // 取り消し・失敗のときは、確定した区切りの文字起こしの結果を残し、途中結果は残さない
                connection.setComposingText(segmentText, 1)
                connection.finishComposingText()
            }
        }
        if (finalText != null) {
            segmentText = finalText
        }
        partialText = ""
        renderTranscript()
        when (reason) {
            FinishReason.Done -> {
                setStatus(getString(R.string.status_done), listening = false)
                switchBackToPreviousKeyboard()
            }
            FinishReason.Cancelled -> {
                setStatus(getString(R.string.status_cancelled), listening = false)
                switchBackToPreviousKeyboard()
            }
            // エラーの文を読めるように、元のキーボードへは戻らない
            FinishReason.Failed -> Unit
        }
    }

    private fun setStatus(status: String, listening: Boolean) {
        statusText?.text = status
        microphoneButton?.alpha = if (listening) 1f else 0.5f
        microphoneButton?.contentDescription =
            getString(if (listening) R.string.action_stop else R.string.action_start)
        if (!listening) showLevel(0f)
    }

    private fun renderTranscript() {
        val segmentShown = segmentText.takeLast(maxOf(0, TRANSCRIPT_TAIL_CHARACTERS - partialText.length))
        val transcript = SpannableStringBuilder(segmentShown)
        val start = transcript.length
        transcript.append(partialText.takeLast(TRANSCRIPT_TAIL_CHARACTERS))
        transcript.setSpan(
            ForegroundColorSpan(getColor(R.color.panel_muted)), start, transcript.length,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
        transcriptText?.text = transcript
    }

    private companion object {
        const val TEST_AUDIO_FILE_NAME = "test.wav"
        // 面に出す文の長さ。直近の内容だけ見えればよい（16sp で 3 行に収まる長さ）
        const val TRANSCRIPT_TAIL_CHARACTERS = 54
    }
}
