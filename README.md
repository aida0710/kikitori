# Kikitori

話した言葉をストリーミングで文字起こしし、区切りごとにClaudeで清書して入力欄へ入れる音声入力です。

- 文字起こし: GPUの計算機で[Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR)（1.7B、vLLM）を動かします。話している途中の結果を0.5秒ごとに出し直し、0.6秒の無音で区切りを確定します。
- 清書: 確定した区切りを、Claude（既定はClaude Haiku 5.5）で言い淀みを消し句読点を整えた文にします。それまでに入れた文を文脈として渡します。
- 入力: Windowsは常駐のアプリが画面の下の小窓に途中結果を出し、確定した区切りを`SendInput`で前面のアプリへ打ち込みます。Androidは音声入力だけのキーボードで、Gboardなどから切り替えて話し、終わると元のキーボードへ戻ります。
- 管理画面: アクセスキー・履歴・清書に使う言葉・利用者・清書のモデルを管理します。

## 構成

| 置き場所 | 中身 |
|---|---|
| `asr-worker/` | 文字起こしの常駐プロセス（Python、Qwen3-ASR・Silero VAD）。GPUの計算機で動かす内部の口 |
| `apps/server/` | APIサーバー（Node.js 24、Hono、SQLite）。端末の音声を文字起こしへ流し、清書して返す。管理画面も出す |
| `apps/web/` | 管理画面（React、Vite、Tailwind CSS、[Mado Design System](https://github.com/aida0710/mado-design-systems)） |
| `packages/protocol/` | APIサーバーと端末・管理画面の要求と応答の形（zod） |
| `clients/windows/` | Windowsの常駐アプリ（.NET 10、WPF） |
| `clients/android/` | Androidの音声入力のキーボード（Kotlin、API 28以上） |
| `deploy/gpu3080/` | GPUの計算機に文字起こしとAPIサーバーを置くDocker Compose |
| `docs/` | 音声入力のWebSocketの手順（`dictation-protocol.md`）、文字起こしの常駐プロセスの手順（`asr-worker-protocol.md`） |

## サーバーを動かす

NVIDIAのGPU（12GB以上）とNVIDIA Container Toolkitが要ります。

```sh
# モデルの重みを置く（初回だけ）
mkdir -p ~/models/hf
docker run --rm -v ~/models/hf:/hf -e HF_HOME=/hf --entrypoint huggingface-cli \
  qwenllm/qwen3-asr:latest download Qwen/Qwen3-ASR-1.7B

# 鍵を置く（管理者の最初のパスワードと、清書に使うClaudeのAPIキー）
mkdir -p ~/.config/kikitori ~/.local/share/kikitori
chmod 700 ~/.config/kikitori
printf '%s\n' '<管理者のパスワード>' > ~/.config/kikitori/admin-password
printf '%s\n' '<ClaudeのAPIキー>' > ~/.config/kikitori/anthropic-api-key
chmod 600 ~/.config/kikitori/*

# 起動する（compose.yaml の ports の 10.0.10.178 は、サーバーのアドレスに合わせて変えます）
docker compose -f deploy/gpu3080/compose.yaml up -d --build
```

`http://<サーバー>:8780/`を開き、ユーザー名`admin`と上のパスワードでログインします。ClaudeのAPIキーを置かないときは、清書せずに文字起こしの結果をそのまま返します。

## 端末をつなぐ

1. 管理画面の「アクセスキー」でキーを作ります。キーは作った直後に一度だけ表示します。
2. Windows: [リリース](https://github.com/aida0710/kikitori/releases)の`Kikitori-windows-x64.zip`を展開して`Kikitori.exe`を起動し、設定画面にサーバーのURLとアクセスキーを入れます。入力欄を選んでから**Ctrl+Alt+Space**で話し始め、もう一度押すか8秒黙ると止まります。
3. Android: リリースのAPKを入れてKikitoriのアプリを開き、マイクを許可し、Kikitoriのキーボードをオンにして、サーバーのURLとアクセスキーを入れます。入力中にキーボードの切り替えでKikitoriを選ぶと、すぐに聞き始めます。

## 開発

```sh
npm install
npm test               # APIサーバーの試験（vitest）
npm run typecheck
npm run dev:server     # APIサーバー（KIKITORI_ASR_URL で文字起こしの場所を指す）
npm run dev:web        # 管理画面（/api と /v1 を KIKITORI_API_SERVER へ中継）
```

- Windowsのアプリ: `clients/windows`で`dotnet publish -c Release`。Linuxの`mcr.microsoft.com/dotnet/sdk:10.0`でも組み立てられます。
- Androidのアプリ: `clients/android/tools/android-sdk.Dockerfile`からイメージ`kikitori-android-sdk:37`を作り、`clients/android/tools/build-apk.sh`。

## ライセンス

[Apache License 2.0](LICENSE)です。
