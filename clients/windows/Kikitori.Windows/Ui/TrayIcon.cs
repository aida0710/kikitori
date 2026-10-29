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

    /// <summary>アイコンのファイルを持たずに、管理画面のロゴと同じ紫の傾きの角丸と、白いマイクの形を描く。</summary>
    private static Icon DrawIcon()
    {
        using var bitmap = new Bitmap(32, 32);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var tile = RoundedRectangle(new RectangleF(1, 1, 30, 30), 8);
            using var gradient = new LinearGradientBrush(
                new PointF(0, 0), new PointF(32, 32), Color.FromArgb(0x8B, 0x5C, 0xF6), Color.FromArgb(0x63, 0x66, 0xF1));
            graphics.FillPath(gradient, tile);
            using var ink = new SolidBrush(Color.White);
            using var capsule = new GraphicsPath();
            capsule.AddArc(12, 6, 8, 8, 180, 180);
            capsule.AddArc(12, 12, 8, 8, 0, 180);
            capsule.CloseFigure();
            graphics.FillPath(ink, capsule);
            using var pen = new Pen(Color.White, 2);
            graphics.DrawArc(pen, 9, 10, 14, 12, 0, 180);
            graphics.DrawLine(pen, 16, 22, 16, 26);
        }
        return Icon.FromHandle(bitmap.GetHicon());
    }

    private static GraphicsPath RoundedRectangle(RectangleF bounds, float radius)
    {
        var path = new GraphicsPath();
        var diameter = radius * 2;
        path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
        path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
        path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }

    public void Dispose()
    {
        notifyIcon.Visible = false;
        notifyIcon.Dispose();
    }
}
