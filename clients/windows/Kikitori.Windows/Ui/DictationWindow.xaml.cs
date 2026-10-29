using System.Windows;
using System.Windows.Documents;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using Kikitori.Windows.Native;

namespace Kikitori.Windows.Ui;

/// <summary>
/// 画面の下の中央に出る小窓。押してもフォーカスを奪わない（WS_EX_NOACTIVATE）ので、
/// 文字は元の入力欄へ入り続ける。
/// </summary>
public partial class DictationWindow : Window
{
    // 小窓に出す文の長さ。長い入力でも直近の内容だけ見えればよい
    private const int TranscriptTailCharacters = 80;
    // 画面の下端から小窓までの間（タスクバーの上に浮かせる）。窓の中の影の余白（28）も含む
    private const double BottomMargin = 32;
    private static readonly TimeSpan HideDelay = TimeSpan.FromSeconds(1.2);
    // エラーは読めるように長めに出す
    private static readonly TimeSpan ErrorHideDelay = TimeSpan.FromSeconds(4);

    private readonly DispatcherTimer hideTimer;
    private string committedText = "";
    private string partialText = "";
    // 清書を待っている区切りより先に、次の区切りの途中結果が届くことがある。どの区切りの途中結果かを持つ
    private int partialSegment = -1;

    public event EventHandler? StopRequested;
    public event EventHandler? CancelRequested;

    public DictationWindow()
    {
        InitializeComponent();
        MicrophoneButton.ToolTip = UiText.StopTooltip;
        CancelButton.ToolTip = UiText.CancelTooltip;
        hideTimer = new DispatcherTimer { Interval = HideDelay };
        hideTimer.Tick += (_, _) =>
        {
            hideTimer.Stop();
            Hide();
        };
        SourceInitialized += (_, _) => MakeNonActivating();
    }

    private void MakeNonActivating()
    {
        var handle = new WindowInteropHelper(this).Handle;
        var style = NativeMethods.GetWindowLongPtr(handle, NativeMethods.GWL_EXSTYLE);
        var extended = style | (nint)(NativeMethods.WS_EX_NOACTIVATE | NativeMethods.WS_EX_TOOLWINDOW | NativeMethods.WS_EX_TOPMOST);
        NativeMethods.SetWindowLongPtr(handle, NativeMethods.GWL_EXSTYLE, extended);
    }

    public void ShowConnecting()
    {
        hideTimer.Stop();
        committedText = "";
        partialText = "";
        partialSegment = -1;
        RenderTranscript();
        SetStatus(UiText.Connecting, listening: false);
        if (!IsVisible)
        {
            Show();
        }
        PlaceAtBottomCenter();
    }

    public void ShowListening() => SetStatus(UiText.Listening, listening: true);

    public void ShowFinishing() => SetStatus(UiText.Finishing, listening: false);

    public void ShowPartial(int segment, string text)
    {
        partialSegment = segment;
        partialText = text;
        RenderTranscript();
    }

    public void ShowCommitted(int segment, string text)
    {
        committedText += text;
        if (partialSegment <= segment)
        {
            partialText = "";
        }
        RenderTranscript();
    }

    /// <summary>話し終えたあと、区切りで出した文を清書した全文に置き換える。</summary>
    public void ShowFinalText(string text)
    {
        committedText = text;
        partialText = "";
        RenderTranscript();
    }

    public void ShowFinished(string status)
    {
        SetStatus(status, listening: false);
        hideTimer.Interval = HideDelay;
        hideTimer.Start();
    }

    public void ShowError(string message)
    {
        if (!IsVisible)
        {
            Show();
            PlaceAtBottomCenter();
        }
        SetStatus(message, listening: false);
        hideTimer.Interval = ErrorHideDelay;
        hideTimer.Start();
    }

    public void SetLevel(float level)
    {
        var ring = MicrophoneButton.Template.FindName("LevelRing", MicrophoneButton) as Ellipse;
        if (ring?.RenderTransform is ScaleTransform scale)
        {
            var size = 0.7 + level * 0.3;
            scale.ScaleX = size;
            scale.ScaleY = size;
        }
    }

    private void SetStatus(string status, bool listening)
    {
        StatusText.Text = status;
        if (MicrophoneButton.Template.FindName("Disc", MicrophoneButton) is Ellipse disc)
        {
            disc.Fill = listening ? (Brush)FindResource("Indicator") : (Brush)FindResource("Idle");
        }
        if (!listening)
        {
            SetLevel(0);
        }
    }

    private void RenderTranscript()
    {
        var combined = committedText + partialText;
        var skip = Math.Max(0, combined.Length - TranscriptTailCharacters);
        var committedShown = skip < committedText.Length ? committedText[skip..] : "";
        var partialShown = partialText[Math.Max(0, skip - committedText.Length)..];
        TranscriptText.Inlines.Clear();
        if (skip > 0)
        {
            TranscriptText.Inlines.Add(new Run("…"));
        }
        TranscriptText.Inlines.Add(new Run(committedShown));
        TranscriptText.Inlines.Add(new Run(partialShown) { Foreground = (Brush)FindResource("Muted") });
    }

    private void PlaceAtBottomCenter()
    {
        var screen = System.Windows.Forms.Screen.FromHandle(NativeMethods.GetForegroundWindow());
        var source = PresentationSource.FromVisual(this);
        var toDips = source?.CompositionTarget?.TransformFromDevice ?? Matrix.Identity;
        var area = screen.WorkingArea;
        var bottomRight = toDips.Transform(new Point(area.Right, area.Bottom));
        var topLeft = toDips.Transform(new Point(area.Left, area.Top));
        UpdateLayout();
        Left = topLeft.X + (bottomRight.X - topLeft.X - ActualWidth) / 2;
        Top = bottomRight.Y - ActualHeight - BottomMargin;
    }

    private void MicrophoneButton_Click(object sender, RoutedEventArgs e) => StopRequested?.Invoke(this, EventArgs.Empty);

    private void CancelButton_Click(object sender, RoutedEventArgs e) => CancelRequested?.Invoke(this, EventArgs.Empty);
}
