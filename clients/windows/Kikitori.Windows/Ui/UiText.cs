using System.Globalization;

namespace Kikitori.Windows.Ui;

/// <summary>画面の文言。Windows の表示言語が日本語なら日本語、それ以外は英語。</summary>
internal static class UiText
{
    private static readonly bool IsJapanese = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ja";

    private static string Pick(string japanese, string english) => IsJapanese ? japanese : english;

    public static string Connecting => Pick("接続しています…", "Connecting…");
    public static string Listening => Pick("聞いています", "Listening");
    public static string Finishing => Pick("清書しています…", "Polishing…");
    public static string Done => Pick("入力しました", "Done");
    public static string Cancelled => Pick("取り消しました", "Cancelled");
    public static string NoAccessKey => Pick("アクセスキーが設定されていません", "No access key is set");
    public static string ConnectionFailed => Pick("サーバーにつながりません", "Cannot reach the server");
    public static string MicrophoneFailed => Pick("マイクを使えません", "Cannot use the microphone");
    public static string TypingFailed => Pick("入力欄に文字を送れません（管理者として動くアプリには送れません）",
        "Cannot type into this app (apps running as administrator are not supported)");
    public static string HotkeyTaken(string hotkey) =>
        Pick($"ショートカット {hotkey} はほかのアプリが使っています", $"The shortcut {hotkey} is used by another app");
    public static string StopTooltip => Pick("止める", "Stop");
    public static string CancelTooltip => Pick("取り消す", "Cancel");

    public static string TrayTooltip => "Kikitori";
    public static string TrayStart(string hotkey) => Pick($"音声入力（{hotkey}）", $"Dictate ({hotkey})");
    public static string TraySettings => Pick("設定", "Settings");
    public static string TrayExit => Pick("終了", "Exit");

    public static string SettingsTitle => Pick("Kikitoriの設定", "Kikitori settings");
    public static string ServerUrlLabel => Pick("サーバーのURL", "Server URL");
    public static string AccessKeyLabel => Pick("アクセスキー（管理画面で作ったもの）", "Access key (create it in the dashboard)");
    public static string AccessKeyKeep => Pick("空欄のままなら、保存済みのアクセスキーを使います", "Leave empty to keep the saved key");
    public static string HotkeyLabel => Pick("ショートカット（例: Ctrl+Alt+Space）", "Shortcut (e.g. Ctrl+Alt+Space)");
    public static string AutoStopLabel => Pick("声が無いときに自動で止めるまでの秒数", "Seconds of silence before stopping");
    public static string CorrectionLabel => Pick("Claudeで清書する", "Polish with Claude");
    public static string Save => Pick("保存", "Save");
    public static string TestConnection => Pick("接続を試す", "Test connection");
    public static string ConnectedAs(string username) => Pick($"{username}として接続できました", $"Connected as {username}");
    public static string InvalidSettings(string reason) => Pick($"設定を保存できません: {reason}", $"Cannot save: {reason}");
}
