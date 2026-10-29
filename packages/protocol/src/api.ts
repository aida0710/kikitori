/** 管理画面と API サーバーのあいだの REST（/api）の要求と応答。 */
import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const usernameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dot, underscore or hyphen");
export const passwordSchema = z.string().min(8).max(256);

export const loginRequestSchema = z.object({ username: z.string(), password: z.string() });

export const createUserRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: userRoleSchema,
});

export const updateUserRequestSchema = z.object({
  role: userRoleSchema.optional(),
  disabled: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema,
});

export const createAccessKeyRequestSchema = z.object({ name: z.string().min(1).max(80) });

/** 添削のモデル。Haiku 5.5 がいちばん速い。 */
export const correctionModelSchema = z.enum([
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
  "claude-opus-5-5",
]);
export type CorrectionModel = z.infer<typeof correctionModelSchema>;

export const correctionEffortSchema = z.enum(["low", "medium", "high"]);

export const serverSettingsSchema = z.object({
  correctionEnabled: z.boolean(),
  correctionModel: correctionModelSchema,
  correctionEffort: correctionEffortSchema,
});
export type ServerSettings = z.infer<typeof serverSettingsSchema>;

/** 清書に使う Claude の API キーがどこから来ているか。キーそのものは返さない（末尾 4 文字だけ）。 */
export const anthropicApiKeyStatusSchema = z.object({
  // dashboard: 管理画面で入れたもの。server-file: サーバーの起動の設定（ANTHROPIC_API_KEY・ANTHROPIC_API_KEY_FILE）
  source: z.enum(["dashboard", "server-file"]).nullable(),
  hint: z.string().nullable(),
});
export type AnthropicApiKeyStatus = z.infer<typeof anthropicApiKeyStatusSchema>;

export const setAnthropicApiKeyRequestSchema = z.object({ apiKey: z.string().trim().min(1).max(512) });

/** API キーを保存できなかったときの code。画面はこれを見て、画面の言語の文を出す。 */
export const ANTHROPIC_API_KEY_ERROR_CODES = {
  rejected: "api_key_rejected",
  unreachable: "anthropic_unreachable",
} as const;

export const userSettingsSchema = z.object({
  // 添削で使う言葉（人名・製品名など）。1 行に 1 つ
  terms: z.string().max(20000),
  // 添削への追加の指示
  instructions: z.string().max(4000),
  saveHistory: z.boolean(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: userRoleSchema,
  disabled: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const accessKeySchema = z.object({
  id: z.number(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type AccessKey = z.infer<typeof accessKeySchema>;

/** 作った直後だけ鍵そのものを返す。以後は prefix しか見られない。 */
export const createdAccessKeySchema = accessKeySchema.extend({ key: z.string() });
export type CreatedAccessKey = z.infer<typeof createdAccessKeySchema>;

export const dictationSchema = z.object({
  id: z.number(),
  client: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  audioMs: z.number(),
  segmentCount: z.number(),
  rawText: z.string().nullable(),
  correctedText: z.string().nullable(),
  correctionModel: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  maxCorrectionMs: z.number().nullable(),
  error: z.string().nullable(),
});
export type Dictation = z.infer<typeof dictationSchema>;

export const serverStatusSchema = z.object({
  asr: z.object({ reachable: z.boolean(), model: z.string().nullable() }),
  correction: z.object({ configured: z.boolean() }),
  // ブラウザーのマイクは HTTPS でしか使えない。HTTP で開いた画面が案内に使う、このサーバーの HTTPS の入口
  httpsUrl: z.string().nullable(),
});
export type ServerStatus = z.infer<typeof serverStatusSchema>;

/** エラーの応答。error は画面にそのまま出す文、code は種類（invalid_request など）。 */
export interface ApiErrorBody {
  error: string;
  code: string;
}
