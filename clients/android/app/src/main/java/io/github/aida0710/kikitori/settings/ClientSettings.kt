package io.github.aida0710.kikitori.settings

import android.content.Context
import androidx.core.content.edit
import androidx.core.net.toUri

/** 端末の設定。アクセスキーはここに置かず、AccessKeyStore（Android Keystore で暗号化）に置く。 */
data class ClientSettings(
    val serverUrl: String,
    val autoStopSeconds: Int,
    val correction: Boolean,
) {
    /** "http://10.0.10.178:8780" のような入力から、音声入力の WebSocket の URL を作る。 */
    fun dictationUrl(): String {
        val base = serverUrl.trimEnd('/').toUri()
        val scheme = if (base.scheme == "https" || base.scheme == "wss") "wss" else "ws"
        return base.buildUpon().scheme(scheme).appendEncodedPath("v1/dictation").build().toString()
    }

    fun save(context: Context) {
        preferences(context).edit {
            putString(KEY_SERVER_URL, serverUrl)
            putInt(KEY_AUTO_STOP_SECONDS, autoStopSeconds)
            putBoolean(KEY_CORRECTION, correction)
        }
    }

    companion object {
        // 話し終えたあと、これだけ声が無ければ自動で止める（Windows 版と同じ）
        const val DEFAULT_AUTO_STOP_SECONDS = 8
        private const val PREFERENCES_NAME = "kikitori"
        private const val KEY_SERVER_URL = "serverUrl"
        private const val KEY_AUTO_STOP_SECONDS = "autoStopSeconds"
        private const val KEY_CORRECTION = "correction"

        fun load(context: Context): ClientSettings {
            val preferences = preferences(context)
            return ClientSettings(
                serverUrl = preferences.getString(KEY_SERVER_URL, "") ?: "",
                autoStopSeconds = preferences.getInt(KEY_AUTO_STOP_SECONDS, DEFAULT_AUTO_STOP_SECONDS),
                correction = preferences.getBoolean(KEY_CORRECTION, true),
            )
        }

        internal fun preferences(context: Context) =
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    }
}
