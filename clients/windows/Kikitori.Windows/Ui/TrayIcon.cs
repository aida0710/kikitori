using System.Drawing;
using System.Drawing.Drawing2D;
using Forms = System.Windows.Forms;

namespace Kikitori.Windows.Ui;

/// <summary>タスクトレイのアイコンとメニュー。</summary>
internal sealed class TrayIcon : IDisposable
{
    private readonly Forms.NotifyIcon notifyIcon;
    private readonly Forms.ToolStripMenuItem startItem;

    public event EventHandler? StartRequested;
    public event EventHandler? SettingsRequested;
    public event EventHandler? ExitRequested;

    public TrayIcon(string hotkey)
    {
        startItem = new Forms.ToolStripMenuItem(UiText.TrayStart(hotkey), null, (_, _) => StartRequested?.Invoke(this, EventArgs.Empty));
        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add(startItem);
        menu.Items.Add(new Forms.ToolStripMenuItem(UiText.TraySettings, null, (_, _) => SettingsRequested?.Invoke(this, EventArgs.Empty)));
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add(new Forms.ToolStripMenuItem(UiText.TrayExit, null, (_, _) => ExitRequested?.Invoke(this, EventArgs.Empty)));
        notifyIcon = new Forms.NotifyIcon
        {
            Icon = DrawIcon(),
            Text = UiText.TrayTooltip,
            ContextMenuStrip = menu,
            Visible = true,
        };
        notifyIcon.MouseClick += (_, e) =>
        {
            if (e.Button == Forms.MouseButtons.Left)
            {
                StartRequested?.Invoke(this, EventArgs.Empty);
            }
        };
    }

    public void SetHotkey(string hotkey) => startItem.Text = UiText.TrayStart(hotkey);

    /// <summary>アイコンのファイルを持たずに、印の色（#00B9B1）の丸とマイクの形を描く。</summary>
    private static Icon DrawIcon()
    {
        using var bitmap = new Bitmap(32, 32);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var disc = new SolidBrush(Color.FromArgb(0x00, 0xB9, 0xB1));
            graphics.FillEllipse(disc, 1, 1, 30, 30);
            using var ink = new SolidBrush(Color.FromArgb(0x15, 0x15, 0x15));
            using var path = new GraphicsPath();
            path.AddArc(12, 6, 8, 8, 180, 180);
            path.AddArc(12, 12, 8, 8, 0, 180);
            path.CloseFigure();
            graphics.FillPath(ink, path);
            using var pen = new Pen(ink.Color, 2);
            graphics.DrawArc(pen, 9, 10, 14, 12, 0, 180);
            graphics.DrawLine(pen, 16, 22, 16, 26);
        }
        return Icon.FromHandle(bitmap.GetHicon());
    }

    public void Dispose()
    {
        notifyIcon.Visible = false;
        notifyIcon.Dispose();
    }
}
