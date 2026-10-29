/**
 * 端末と API サーバーのあいだの音声入力の WebSocket（/v1/dictation）。
 * 手順は docs/dictation-protocol.md。音声は 16kHz・モノラル・16bit（リトルエンディアン）の
 * バイナリのフレームで送る。
 */
import { z } from "zod";

export const DICTATION_SAMPLE_RATE = 16000;

export const dictationStartMessageSchema = z.object({
  type: z.literal("start"),
  // 履歴に残す端末の名前（"windows"・"android"・"web" など）
  client: z.string().max(40).optional(),
  // false のときは添削せず、文字起こしの結果をそのまま返す
  correction: z.boolean().optional(),
});

export const dictationControlMessageSchema = z.discriminatedUnion("type", [
  dictationStartMessageSchema,
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("cancel") }),
]);

export type DictationStartMessage = z.infer<typeof dictationStartMessageSchema>;
export type DictationControlMessage = z.infer<typeof dictationControlMessageSchema>;

/** 話している区切りの途中結果。同じ segment の partial は後のもので置き換える。 */
export interface DictationPartialEvent {
  type: "partial";
  segment: number;
  text: string;
}

/** 確定した区切り。segment の順に 1 回ずつ届く。text が入力欄へ入れる文。 */
export interface DictationSegmentEvent {
  type: "segment";
  segment: number;
  raw: string;
  text: string;
  corrected: boolean;
}

export interface DictationEndEvent {
  type: "end";
  text: string;
  cancelled: boolean;
}

export interface DictationErrorEvent {
  type: "error";
  code: DictationErrorCode;
  message: string;
}

export type DictationErrorCode =
  | "invalid_message"
  | "asr_unavailable"
  | "asr_failed"
  | "internal_error";

export type DictationServerEvent =
  | { type: "ready"; dictationId: number }
  | DictationPartialEvent
  | DictationSegmentEvent
  | DictationEndEvent
  | DictationErrorEvent;
