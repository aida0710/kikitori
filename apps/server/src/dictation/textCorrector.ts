/** 1 回の音声入力の全文を清書する。Claude（claudeCorrector.ts）と、そのまま返すものがある。 */

export interface CorrectionRequest {
  // 清書する全文（話し終えたあとの文字起こしの結果）
  text: string;
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
