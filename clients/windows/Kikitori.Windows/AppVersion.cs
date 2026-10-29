namespace Kikitori.Windows;

/// <summary>このアプリのバージョン（csproj の Version）。「0.1.0」の形。</summary>
internal static class AppVersion
{
    public static string Text => typeof(AppVersion).Assembly.GetName().Version?.ToString(3) ?? "";
}
