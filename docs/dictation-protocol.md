# 音声入力のWebSocket（端末 ↔ APIサーバー）

端末（Windows・Mac・Android・管理画面のプレイグラウンド）は`/v1/dictation`にWebSocketでつなぎ、音声を送って、文字起こしの結果と、話し終えたあとに清書した全文を受け取ります。型は`packages/protocol/src/dictation.ts`にあります。

## 接続

- URL: `ws://<サーバー>:8780/v1/dictation`（TLSの後ろでは`wss://`）
- 認証: `Authorization: Bearer kkt_…`（管理画面で作るアクセスキー）。ブラウザーはログインのcookieで入れます。
- 1つの接続で1回の音声入力です。終われば、サーバーが`end`を送ってから閉じます。

## 端末から送るもの

| 送るもの | 形 | 意味 |
|---|---|---|
| `{"type":"start","client":"windows","correction":true}` | 文字 | 最初に1回だけ。`correction: false`で清書を切ります |
| 音声 | バイナリ | 16kHz・モノラル・16bit（リトルエンディアン）のPCM。100ms（3,200バイト）ずつを勧めます |
| `{"type":"stop"}` | 文字 | 話し終えた。残りの音声を確定し、全文を清書してから`end`が届きます |
| `{"type":"cancel"}` | 文字 | 取り消す。清書を待たずに`end`（`cancelled: true`）が届きます |

`start`を送ったら、`ready`を待たずに音声を送り始めてかまいません（サーバーが貯めて渡します）。

## サーバーから届くもの

| 知らせ | 意味 |
|---|---|
| `{"type":"ready","dictationId":12}` | 文字起こしの準備ができた |
| `{"type":"partial","segment":0,"text":"…"}` | 話している区切りの途中結果（清書前）。同じ`segment`は後のもので置き換えます |
| `{"type":"segment","segment":0,"text":"…"}` | 確定した区切りの文字起こしの結果（清書前）。`segment`の順に1回ずつ届きます |
| `{"type":"end","text":"…","corrected":true,"cancelled":false}` | 終わり。`text`は入力欄に最後に残す文で、全文を1回で清書したもの |
| `{"type":"error","code":"asr_unavailable","message":"…"}` | 失敗。このあと`end`が届きます |

区切りは、無音が0.6秒続いたところで閉じます。長く話し続けたときは、12秒を超えたあとの短い間（0.16秒）で閉じます。

清書は、話し終えてから（`stop`のあと、最後の区切りが確定してから）全文を1回で行います。区切りごとに清書しないのは、後ろの文まで見えた方が、同じ読みの言葉などの誤認識を直せるためです。

清書しなかったとき（`correction: false`・Claudeのキーが無い）と、清書に失敗したとき（Claudeの失敗・断り、清書の文として使えない結果）は、`corrected: false`で文字起こしの全文を返します。中身が言い淀みだけのときは`text`が空になります。取り消したとき（`cancelled: true`）の`text`は、それまでの文字起こしの全文です。

## 入力欄への入れ方（端末の決まり）

- Windows・Mac: `partial`と`segment`は小窓にだけ出します。`end`が届いたら、その`text`を前面のアプリへ一度に打ちます。打った文をBackspaceで消して直すことはしません（Windows 11のメモ帳は、Backspaceを取りこぼし、直後の文字と順番が入れ替わるため。`clients/windows/tools/replacement-experiment.ps1`）。
- Android: `segment`が届くたびに、その`text`を入力欄の未確定の文字に足し、`partial`はその後ろに出します。`end`が届いたら、未確定の文字を`end`の`text`で確定します。
- 取り消したとき（`cancelled: true`）: Windows・Macは何も打ちません。Androidは確定した区切りの文字起こしの結果を残し、途中結果は消します。
