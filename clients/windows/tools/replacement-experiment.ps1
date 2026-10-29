# 打った文を Backspace と文字の送り方を変えて置き換え、メモ帳と Edge の入力欄で崩れないかを比べる（置き換えの方式を決めるための実験）。
#   pwsh -File replacement-experiment.ps1 -Folder C:\kikitori [-Target notepad|edge]
param([string]$Folder = 'C:\kikitori', [string]$Target = 'notepad')
$ErrorActionPreference = 'Stop'
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Threading; using System.Collections.Generic;
public static class Keys {
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint period);
    [DllImport("winmm.dll")] public static extern uint timeEndPeriod(uint period);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    static INPUT Key(ushort vk, ushort scan, uint flags) { var i = new INPUT { type = 1 }; i.u.ki = new KEYBDINPUT { wVk = vk, wScan = scan, dwFlags = flags }; return i; }
    static void Send(List<INPUT> inputs) { var array = inputs.ToArray(); if (SendInput((uint)array.Length, array, Marshal.SizeOf<INPUT>()) != array.Length) throw new Exception("SendInput failed"); }
    public static void Type(string text) { var l = new List<INPUT>(); foreach (var c in text) { l.Add(Key(0, c, 4)); l.Add(Key(0, c, 6)); } Send(l); }
    public static void Backspace(int count) { var l = new List<INPUT>(); for (var i = 0; i < count; i++) { l.Add(Key(8, 0, 0)); l.Add(Key(8, 0, 2)); } Send(l); }
    public static void BackspaceAsUnicode(int count) { var l = new List<INPUT>(); for (var i = 0; i < count; i++) { l.Add(Key(0, 8, 4)); l.Add(Key(0, 8, 6)); } Send(l); }
    public static void SelectLeft(int count) { var l = new List<INPUT>(); l.Add(Key(0x10, 0, 0)); for (var i = 0; i < count; i++) { l.Add(Key(0x25, 0, 1)); l.Add(Key(0x25, 0, 3)); } l.Add(Key(0x10, 0, 2)); Send(l); }
    // 1 キーずつ SendInput を呼び、あいだを gapMs 空ける
    public static void BackspacePaced(int count, int gapMs) { for (var i = 0; i < count; i++) { Send(new List<INPUT> { Key(8, 0, 0), Key(8, 0, 2) }); if (gapMs > 0) Thread.Sleep(gapMs); } }
    public static void TypePaced(string text, int gapMs) { foreach (var c in text) { Send(new List<INPUT> { Key(0, c, 4), Key(0, c, 6) }); Thread.Sleep(gapMs); } }
    public static void Chord(ushort modifier, ushort vk) { Send(new List<INPUT> { Key(modifier, 0, 0), Key(vk, 0, 0), Key(vk, 0, 2), Key(modifier, 0, 2) }); }
}
'@
$typed = '果たしてこのフェザー級の物語はどういった展開になっていくんでしょうか。サスケくんが行くスタートわずかなのだ。サードステージをクリアするか。集中しています。そしてスパイダーワーク。さあいいテンポなのだ。スパイダードロップ波動剣で切り返すカウンターが決まったのだ。アッパー、悠々行く。'
$final = '果たしてこのフェザー級の物語はどういった展開になっていくんでしょうか。サスケくんが行く。スタート、わずかなのだ。サードステージをクリアするか。集中しています。そしてスパイダーウォーク。さあ、いいテンポなのだ。スパイダードロップ、波動剣で切り返す。カウンターが決まったのだ。アッパー、悠々行く。'
$common = 0
while ($common -lt $typed.Length -and $common -lt $final.Length -and $typed[$common] -eq $final[$common]) { $common++ }
$deleteCount = $typed.Length - $common
$insert = $final.Substring($common)
"delete $deleteCount, insert $($insert.Length)"

$notepadState = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState'
$variants = @(
    @{ Name = 'burst'; Run = { [Keys]::Backspace($deleteCount); [Keys]::Type($insert) } },
    @{ Name = 'paced-20ms'; Run = { [void][Keys]::timeBeginPeriod(1); [Keys]::BackspacePaced($deleteCount, 20); [void][Keys]::timeEndPeriod(1); [Keys]::Type($insert) } }
)
$edge = Get-ChildItem 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($Target -eq 'edge') {
    foreach ($variant in $variants) {
        Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 1
        $profile = Join-Path $Folder 'edge-profile'
        Start-Process $edge -ArgumentList "--user-data-dir=`"$profile`"", '--no-first-run', '--new-window', 'data:text/html,<textarea autofocus style="width:95vw;height:90vh"></textarea>'
        Start-Sleep -Seconds 4
        $window = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1 -ExpandProperty MainWindowHandle
        [void][Keys]::ShowWindow($window, 3)
        [void][Keys]::SetForegroundWindow($window)
        Start-Sleep -Seconds 1
        [Keys]::Type($typed)
        Start-Sleep -Seconds 2
        & $variant.Run
        Start-Sleep -Seconds 2
        Set-Clipboard -Value 'empty'
        [Keys]::Chord(0x11, 0x41)
        Start-Sleep -Milliseconds 300
        [Keys]::Chord(0x11, 0x43)
        Start-Sleep -Milliseconds 500
        $result = (Get-Clipboard -Raw)
        "--- edge $($variant.Name): $(if ($result -eq $final) { 'OK' } else { 'BROKEN' })"
        if ($result -ne $final) { $result }
    }
    Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $Folder 'edge-profile')
    return
}
foreach ($variant in $variants) {
    Get-Process Notepad -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 500
    foreach ($part in 'TabState', 'WindowState') { Remove-Item (Join-Path $notepadState "$part\*") -Force -ErrorAction SilentlyContinue }
    $document = Join-Path $Folder "experiment-$($variant.Name).txt"
    Set-Content -Path $document -Value '' -NoNewline
    Start-Process notepad.exe -ArgumentList "`"$document`""
    $window = [IntPtr]::Zero
    for ($i = 0; $i -lt 50 -and $window -eq [IntPtr]::Zero; $i++) {
        Start-Sleep -Milliseconds 200
        $found = Get-Process Notepad -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1
        if ($found) { $window = $found.MainWindowHandle }
    }
    [void][Keys]::ShowWindow($window, 3)
    [void][Keys]::SetForegroundWindow($window)
    Start-Sleep -Seconds 2
    [Keys]::Type($typed)
    Start-Sleep -Seconds 2
    $watch = [Diagnostics.Stopwatch]::StartNew()
    & $variant.Run
    $sendMs = $watch.ElapsedMilliseconds
    Start-Sleep -Seconds 2
    [Keys]::Chord(0x11, 0x53)
    Start-Sleep -Seconds 1
    $result = Get-Content -Raw -Encoding UTF8 $document
    "--- $($variant.Name): $(if ($result -eq $final) { 'OK' } else { 'BROKEN' }) (sending took $sendMs ms)"
    if ($result -ne $final) { $result }
}
Get-Process Notepad -ErrorAction SilentlyContinue | Stop-Process -Force
