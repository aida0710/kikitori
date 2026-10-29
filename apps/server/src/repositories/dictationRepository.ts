/** 音声入力の履歴。本文は利用者の設定（saveHistory）が有効なときだけ保存する。 */
import type { DatabaseSync } from "node:sqlite";
import type { Dictation } from "@kikitori/protocol";

interface DictationRow {
  id: number;
  client: string | null;
  started_at: string;
  ended_at: string | null;
  audio_ms: number;
  segment_count: number;
  raw_text: string | null;
  corrected_text: string | null;
  correction_model: string | null;
  input_tokens: number;
  output_tokens: number;
  max_correction_ms: number | null;
  error: string | null;
}

export interface DictationOutcome {
  endedAt: Date;
  audioMs: number;
  segmentCount: number;
  rawText: string | null;
  correctedText: string | null;
  correctionModel: string | null;
  inputTokens: number;
  outputTokens: number;
  maxCorrectionMs: number | null;
  error: string | null;
}

function toDictation(row: DictationRow): Dictation {
  return {
    id: row.id,
    client: row.client,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    audioMs: row.audio_ms,
    segmentCount: row.segment_count,
    rawText: row.raw_text,
    correctedText: row.corrected_text,
    correctionModel: row.correction_model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    maxCorrectionMs: row.max_correction_ms,
    error: row.error,
  };
}

export class DictationRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  start(input: { userId: number; accessKeyId: number | null; client: string | null }): number {
    const result = this.database
      .prepare("INSERT INTO dictations (user_id, access_key_id, client, started_at) VALUES (?, ?, ?, ?)")
      .run(input.userId, input.accessKeyId, input.client, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  finish(id: number, outcome: DictationOutcome): void {
    this.database
      .prepare(
        `UPDATE dictations SET ended_at = ?, audio_ms = ?, segment_count = ?, raw_text = ?,
           corrected_text = ?, correction_model = ?, input_tokens = ?, output_tokens = ?,
           max_correction_ms = ?, error = ?
         WHERE id = ?`,
      )
      .run(
        outcome.endedAt.toISOString(),
        outcome.audioMs,
        outcome.segmentCount,
        outcome.rawText,
        outcome.correctedText,
        outcome.correctionModel,
        outcome.inputTokens,
        outcome.outputTokens,
        outcome.maxCorrectionMs,
        outcome.error,
        id,
      );
  }

  listForUser(userId: number, limit: number): Dictation[] {
    const rows = this.database
      .prepare("SELECT * FROM dictations WHERE user_id = ? ORDER BY id DESC LIMIT ?")
      .all(userId, limit) as unknown as DictationRow[];
    return rows.map(toDictation);
  }

  delete(input: { id: number; userId: number }): boolean {
    return this.database.prepare("DELETE FROM dictations WHERE id = ? AND user_id = ?").run(input.id, input.userId)
      .changes > 0;
  }
}
