# 文字起こしの常駐プロセスの WebSocket（API サーバー ↔ asr-worker）

`asr-worker` は GPU の計算機で動く内部の口です。API サーバーだけがつなぎます。

- URL: `ws://<asr-worker>:8781/v1/stream`。`KIKITORI_ASR_TOKEN` を設定したときは `Authorization: Bearer <token>` が要ります。
- 状態の確認: `GET /healthz` → `{"ready":true,"model":"Qwen/Qwen3-ASR-1.7B","language":"Japanese"}`

## 手順

1. API サーバーが `{"type":"start","context":"登録した言葉 …"}` を送る。`context` は Qwen3-ASR の文脈の文で、固有名詞の表記を寄せるのに使う。
2. `{"type":"ready","model":"…"}` が届く。
3. 音声（16kHz・モノラル・16bit の PCM）をバイナリで送る。
4. 話し終えたら `{"type":"stop"}`。取り消すなら `{"type":"cancel"}`。

届くもの:

| 知らせ | 意味 |
|---|---|
| `{"type":"partial","segment":0,"text":"…","audioMs":3200,"decodeMs":61.8}` | 話している区切りの途中結果。0.5 秒ごと |
| `{"type":"segment","segment":0,"text":"…","audioMs":…,"decodeMs":…,"closedToFinalMs":…}` | 閉じた区切りの確定した文 |
| `{"type":"end","segments":2}` | 終わり（取り消したときは `"cancelled":true`） |
| `{"type":"error","message":"…"}` | 失敗。このあと接続を閉じる |

## 区切りと解き直し

- Silero VAD（32ms の窓）で声の始まりを見つけ、その 0.3 秒前から区切りに入れる。無音が 0.6 秒続いたら閉じる。12 秒を超えたら 0.16 秒の無音で閉じ、17 秒で必ず閉じる。
- 話している区切りは、0.5 秒分の音声が増えるたびに、区切りの頭からの音声を全部入れ直して解き直す（Qwen3-ASR のストリーミングと同じ考え方）。3 回目からは、前回の結果の末尾 5 トークンを戻した文を続きの手がかりにする。
- 解き直しは GPU で 1 本ずつ順に行う。閉じた区切りの確定を、話している区切りの途中結果より先にする。

## 計測（2026-10-29、RTX 3080 Ti、Qwen3-ASR-1.7B）

- 起動から準備完了まで 45 秒。GPU メモリ約 6GB（`gpu_memory_utilization` 0.65）。
- 解き直し 1 回: 区切りの頭で約 50ms、23 秒の音声で約 105ms。
- 区切りが閉じてから確定の文が出るまで 60〜100ms。
