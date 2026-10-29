# メモ帳を前面にして Kikitori に WAV を流し、入力欄に入った文を確かめる。デスクトップのセッションで実行する。
#   pwsh -File notepad-dictation-test.ps1 -Folder C:\kikitori -ServerUrl http://10.0.10.178:8780 [-ImeOn]
# Folder に Kikitori.exe・test.wav・access-key（使ったら消す）を置いておく。結果のスクリーンショットと文も Folder に出す。
param(
    [string]$Folder = 'C:\kikitori',
    [string]$ServerUrl = 'http://10.0.10.178:8780',
    [string]$Wav = 'test.wav',
    [switch]$ImeOn,
    [switch]$NoCorrection
)
$ErrorActionPreference = 'Stop'
$ffmpeg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe | Select-Object -First 1 -ExpandProperty FullName
$tag = if ($ImeOn) { 'ime-on' } else { 'ime-off' }
$microsoftImeTip = '0411:{03B5835F-F03C-411B-9CE2-AA23E1171E36}{A76C93D9-5523-4E90-AAFA-4DB112F9AC76}'

Add-Type @'
using System; using System.Runtime.InteropServices; using System.Threading;
public static class TestDesk {
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    public static void Press(byte vk) { keybd_event(vk, 0, 0, UIntPtr.Zero); Thread.Sleep(30); keybd_event(vk, 0, 2, UIntPtr.Zero); Thread.Sleep(200); }
    public static void Chord(byte modifier, byte vk) { keybd_event(modifier, 0, 0, UIntPtr.Zero); Press(vk); keybd_event(modifier, 0, 2, UIntPtr.Zero); Thread.Sleep(200); }
}
'@

function Save-Shot([string]$name) {
    & $ffmpeg -hide_banner -loglevel error -y -f gdigrab -i desktop -frames:v 1 (Join-Path $Folder "$tag-$name.png")
}

# 設定とアクセスキー（資格情報マネージャー）を入れる
$settingsFolder = Join-Path $env:APPDATA 'Kikitori'
New-Item -ItemType Directory -Force $settingsFolder | Out-Null
$correction = if ($NoCorrection) { 'false' } else { 'true' }
Set-Content -Encoding UTF8 (Join-Path $settingsFolder 'settings.json') "{`"ServerUrl`":`"$ServerUrl`",`"Hotkey`":`"Ctrl+Alt+Space`",`"AutoStopSeconds`":8,`"Correction`":$correction}"
$keyFile = Join-Path $Folder 'access-key'
if (Test-Path $keyFile) {
    $key = (Get-Content -Raw $keyFile).Trim()
    cmdkey /generic:Kikitori/AccessKey /user:kikitori /pass:$key | Out-Null
    Remove-Item $keyFile
}
$log = Join-Path $env:LOCALAPPDATA 'Kikitori\kikitori.log'
Remove-Item -ErrorAction SilentlyContinue $log

# 新しく開くアプリの入力方式を Microsoft IME にする（元の設定は最後に戻す）
$previousOverride = (Get-ItemProperty 'HKCU:\Control Panel\International\User Profile' -Name InputMethodOverride -ErrorAction SilentlyContinue).InputMethodOverride
Set-WinDefaultInputMethodOverride -InputTip $microsoftImeTip

# メモ帳は前の回の未保存の内容を開き直すので、状態を消してから開く
$notepadState = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState'
Get-Process Notepad -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500
foreach ($part in 'TabState', 'WindowState') { Remove-Item (Join-Path $notepadState "$part\*") -Force -ErrorAction SilentlyContinue }
$document = Join-Path $Folder "$tag.txt"
Set-Content -Path $document -Value '' -NoNewline
Start-Process notepad.exe -ArgumentList "`"$document`""
$window = [IntPtr]::Zero
for ($i = 0; $i -lt 50 -and $window -eq [IntPtr]::Zero; $i++) {
    Start-Sleep -Milliseconds 200
    $found = Get-Process Notepad -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1
    if ($found) { $window = $found.MainWindowHandle }
}
if ($window -eq [IntPtr]::Zero) { throw 'Notepad did not open a window' }
[void][TestDesk]::ShowWindow($window, 3)
[void][TestDesk]::SetForegroundWindow($window)
Start-Sleep -Seconds 2
if ($ImeOn) {
    # 漢字キー（VK_KANJI）で IME をオンにする（ひらがなの入力になる）
    [TestDesk]::Press(0x19)
    Start-Sleep -Milliseconds 500
}

try {
    $app = Start-Process (Join-Path $Folder 'Kikitori.exe') -ArgumentList '--wav', (Join-Path $Folder $Wav), '--start', '--exit-after-dictation' -PassThru
    Start-Sleep -Seconds 12
    Save-Shot 'during'
    "foreground is Notepad during dictation: $([TestDesk]::GetForegroundWindow() -eq $window)"
    if (-not $app.WaitForExit(120000)) { $app | Stop-Process -Force; 'Kikitori did not exit in time' }
    Save-Shot 'after'
    # Ctrl+S で保存して、入った文をファイルから読む
    [void][TestDesk]::SetForegroundWindow($window)
    Start-Sleep -Milliseconds 300
    [TestDesk]::Chord(0x11, 0x53)
    Start-Sleep -Seconds 1
    "--- typed text ---"
    Get-Content -Raw -Encoding UTF8 $document
    "--- kikitori.log ---"
    Get-Content -Encoding UTF8 $log
}
finally {
    if ($previousOverride) { Set-WinDefaultInputMethodOverride -InputTip $previousOverride } else { Remove-ItemProperty 'HKCU:\Control Panel\International\User Profile' -Name InputMethodOverride -ErrorAction SilentlyContinue }
}
