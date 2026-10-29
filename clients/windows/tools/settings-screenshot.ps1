# 常駐の Kikitori を開き、もう一度開いて設定画面を出させ、デスクトップを撮る（README の画面の画像を撮るため）。
#   pwsh -File settings-screenshot.ps1 -Folder C:\kikitori
param([string]$Folder = 'C:\kikitori')
$ErrorActionPreference = 'Stop'
$ffmpeg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe | Select-Object -First 1 -ExpandProperty FullName
Get-Process Kikitori -ErrorAction SilentlyContinue | Stop-Process -Force
$exe = Join-Path $Folder 'Kikitori.exe'
Start-Process $exe
# 縮めた 1 ファイルの exe は、起動のときに展開するので少し待つ
Start-Sleep -Seconds 4
& $ffmpeg -hide_banner -loglevel error -y -f gdigrab -i desktop -frames:v 1 (Join-Path $Folder 'shot-tray.png')
Start-Process $exe
Start-Sleep -Seconds 3
& $ffmpeg -hide_banner -loglevel error -y -f gdigrab -i desktop -frames:v 1 (Join-Path $Folder 'shot-settings.png')
"running instances: $((Get-Process Kikitori -ErrorAction SilentlyContinue).Count)"
"registered to start with Windows: $([bool](Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name Kikitori -ErrorAction SilentlyContinue))"
Get-Process Kikitori -ErrorAction SilentlyContinue | Stop-Process -Force
