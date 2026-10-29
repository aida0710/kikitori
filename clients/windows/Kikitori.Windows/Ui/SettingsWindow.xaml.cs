using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using Kikitori.Windows.Input;
using Kikitori.Windows.Settings;

namespace Kikitori.Windows.Ui;

/// <summary>サーバーの URL・アクセスキー・ショートカットなどを入れる画面。</summary>
public partial class SettingsWindow : Window
{
    private static readonly Brush ErrorBrush = new SolidColorBrush(Color.FromRgb(0xBA, 0x27, 0x37));
    private static readonly Brush SuccessBrush = new SolidColorBrush(Color.FromRgb(0x14, 0x71, 0x36));

    internal event Action<ClientSettings>? Saved;

    internal SettingsWindow(ClientSettings settings)
    {
        InitializeComponent();
        Title = UiText.SettingsTitle;
        ServerUrlLabel.Text = UiText.ServerUrlLabel;
        AccessKeyLabel.Text = UiText.AccessKeyLabel;
        AccessKeyHint.Text = UiText.AccessKeyKeep;
        HotkeyLabel.Text = UiText.HotkeyLabel;
        AutoStopLabel.Text = UiText.AutoStopLabel;
        CorrectionBox.Content = UiText.CorrectionLabel;
        TestButton.Content = UiText.TestConnection;
        SaveButton.Content = UiText.Save;

        ServerUrlBox.Text = settings.ServerUrl;
        HotkeyBox.Text = settings.Hotkey;
        AutoStopBox.Text = settings.AutoStopSeconds.ToString();
        CorrectionBox.IsChecked = settings.Correction;
    }

    private ClientSettings ReadForm()
    {
        if (!Uri.TryCreate(ServerUrlBox.Text.Trim(), UriKind.Absolute, out _))
        {
            throw new FormatException(UiText.ServerUrlLabel);
        }
        GlobalHotkey.Parse(HotkeyBox.Text);
        if (!int.TryParse(AutoStopBox.Text, out var autoStopSeconds) || autoStopSeconds < 2)
        {
            throw new FormatException(UiText.AutoStopLabel);
        }
        return new ClientSettings
        {
            ServerUrl = ServerUrlBox.Text.Trim(),
            Hotkey = HotkeyBox.Text.Trim(),
            AutoStopSeconds = autoStopSeconds,
            Correction = CorrectionBox.IsChecked == true,
        };
    }

    private string? EnteredOrSavedAccessKey() =>
        AccessKeyBox.Password.Length > 0 ? AccessKeyBox.Password.Trim() : AccessKeyStore.Read();

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        ClientSettings settings;
        try
        {
            settings = ReadForm();
        }
        catch (FormatException error)
        {
            ShowMessage(UiText.InvalidSettings(error.Message), ErrorBrush);
            return;
        }
        settings.Save();
        if (AccessKeyBox.Password.Length > 0)
        {
            AccessKeyStore.Write(AccessKeyBox.Password.Trim());
        }
        Saved?.Invoke(settings);
        Close();
    }

    private async void TestButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var settings = ReadForm();
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(new Uri(settings.ServerUrl), "/api/me"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", EnteredOrSavedAccessKey() ?? "");
            using var response = await http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            using var document = JsonDocument.Parse(body);
            if (response.IsSuccessStatusCode)
            {
                ShowMessage(UiText.ConnectedAs(document.RootElement.GetProperty("username").GetString() ?? ""), SuccessBrush);
            }
            else
            {
                // サーバーの文をそのまま出す
                ShowMessage(document.RootElement.GetProperty("error").GetProperty("message").GetString() ?? body, ErrorBrush);
            }
        }
        catch (Exception error)
        {
            ShowMessage($"{UiText.ConnectionFailed}: {error.Message}", ErrorBrush);
        }
    }

    private void ShowMessage(string message, Brush brush)
    {
        MessageText.Text = message;
        MessageText.Foreground = brush;
    }
}
