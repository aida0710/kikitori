package io.github.aida0710.kikitori.dictation

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** サーバーから届く知らせ。形は docs/dictation-protocol.md。 */
sealed interface DictationEvent {
    data class Ready(val dictationId: Long) : DictationEvent
    data class Partial(val segment: Int, val text: String) : DictationEvent
    data class Segment(val segment: Int, val raw: String, val text: String, val corrected: Boolean) : DictationEvent
    data class End(val text: String, val cancelled: Boolean) : DictationEvent
    data class Error(val code: String, val message: String) : DictationEvent
    data class Failed(val cause: Throwable) : DictationEvent
}

/**
 * 1 回の音声入力の WebSocket（/v1/dictation）。OkHttp は接続できる前に送ったものも並べておき、
 * 接続できしだい順に送るので、start と最初の音声は接続を待たずに送ってよい。
 * 知らせは OkHttp の糸から届く。
 */
class DictationConnection(
    url: String,
    accessKey: String,
    correction: Boolean,
    private val onEvent: (DictationEvent) -> Unit,
) {
    private val socket: WebSocket

    init {
        val request = Request.Builder().url(url).header("Authorization", "Bearer $accessKey").build()
        socket = client.newWebSocket(request, Listener())
        socket.send(JSONObject().put("type", "start").put("client", "android").put("correction", correction).toString())
    }

    fun sendAudio(pcm: ByteArray) {
        socket.send(pcm.toByteString())
    }

    fun stop() {
        socket.send("""{"type":"stop"}""")
    }

    fun cancel() {
        socket.send("""{"type":"cancel"}""")
    }

    fun close() {
        socket.close(NORMAL_CLOSURE, null)
    }

    private inner class Listener : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            parse(text)?.let(onEvent)
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) = Unit

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            onEvent(DictationEvent.Failed(t))
        }
    }

    private fun parse(text: String): DictationEvent? {
        val json = JSONObject(text)
        return when (json.optString("type")) {
            "ready" -> DictationEvent.Ready(json.getLong("dictationId"))
            "partial" -> DictationEvent.Partial(json.getInt("segment"), json.getString("text"))
            "segment" -> DictationEvent.Segment(
                json.getInt("segment"), json.getString("raw"), json.getString("text"), json.getBoolean("corrected"),
            )
            "end" -> DictationEvent.End(json.getString("text"), json.getBoolean("cancelled"))
            "error" -> DictationEvent.Error(json.getString("code"), json.getString("message"))
            else -> null
        }
    }

    private companion object {
        const val NORMAL_CLOSURE = 1000
        // 端末と同じく 15 秒ごとに ping を送り、途中で回線が切れたら気づけるようにする
        val client: OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .pingInterval(15, TimeUnit.SECONDS)
            .build()
    }
}
