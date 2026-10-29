using Microsoft.Win32;

namespace Kikitori.Windows.Settings;

/// <summary>Windows にサインインしたときに Kikitori を開くかどうか。今の利用者の Run（HKCU）に exe の場所を登録する。</summary>
internal static class StartupRegistration
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "Kikitori";

    public static bool IsEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath);
        return key?.GetValue(ValueName) is string;
    }

    /// <summary>登録するときは今の exe の場所を書く（exe を動かしたあとに開き直せば、新しい場所に直る）。</summary>
    public static void Set(bool enabled)
    {
        using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath);
        if (enabled)
        {
            key.SetValue(ValueName, $"\"{Environment.ProcessPath}\"");
        }
        else
        {
            key.DeleteValue(ValueName, throwOnMissingValue: false);
        }
    }
}
