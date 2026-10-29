using System.Drawing;
using Forms = System.Windows.Forms;

namespace Kikitori.Windows.Ui;

/// <summary>タスクトレイのアイコンとメニュー。</summary>
internal sealed class TrayIcon : IDisposable
{
    private static readonly Uri IconUri = new("pack://application:,,,/Assets/Kikitori.ico");

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
            Icon = LoadIcon(),
            Text = UiText.TrayTooltip(AppVersion.Text),
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

    /// <summary>exe と同じアイコンを、タスクトレイの大きさ（画面の拡大率で変わる）で読む。</summary>
    private static Icon LoadIcon()
    {
        using var stream = System.Windows.Application.GetResourceStream(IconUri).Stream;
        return new Icon(stream, Forms.SystemInformation.SmallIconSize);
    }

    public void Dispose()
    {
        notifyIcon.Visible = false;
        notifyIcon.Dispose();
    }
}
