# 音声入力の WebSocket（端末 ↔ API サーバー）

端末（Windows・Android・管理画面の試し入力）は `/v1/dictation` に WebSocket でつなぎ、音声を送って清書した文を受け取ります。型は `packages/protocol/src/dictation.ts` にあります。

## 接続

- URL: `ws://<サーバー>:8780/v1/dictation`（TLS の後ろでは `wss://`）
- 認証: `Authorization: Bearer kkt_…`（管理画面で作るアクセスキー）。ブラウザーはログインの cookie で入れます。
- 1 つの接続で 1 回の音声入力です。終われば、サーバーが `end` を送ってから閉じます。

## 端末から送るもの

| 送るもの | 形 | 意味 |
|---|---|---|
| `{"type":"start","client":"windows","correction":true}` | 文字 | 最初に 1 回だけ。`correction: false` で清書を切ります |
| 音声 | バイナリ | 16kHz・モノラル・16bit（リトルエンディアン）の PCM。100ms（3,200 バイト）ずつを勧めます |
| `{"type":"stop"}` | 文字 | 話し終えた。残りの音声を確定・清書してから `end` が届きます |
| `{"type":"cancel"}` | 文字 | 取り消す。清書を待たずに `end`（`cancelled: true`）が届きます |

`start` を送ったら、`ready` を待たずに音声を送り始めてかまいません（サーバーが貯めて渡します）。

## サーバーから届くもの

| 知らせ | 意味 |
|---|---|
| `{"type":"ready","dictationId":12}` | 文字起こしの準備ができた |
| `{"type":"partial","segment":0,"text":"…"}` | 話している区切りの途中結果（清書前）。同じ `segment` は後のもので置き換えます |
| `{"type":"segment","segment":0,"raw":"…","text":"…","corrected":true}` | 確定した区切り。`text` が入力欄へ入れる文です。`segment` の順に 1 回ずつ届きます |
| `{"type":"end","text":"…","cancelled":false}` | 終わり。`text` は全区切りの `text` をつないだもの |
| `{"type":"error","code":"asr_unavailable","message":"…"}` | 失敗。このあと `end` が届きます |

区切りは、無音が 0.6 秒続いたところで閉じます。長く話し続けたときは、12 秒を超えたあとの短い間（0.16 秒）で閉じます。

清書に失敗した区切り（Claude の失敗・断り）は、`corrected: false` で文字起こしの結果をそのまま返します。中身が言い淀みだけの区切りは `text` が空になります。

## 入力欄への入れ方（端末の決まり）

- `segment` が届くたびに、その `text` を入力欄の後ろに足します。入れた文字は消しません。
- `partial` は端末の画面（Windows の小窓、Android の未確定の文字）にだけ出します。
