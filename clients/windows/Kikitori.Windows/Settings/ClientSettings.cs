using System.IO;
using System.Text.Json;

namespace Kikitori.Windows.Settings;

/// <summary>%APPDATA%\Kikitori\settings.json に置く設定。アクセスキーはここに置かず、資格情報マネージャーに置く。</summary>
internal sealed record ClientSettings
{
    public const string DefaultHotkey = "Ctrl+Alt+Space";
    // 話し終えたあと、これだけ声が無ければ自動で止める（Windows の音声入力と同じ考え方）
    public const int DefaultAutoStopSeconds = 8;

    public string ServerUrl { get; init; } = "";
    public string Hotkey { get; init; } = DefaultHotkey;
    public int AutoStopSeconds { get; init; } = DefaultAutoStopSeconds;
    public bool Correction { get; init; } = true;

    private static readonly string FilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Kikitori", "settings.json");

    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static ClientSettings Load()
    {
        if (!File.Exists(FilePath))
        {
            return new ClientSettings();
        }
        return JsonSerializer.Deserialize<ClientSettings>(File.ReadAllText(FilePath)) ?? new ClientSettings();
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(this, JsonOptions));
    }

    /// <summary>"http://10.0.10.178:8780" のような入力から、WebSocket の URL を作る。</summary>
    public Uri DictationUri()
    {
        var builder = new UriBuilder(ServerUrl.TrimEnd('/'));
        builder.Scheme = builder.Scheme switch
        {
            "https" or "wss" => "wss",
            _ => "ws",
        };
        builder.Path = builder.Path.TrimEnd('/') + "/v1/dictation";
        return builder.Uri;
    }
}
