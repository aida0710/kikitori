using System.Runtime.InteropServices;
using Kikitori.Windows.Native;

namespace Kikitori.Windows.Input;

/// <summary>
/// 音声入力の間だけ、前面のアプリの IME をオフにする。
///
/// IME がオン（ひらがなの入力）だと、SendInput で送った文字が IME に取り込まれて変換されてしまう。
/// 区切りごとにオフ・オンを切り替えると、文字を後から処理するアプリ（Windows 11 のメモ帳など）では
/// オンが最後の数文字より先に効き、その文字が消える（Windows 11 のメモ帳で確認）。
/// そこで、始めるときに一度だけオフにして、オフになったことを確かめてから打ち、終わってから戻す。
/// </summary>
internal sealed class ImeSuspension
{
    private const uint ImeQueryTimeoutMilliseconds = 200;
    // IME がオフになるのを待つ上限。ふつうは数十 ms で閉じる。閉じなければ、そのまま打つ
    private static readonly TimeSpan CloseConfirmLimit = TimeSpan.FromMilliseconds(600);
    private static readonly TimeSpan CloseConfirmPollInterval = TimeSpan.FromMilliseconds(15);

    private readonly nint suspendedWindow;

    private ImeSuspension(nint suspendedWindow)
    {
        this.suspendedWindow = suspendedWindow;
    }

    /// <summary>前面のアプリの IME がオンなら、オフにして、それを戻すためのものを返す。オフなら null。</summary>
    public static async Task<ImeSuspension?> SuspendIfOpenAsync(Action<string> log)
    {
        var foreground = NativeMethods.GetForegroundWindow();
        var imeWindow = DefaultImeWindow(foreground);
        if (imeWindow == 0 || IsOpen(imeWindow) != true)
        {
            return null;
        }
        SendVirtualKey(NativeMethods.VK_IME_OFF);
        var deadline = DateTime.UtcNow + CloseConfirmLimit;
        while (IsOpen(imeWindow) == true)
        {
            if (DateTime.UtcNow > deadline)
            {
                log("the IME did not turn off in time");
                break;
            }
            await Task.Delay(CloseConfirmPollInterval);
        }
        return new ImeSuspension(foreground);
    }

    /// <summary>IME を戻す。オフにしたときと別のアプリが前面にあるなら、そのアプリの IME は触らない。</summary>
    public void Resume()
    {
        if (NativeMethods.GetForegroundWindow() == suspendedWindow)
        {
            SendVirtualKey(NativeMethods.VK_IME_ON);
        }
    }

    /// <summary>入力欄（フォーカスのある窓）の IME の窓。TSF の IME も、この窓で開閉を答える。</summary>
    private static nint DefaultImeWindow(nint foreground)
    {
        var thread = NativeMethods.GetWindowThreadProcessId(foreground, out _);
        var info = new NativeMethods.GUITHREADINFO { cbSize = Marshal.SizeOf<NativeMethods.GUITHREADINFO>() };
        var focus = NativeMethods.GetGUIThreadInfo(thread, ref info) && info.hwndFocus != 0 ? info.hwndFocus : foreground;
        return NativeMethods.ImmGetDefaultIMEWnd(focus);
    }

    /// <summary>IME がオンか。アプリが応答しなければ null。</summary>
    private static bool? IsOpen(nint imeWindow)
    {
        var answered = NativeMethods.SendMessageTimeout(
            imeWindow, NativeMethods.WM_IME_CONTROL, NativeMethods.IMC_GETOPENSTATUS, 0,
            NativeMethods.SMTO_ABORTIFHUNG, ImeQueryTimeoutMilliseconds, out var open);
        return answered == 0 ? null : open != 0;
    }

    private static void SendVirtualKey(ushort virtualKey)
    {
        var inputs = new[] { false, true }
            .Select(keyUp => new NativeMethods.INPUT
            {
                type = NativeMethods.INPUT_KEYBOARD,
                U = new NativeMethods.InputUnion
                {
                    ki = new NativeMethods.KEYBDINPUT { wVk = virtualKey, dwFlags = keyUp ? NativeMethods.KEYEVENTF_KEYUP : 0 },
                },
            })
            .ToArray();
        NativeMethods.SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<NativeMethods.INPUT>());
    }
}
