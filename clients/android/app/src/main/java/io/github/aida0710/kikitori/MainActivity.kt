package io.github.aida0710.kikitori

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import io.github.aida0710.kikitori.settings.AccessKeyStore
import io.github.aida0710.kikitori.settings.ClientSettings
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/** 準備（マイクの許可・キーボードをオンにする）と、サーバー・アクセスキーの設定、試し入力の画面。 */
class MainActivity : Activity() {
    private val http = OkHttpClient.Builder().callTimeout(10, TimeUnit.SECONDS).build()
    private lateinit var serverUrlInput: EditText
    private lateinit var accessKeyInput: EditText
    private lateinit var autoStopInput: EditText
    private lateinit var correctionCheckbox: CheckBox
    private lateinit var settingsMessage: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        // Android 15 からは画面いっぱいに描くので、上下のバーとキーボードの分だけ内側に寄せる
        // （寄せないと、下の「ここで試す」の欄がキーボードに隠れる）
        ViewCompat.setOnApplyWindowInsetsListener(findViewById<View>(R.id.main_root)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        serverUrlInput = findViewById(R.id.server_url_input)
        accessKeyInput = findViewById(R.id.access_key_input)
        autoStopInput = findViewById(R.id.auto_stop_input)
        correctionCheckbox = findViewById(R.id.correction_checkbox)
        settingsMessage = findViewById(R.id.settings_message)

        val settings = ClientSettings.load(this)
        serverUrlInput.setText(settings.serverUrl)
        autoStopInput.setText(settings.autoStopSeconds.toString())
        correctionCheckbox.isChecked = settings.correction

        findViewById<Button>(R.id.microphone_permission_button).setOnClickListener {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MICROPHONE_REQUEST)
        }
        findViewById<Button>(R.id.enable_keyboard_button).setOnClickListener {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        }
        findViewById<Button>(R.id.switch_keyboard_button).setOnClickListener {
            getSystemService(InputMethodManager::class.java).showInputMethodPicker()
        }
        findViewById<Button>(R.id.save_button).setOnClickListener { save() }
        findViewById<Button>(R.id.test_button).setOnClickListener { testConnection() }
    }

    override fun onResume() {
        super.onResume()
        renderSetupState()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        renderSetupState()
    }

    private fun renderSetupState() {
        val microphoneGranted = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        findViewById<TextView>(R.id.microphone_state).setText(
            if (microphoneGranted) R.string.setup_microphone_granted else R.string.setup_microphone_missing,
        )
        val keyboardEnabled = getSystemService(InputMethodManager::class.java).enabledInputMethodList
            .any { it.packageName == packageName }
        findViewById<TextView>(R.id.keyboard_state).setText(
            if (keyboardEnabled) R.string.setup_keyboard_enabled else R.string.setup_keyboard_disabled,
        )
    }

    private fun readForm(): ClientSettings {
        val serverUrl = serverUrlInput.text.toString().trim()
        require(serverUrl.startsWith("http://") || serverUrl.startsWith("https://")) {
            getString(R.string.settings_server_url)
        }
        val autoStopSeconds = autoStopInput.text.toString().toIntOrNull()
        require(autoStopSeconds != null && autoStopSeconds >= 2) { getString(R.string.settings_auto_stop) }
        return ClientSettings(serverUrl, autoStopSeconds, correctionCheckbox.isChecked)
    }

    private fun save() {
        val settings = try {
            readForm()
        } catch (error: IllegalArgumentException) {
            showMessage(getString(R.string.settings_invalid, error.message), success = false)
            return
        }
        settings.save(this)
        accessKeyInput.text.toString().trim().takeIf { it.isNotEmpty() }?.let {
            AccessKeyStore.write(this, it)
            accessKeyInput.text.clear()
        }
        showMessage(getString(R.string.settings_saved), success = true)
    }

    private fun testConnection() {
        val settings = try {
            readForm()
        } catch (error: IllegalArgumentException) {
            showMessage(getString(R.string.settings_invalid, error.message), success = false)
            return
        }
        val accessKey = accessKeyInput.text.toString().trim().ifEmpty { AccessKeyStore.read(this) ?: "" }
        val request = Request.Builder()
            .url(settings.serverUrl.trimEnd('/') + "/api/me")
            .header("Authorization", "Bearer $accessKey")
            .build()
        http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread { showMessage("${getString(R.string.error_connection)}: ${e.message}", success = false) }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.use { it.body.string() }
                val json = runCatching { JSONObject(body) }.getOrNull()
                runOnUiThread {
                    if (response.isSuccessful && json != null) {
                        showMessage(getString(R.string.settings_connected_as, json.optString("username")), success = true)
                    } else {
                        // サーバーの文をそのまま出す
                        val message = json?.optJSONObject("error")?.optString("message") ?: body
                        showMessage(message, success = false)
                    }
                }
            }
        })
    }

    private fun showMessage(message: String, success: Boolean) {
        settingsMessage.text = message
        settingsMessage.setTextColor(if (success) SUCCESS_COLOR else ERROR_COLOR)
    }

    private companion object {
        const val MICROPHONE_REQUEST = 1
        // Mado のデザインシステムの success・error と同じ色
        val SUCCESS_COLOR = Color.parseColor("#147136")
        val ERROR_COLOR = Color.parseColor("#BA2737")
    }
}
