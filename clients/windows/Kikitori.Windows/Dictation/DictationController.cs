using System.Windows.Threading;
using Kikitori.Windows.Audio;
using Kikitori.Windows.Input;
using Kikitori.Windows.Settings;
using Kikitori.Windows.Ui;

namespace Kikitori.Windows.Dictation;

/// <summary>
/// 音声入力の状態（待機 → 聞いている → 清書を待つ → 待機）を進める。
/// 確定した区切りが届くたびに、その文を前面のアプリへ打ち込む。打ち込んだ文字は消さない。
/// </summary>
internal sealed class DictationController
{
    private enum State { Idle, Listening, Finishing }

    private static readonly TimeSpan AutoStopCheckInterval = TimeSpan.FromSeconds(1);
    // 最後の区切りを打ってから IME を戻すまでの間。文字を後から処理するアプリが、打った文字を
    // 受け取り終えるのを待つ（終わったことを知る手段が無いので時間で待つ。小窓が消えるのと同じ頃）
    private static readonly TimeSpan ImeResumeDelay = TimeSpan.FromSeconds(1);

    private readonly Func<ClientSettings> loadSettings;
    private readonly Func<IAudioSource> createAudioSource;
    private readonly DictationWindow window;
    private readonly Dispatcher dispatcher;
    private readonly DispatcherTimer autoStopTimer;
    private readonly Action<string> log;

    private State state = State.Idle;
    private IAudioSource? audio;
    private DictationConnection? connection;
    private ImeSuspension? imeSuspension;
    private DateTime lastActivity;
    private TimeSpan autoStopAfter;

    public event EventHandler? Finished;
    public event EventHandler? AccessKeyMissing;

    public DictationController(
        Func<ClientSettings> loadSettings,
        Func<IAudioSource> createAudioSource,
        DictationWindow window,
        Action<string> log)
    {
        this.loadSettings = loadSettings;
        this.createAudioSource = createAudioSource;
        this.window = window;
        this.log = log;
        dispatcher = window.Dispatcher;
        autoStopTimer = new DispatcherTimer { Interval = AutoStopCheckInterval };
        autoStopTimer.Tick += (_, _) => StopIfSilent();
        window.StopRequested += (_, _) => Toggle();
        window.CancelRequested += (_, _) => Cancel();
    }

    public void Toggle()
    {
        switch (state)
        {
            case State.Idle:
                _ = StartAsync();
                break;
            case State.Listening:
                Stop();
                break;
            case State.Finishing:
                break;
        }
    }

    private async Task StartAsync()
    {
        var settings = loadSettings();
        var accessKey = AccessKeyStore.Read();
        if (string.IsNullOrEmpty(accessKey) || string.IsNullOrEmpty(settings.ServerUrl))
        {
            window.ShowError(UiText.NoAccessKey);
            AccessKeyMissing?.Invoke(this, EventArgs.Empty);
            return;
        }

        state = State.Listening;
        autoStopAfter = TimeSpan.FromSeconds(settings.AutoStopSeconds);
        lastActivity = DateTime.UtcNow;
        window.ShowConnecting();

        connection = new DictationConnection();
        var current = connection;
        current.EventReceived += dictationEvent => dispatcher.BeginInvoke(() => Handle(current, dictationEvent));
        current.ConnectionFailed += error => dispatcher.BeginInvoke(() => Fail(current, UiText.ConnectionFailed, error));

        // 接続を待たずに録音を始める（話し始めを取りこぼさないため。音声は送る列に貯まる）
        try
        {
            audio = createAudioSource();
            audio.FrameCaptured += (pcm, level) =>
            {
                current.SendAudio(pcm);
                dispatcher.BeginInvoke(() => window.SetLevel(level));
            };
            audio.Start();
        }
        catch (Exception error)
        {
            Fail(current, UiText.MicrophoneFailed, error);
            return;
        }
        // 最初の区切りは話し始めてから 0.6 秒以上あとに届くので、録音を始めてから IME をオフにしても間に合う
        var suspension = await ImeSuspension.SuspendIfOpenAsync(log);
        if (connection != current)
        {
            // オフにしている間に取り消された
            suspension?.Resume();
            return;
        }
        imeSuspension = suspension;

        try
        {
            await current.ConnectAsync(settings.DictationUri(), accessKey, "windows", settings.Correction);
        }
        catch (Exception error)
        {
            Fail(current, UiText.ConnectionFailed, error);
            return;
        }
        if (connection == current)
        {
            window.ShowListening();
            autoStopTimer.Start();
        }
    }

    private void Stop()
    {
        if (state != State.Listening || connection is null)
        {
            return;
        }
        state = State.Finishing;
        autoStopTimer.Stop();
        audio?.Stop();
        connection.SendStop();
        window.ShowFinishing();
    }

    private void Cancel()
    {
        if (state == State.Idle || connection is null)
        {
            window.Hide();
            return;
        }
        connection.SendCancel();
        _ = FinishAsync(connection, UiText.Cancelled);
    }

    private void StopIfSilent()
    {
        if (state == State.Listening && DateTime.UtcNow - lastActivity > autoStopAfter)
        {
            log("auto stop after silence");
            Stop();
        }
    }

    private void Handle(DictationConnection source, DictationEvent dictationEvent)
    {
        if (source != connection)
        {
            return;
        }
        switch (dictationEvent)
        {
            case ReadyEvent ready:
                log($"ready dictation={ready.DictationId}");
                break;
            case PartialEvent partial:
                lastActivity = DateTime.UtcNow;
                window.ShowPartial(partial.Segment, partial.Text);
                break;
            case SegmentEvent segment:
                lastActivity = DateTime.UtcNow;
                log($"segment {segment.Segment} corrected={segment.Corrected} text={segment.Text}");
                TypeSegment(segment.Text);
                window.ShowCommitted(segment.Segment, segment.Text);
                break;
            case ErrorEvent error:
                log($"error {error.Code}: {error.Message}");
                window.ShowError(error.Message);
                break;
            case EndEvent end:
                log($"end cancelled={end.Cancelled}");
                _ = FinishAsync(source, end.Cancelled ? UiText.Cancelled : UiText.Done);
                break;
        }
    }

    private void TypeSegment(string text)
    {
        try
        {
            TextTyper.Type(text);
        }
        catch (Exception error)
        {
            log($"typing failed: {error.Message}");
            window.ShowError(UiText.TypingFailed);
        }
    }

    private void Fail(DictationConnection source, string message, Exception error)
    {
        if (source != connection)
        {
            return;
        }
        log($"{message}: {error.Message}");
        window.ShowError(message);
        _ = FinishAsync(source, message, showStatus: false);
    }

    private async Task FinishAsync(DictationConnection source, string status, bool showStatus = true)
    {
        if (source != connection)
        {
            return;
        }
        state = State.Idle;
        autoStopTimer.Stop();
        audio?.Stop();
        audio?.Dispose();
        audio = null;
        connection = null;
        var suspension = imeSuspension;
        imeSuspension = null;
        if (showStatus)
        {
            window.ShowFinished(status);
        }
        await source.DisposeAsync();
        if (suspension is not null)
        {
            await Task.Delay(ImeResumeDelay);
            suspension.Resume();
        }
        Finished?.Invoke(this, EventArgs.Empty);
    }
}
