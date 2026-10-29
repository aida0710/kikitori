using System.ComponentModel;
using System.Runtime.InteropServices;
using Kikitori.Windows.Native;

namespace Kikitori.Windows.Input;

/// <summary>
/// 文字を、いま前面にあるアプリへキー入力（SendInput の KEYEVENTF_UNICODE）として送る。
/// IME がオンだと文字が IME に取り込まれるので、呼ぶ側は先に ImeSuspension で IME をオフにしておく。
/// 管理者として動くアプリへは、Windows が送らせない（UIPI）。
/// </summary>
internal static class TextTyper
{
    public static void Type(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return;
        }
        // 改行は送らない（チャットのアプリでは Enter で送信されてしまうため）
        var characters = text.Replace("\r", "").Replace("\n", "");
        var inputs = new NativeMethods.INPUT[characters.Length * 2];
        for (var index = 0; index < characters.Length; index++)
        {
            // サロゲートペアも UTF-16 の 1 単位ずつ送ればよい（受け取る側で 1 文字に戻る）
            inputs[index * 2] = UnicodeKey(characters[index], keyUp: false);
            inputs[index * 2 + 1] = UnicodeKey(characters[index], keyUp: true);
        }
        var sent = NativeMethods.SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<NativeMethods.INPUT>());
        if (sent != inputs.Length)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "SendInput did not send every key");
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
