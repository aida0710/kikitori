using System.Windows.Input;
using System.Windows.Interop;
using Kikitori.Windows.Native;

namespace Kikitori.Windows.Input;

/// <summary>どのアプリが前面にあっても効くショートカット（RegisterHotKey）。</summary>
internal sealed class GlobalHotkey : IDisposable
{
    private const int HotkeyId = 0x4B4B; // "KK"
    private readonly HwndSource source;
    private bool registered;

    public event EventHandler? Pressed;

    public GlobalHotkey()
    {
        // メッセージを受けるだけの見えない窓
        source = new HwndSource(new HwndSourceParameters("KikitoriHotkey") { Width = 0, Height = 0, WindowStyle = 0 });
        source.AddHook(WindowProcedure);
    }

    /// <summary>"Ctrl+Alt+Space" のような書き方を登録する。ほかのアプリが使っていれば false。</summary>
    public bool Register(string shortcut)
    {
        Unregister();
        var (modifiers, key) = Parse(shortcut);
        var virtualKey = (uint)KeyInterop.VirtualKeyFromKey(key);
        registered = NativeMethods.RegisterHotKey(source.Handle, HotkeyId, modifiers | NativeMethods.MOD_NOREPEAT, virtualKey);
        return registered;
    }

    public static (uint Modifiers, Key Key) Parse(string shortcut)
    {
        uint modifiers = 0;
        Key? key = null;
        foreach (var part in shortcut.Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            switch (part.ToLowerInvariant())
            {
                case "ctrl":
                case "control":
                    modifiers |= NativeMethods.MOD_CONTROL;
                    break;
                case "alt":
                    modifiers |= NativeMethods.MOD_ALT;
                    break;
                case "shift":
                    modifiers |= NativeMethods.MOD_SHIFT;
                    break;
                case "win":
                    modifiers |= NativeMethods.MOD_WIN;
                    break;
                default:
                    key = Enum.Parse<Key>(part, ignoreCase: true);
                    break;
            }
        }
        if (key is null || modifiers == 0)
        {
            throw new FormatException($"Shortcut needs a modifier and a key: {shortcut}");
        }
        return (modifiers, key.Value);
    }

    private void Unregister()
    {
        if (registered)
        {
            NativeMethods.UnregisterHotKey(source.Handle, HotkeyId);
            registered = false;
        }
    }

    private nint WindowProcedure(nint hwnd, int message, nint wParam, nint lParam, ref bool handled)
    {
        if (message == NativeMethods.WM_HOTKEY && wParam == HotkeyId)
        {
            handled = true;
            Pressed?.Invoke(this, EventArgs.Empty);
        }
        return 0;
    }

    public void Dispose()
    {
        Unregister();
        source.Dispose();
    }
}
