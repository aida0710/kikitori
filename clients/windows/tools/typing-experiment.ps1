# 清書した全文を入れるときの送り方（打つ・貼り付ける）を変えて、メモ帳と Edge の入力欄に崩れずに入る割合を数える（入れ方を決めるための実験）。
#   pwsh -File typing-experiment.ps1 -Folder C:\kikitori [-Repeat 10] [-Target notepad|edge]
param([string]$Folder = 'C:\kikitori', [int]$Repeat = 10, [string]$Target = 'notepad')
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
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint period);
    [DllImport("winmm.dll")] public static extern uint timeEndPeriod(uint period);
    static INPUT Key(ushort vk, ushort scan, uint flags) { var i = new INPUT { type = 1 }; i.u.ki = new KEYBDINPUT { wVk = vk, wScan = scan, dwFlags = flags }; return i; }
    static void Send(List<INPUT> inputs) { var array = inputs.ToArray(); if (SendInput((uint)array.Length, array, Marshal.SizeOf<INPUT>()) != array.Length) throw new Exception("SendInput failed"); }
    public static void TypeBurst(string text) { var l = new List<INPUT>(); foreach (var c in text) { l.Add(Key(0, c, 4)); l.Add(Key(0, c, 6)); } Send(l); }
    public static void TypePerCall(string text, int gapMs) { foreach (var c in text) { Send(new List<INPUT> { Key(0, c, 4), Key(0, c, 6) }); if (gapMs > 0) Thread.Sleep(gapMs); } }
    public static void Chord(ushort modifier, ushort vk) { Send(new List<INPUT> { Key(modifier, 0, 0), Key(vk, 0, 0), Key(vk, 0, 2), Key(modifier, 0, 2) }); }
}
'@
$final = '果たしてこのフェザー級の物語はどういった展開になっていくんでしょうか。サスケくんが行く。スタート、わずかなのだ。サードステージをクリアするか。集中しています。そしてスパイダーウォーク。さあ、いいテンポなのだ。スパイダードロップ、波動剣で切り返す。カウンターが決まったのだ。アッパー、悠々行く。'
$ffmpeg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe | Select-Object -First 1 -ExpandProperty FullName
$notepadState = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState'
$variants = @(
    @{ Name = 'burst'; Run = { [Keys]::TypeBurst($final) } },
    @{ Name = 'paste'; Run = { Set-Clipboard -Value $final; Start-Sleep -Milliseconds 200; [Keys]::Chord(0x11, 0x56) } }
)
function Open-Target {
    if ($Target -eq 'edge') {
        Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 1
        $page = Join-Path $Folder 'textarea.html'
        Set-Content -Encoding UTF8 -Path $page -Value '<!doctype html><meta charset="utf-8"><textarea id="t" autofocus style="width:95vw;height:90vh"></textarea>'
        $edge = Get-ChildItem 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        Start-Process $edge -ArgumentList "--user-data-dir=`"$(Join-Path $Folder 'edge-profile')`"", '--no-first-run', '--no-default-browser-check', '--new-window', "file:///$($page -replace '\\', '/')"
        Start-Sleep -Seconds 6
        $window = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1 -ExpandProperty MainWindowHandle
    } else {
        Get-Process Notepad -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Milliseconds 500
        foreach ($part in 'TabState', 'WindowState') { Remove-Item (Join-Path $notepadState "$part\*") -Force -ErrorAction SilentlyContinue }
        Set-Content -Path (Join-Path $Folder 'typing-experiment.txt') -Value '' -NoNewline
        Start-Process notepad.exe -ArgumentList "`"$(Join-Path $Folder 'typing-experiment.txt')`""
        $window = [IntPtr]::Zero
        for ($i = 0; $i -lt 50 -and $window -eq [IntPtr]::Zero; $i++) {
            Start-Sleep -Milliseconds 200
            $found = Get-Process Notepad -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1
            if ($found) { $window = $found.MainWindowHandle }
        }
    }
    [void][Keys]::ShowWindow($window, 3)
    [void][Keys]::SetForegroundWindow($window)
    Start-Sleep -Seconds 2
}
function Read-Target {
    if ($Target -eq 'edge') {
        Set-Clipboard -Value 'empty'
        [Keys]::Chord(0x11, 0x41)
        Start-Sleep -Milliseconds 300
        [Keys]::Chord(0x11, 0x43)
        Start-Sleep -Milliseconds 500
        return (Get-Clipboard -Raw)
    }
    [Keys]::Chord(0x11, 0x53)
    Start-Sleep -Seconds 1
    return (Get-Content -Raw -Encoding UTF8 (Join-Path $Folder 'typing-experiment.txt'))
}
foreach ($variant in $variants) {
    $ok = 0; $broken = @()
    for ($round = 1; $round -le $Repeat; $round++) {
        Open-Target
        & $variant.Run
        Start-Sleep -Seconds 2
        $result = Read-Target
        if ($round -eq 1) { & $ffmpeg -hide_banner -loglevel error -y -f gdigrab -i desktop -frames:v 1 (Join-Path $Folder "typing-$Target-$($variant.Name).png") }
        if ($result -eq $final) { $ok++ } else { $broken += $result }
    }
    "--- $Target $($variant.Name): $ok / $Repeat OK"
    $broken | ForEach-Object { "    $_" }
}
Get-Process Notepad, msedge -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $Folder 'edge-profile')
