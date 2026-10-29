/** 確定した区切りの文を清書する。Claude（claudeCorrector.ts）と、そのまま返すものがある。 */

export interface CorrectionRequest {
  // 清書する区切りの文（文字起こしの結果）
  text: string;
  // 同じ音声入力でこれまでに清書した文。続きとして自然にするために渡し、直さない
  previousText: string;
  // 利用者が登録した言葉（人名・製品名など）
  terms: string[];
  instructions: string;
}

export interface CorrectionResult {
  text: string;
  corrected: boolean;
  inputTokens: number;
  outputTokens: number;
  elapsedMs: number;
}

export interface TextCorrector {
  readonly model: string | null;
  correct(request: CorrectionRequest, signal: AbortSignal): Promise<CorrectionResult>;
}

/** 添削を切っているとき・Claude の鍵が無いときに使う。 */
export class PassthroughCorrector implements TextCorrector {
  readonly model = null;

  async correct(request: CorrectionRequest): Promise<CorrectionResult> {
    return { text: request.text, corrected: false, inputTokens: 0, outputTokens: 0, elapsedMs: 0 };
  }
}
