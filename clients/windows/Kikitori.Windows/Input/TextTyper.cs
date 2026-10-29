using System.ComponentModel;
using System.Runtime.InteropServices;
using Kikitori.Windows.Native;

namespace Kikitori.Windows.Input;

/// <summary>
/// 文字を、いま前面にあるアプリへキー入力（SendInput の KEYEVENTF_UNICODE）として送る。
/// 管理者として動くアプリへは、Windows が送らせない（UIPI）。
///
/// IME がオン（ひらがなの入力）だと、送った文字が IME に取り込まれて読みとして変換されてしまう。
/// そのときは「IME オフのキー → 文字 → IME オンのキー」を 1 回の SendInput で送る。
/// キー入力は送った順に処理されるので、文字が入り終わってから IME が元に戻る。
/// </summary>
internal static class TextTyper
{
    private const uint ImeQueryTimeoutMilliseconds = 200;

    public static void Type(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return;
        }
        // 改行は送らない（チャットのアプリでは Enter で送信されてしまうため）
        var characters = text.Replace("\r", "").Replace("\n", "");
        var imeWasOpen = IsForegroundImeOpen();
        var inputs = new List<NativeMethods.INPUT>(characters.Length * 2 + 4);
        if (imeWasOpen)
        {
            inputs.AddRange(VirtualKeyPress(NativeMethods.VK_IME_OFF));
        }
        foreach (var character in characters)
        {
            // サロゲートペアも UTF-16 の 1 単位ずつ送ればよい（受け取る側で 1 文字に戻る）
            inputs.Add(UnicodeKey(character, keyUp: false));
            inputs.Add(UnicodeKey(character, keyUp: true));
        }
        if (imeWasOpen)
        {
            inputs.AddRange(VirtualKeyPress(NativeMethods.VK_IME_ON));
        }
        var sent = NativeMethods.SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf<NativeMethods.INPUT>());
        if (sent != inputs.Count)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "SendInput did not send every key");
        }
    }

    /// <summary>前面のアプリの入力欄で IME がオンか。IMM の窓に尋ねる（TSF の IME も同じ答えを返す）。</summary>
    private static bool IsForegroundImeOpen()
    {
        var foreground = NativeMethods.GetForegroundWindow();
        var thread = NativeMethods.GetWindowThreadProcessId(foreground, out _);
        var info = new NativeMethods.GUITHREADINFO { cbSize = Marshal.SizeOf<NativeMethods.GUITHREADINFO>() };
        var focus = NativeMethods.GetGUIThreadInfo(thread, ref info) && info.hwndFocus != 0 ? info.hwndFocus : foreground;
        var imeWindow = NativeMethods.ImmGetDefaultIMEWnd(focus);
        if (imeWindow == 0)
        {
            return false;
        }
        // 応答しないアプリで止まらないように、短い時間で諦める
        var answered = NativeMethods.SendMessageTimeout(
            imeWindow, NativeMethods.WM_IME_CONTROL, NativeMethods.IMC_GETOPENSTATUS, 0,
            NativeMethods.SMTO_ABORTIFHUNG, ImeQueryTimeoutMilliseconds, out var open);
        return answered != 0 && open != 0;
    }

    private static IEnumerable<NativeMethods.INPUT> VirtualKeyPress(ushort virtualKey)
    {
        foreach (var keyUp in new[] { false, true })
        {
            yield return new NativeMethods.INPUT
            {
                type = NativeMethods.INPUT_KEYBOARD,
                U = new NativeMethods.InputUnion
                {
                    ki = new NativeMethods.KEYBDINPUT
                    {
                        wVk = virtualKey,
                        dwFlags = keyUp ? NativeMethods.KEYEVENTF_KEYUP : 0,
                    },
                },
            };
        }
    }

    private static NativeMethods.INPUT UnicodeKey(char character, bool keyUp)
    {
        return new NativeMethods.INPUT
        {
            type = NativeMethods.INPUT_KEYBOARD,
            U = new NativeMethods.InputUnion
            {
                ki = new NativeMethods.KEYBDINPUT
                {
                    wVk = 0,
                    wScan = character,
                    dwFlags = NativeMethods.KEYEVENTF_UNICODE | (keyUp ? NativeMethods.KEYEVENTF_KEYUP : 0),
                },
            },
        };
    }
}
