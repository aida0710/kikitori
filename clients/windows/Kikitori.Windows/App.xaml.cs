using System.IO;
using System.Windows;
using Kikitori.Windows.Audio;
using Kikitori.Windows.Dictation;
using Kikitori.Windows.Input;
using Kikitori.Windows.Settings;
using Kikitori.Windows.Ui;

namespace Kikitori.Windows;

/// <summary>
/// 常駐の入口。タスクトレイに居て、ショートカットで小窓を出して音声入力を始める。
///
/// 試験用の引数:
///   --wav &lt;16kHz・モノラル・16bit の WAV&gt;  マイクの代わりに WAV を流す
///   --start                          起動してすぐ音声入力を始める
///   --exit-after-dictation           1 回の音声入力が終わったら終了する
/// </summary>
public partial class App : Application
{
    private static readonly string LogPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kikitori", "kikitori.log");

    // 2 つ目に開かれた Kikitori が、動いている Kikitori に設定画面を開いてもらうための合図
    private const string OpenSettingsSignalName = "Kikitori.Windows.OpenSettings";

    private Mutex? singleInstance;
    private EventWaitHandle? openSettingsSignal;
    private TrayIcon? trayIcon;
    private GlobalHotkey? hotkey;
    private DictationController? controller;
    private SettingsWindow? settingsWindow;
    private ClientSettings settings = new();

    private void Application_Startup(object sender, StartupEventArgs e)
    {
        singleInstance = new Mutex(initiallyOwned: true, "Kikitori.Windows.SingleInstance", out var isFirst);
        if (!isFirst)
        {
            // もう一度開かれたら、動いている方に設定画面を出してもらって終わる（何も起きないと、動いているのか分からないため）
            if (EventWaitHandle.TryOpenExisting(OpenSettingsSignalName, out var signal))
            {
                signal.Set();
                signal.Dispose();
            }
            Shutdown();
            return;
        }
        openSettingsSignal = new EventWaitHandle(initialState: false, EventResetMode.AutoReset, OpenSettingsSignalName);
        ThreadPool.RegisterWaitForSingleObject(
            openSettingsSignal, (_, _) => Dispatcher.BeginInvoke(OpenSettings), null, Timeout.Infinite, executeOnlyOnce: false);

        var arguments = e.Args.ToList();
        var wavIndex = arguments.IndexOf("--wav");
        var wavPath = wavIndex >= 0 && wavIndex + 1 < arguments.Count ? arguments[wavIndex + 1] : null;
        var startNow = arguments.Contains("--start");
        var exitAfterDictation = arguments.Contains("--exit-after-dictation");

        settings = ClientSettings.Load();
        var window = new DictationWindow();
        controller = new DictationController(
            () => settings,
            () => wavPath is null ? new MicrophoneSource() : new WavFileSource(wavPath),
            window,
            Log);
        controller.AccessKeyMissing += (_, _) => OpenSettings();
        if (exitAfterDictation)
        {
            controller.Finished += (_, _) => Dispatcher.BeginInvoke(async () =>
            {
                // 小窓の「入力しました」を撮れるように少し待つ
                await Task.Delay(TimeSpan.FromSeconds(2));
                Shutdown();
            });
        }

        // exe を別の場所へ動かしたあとも、サインインのときに開けるように登録を今の場所で書き直す
        if (StartupRegistration.IsEnabled())
        {
            StartupRegistration.Set(true);
        }

        trayIcon = new TrayIcon(settings.Hotkey);
        trayIcon.StartRequested += (_, _) => controller.Toggle();
        trayIcon.SettingsRequested += (_, _) => OpenSettings();
        trayIcon.ExitRequested += (_, _) => Shutdown();

        hotkey = new GlobalHotkey();
        hotkey.Pressed += (_, _) => controller.Toggle();
        RegisterHotkey(window);

        if (string.IsNullOrEmpty(settings.ServerUrl) || AccessKeyStore.Read() is null)
        {
            OpenSettings();
        }
        else if (startNow)
        {
            controller.Toggle();
        }
    }

    private void RegisterHotkey(DictationWindow window)
    {
        if (!hotkey!.Register(settings.Hotkey))
        {
            Log($"hotkey {settings.Hotkey} is taken");
            window.ShowError(UiText.HotkeyTaken(settings.Hotkey));
        }
    }

    private void OpenSettings()
    {
        if (settingsWindow is not null)
        {
            settingsWindow.Activate();
            return;
        }
        settingsWindow = new SettingsWindow(settings);
        settingsWindow.Saved += saved =>
        {
            settings = saved;
            trayIcon?.SetHotkey(saved.Hotkey);
            hotkey?.Register(saved.Hotkey);
        };
        settingsWindow.Closed += (_, _) => settingsWindow = null;
        settingsWindow.Show();
        settingsWindow.Activate();
    }

    private static void Log(string message)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
        File.AppendAllText(LogPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {message}{Environment.NewLine}");
    }

    private void Application_Exit(object sender, ExitEventArgs e)
    {
        hotkey?.Dispose();
        trayIcon?.Dispose();
        singleInstance?.Dispose();
    }
}
