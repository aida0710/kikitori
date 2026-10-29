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

export const userSettingsSchema = z.object({
  // 添削で使う言葉（人名・製品名など）。1 行に 1 つ
  terms: z.string().max(20000),
  // 添削への追加の指示
  instructions: z.string().max(4000),
  saveHistory: z.boolean(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export interface User {
  id: number;
  username: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
}

export interface AccessKey {
  id: number;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** 作った直後だけ鍵そのものを返す。以後は prefix しか見られない。 */
export interface CreatedAccessKey extends AccessKey {
  key: string;
}

export interface Dictation {
  id: number;
  client: string | null;
  startedAt: string;
  endedAt: string | null;
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

export interface ServerStatus {
  asr: { reachable: boolean; model: string | null };
  correction: { configured: boolean };
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
