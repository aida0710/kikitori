/** API サーバー（/api）の呼び出し。応答は @kikitori/protocol の zod で確かめる。 */
import { isApiError, jsonRequestInit, NETWORK_ERROR_CODE, requestJson } from "../lib/http.ts";
import {
  accessKeySchema,
  anthropicApiKeyStatusSchema,
  createdAccessKeySchema,
  dictationSchema,
  serverSettingsSchema,
  serverStatusSchema,
  userSchema,
  userSettingsSchema,
  type ServerSettings,
  type UserRole,
  type UserSettings,
} from "@kikitori/protocol";
import { z } from "zod";

const noContent = z.unknown();

export const kikitoriApi = {
  me: (signal?: AbortSignal) => requestJson("/api/me", { schema: userSchema, init: { signal } }),
  login: (username: string, password: string) =>
    requestJson("/api/auth/login", { schema: userSchema, init: jsonRequestInit("POST", { username, password }) }),
  logout: () => requestJson("/api/auth/logout", { schema: noContent, init: jsonRequestInit("POST") }),
  changePassword: (currentPassword: string, newPassword: string) =>
    requestJson("/api/me/password", {
      schema: noContent,
      init: jsonRequestInit("PUT", { currentPassword, newPassword }),
    }),

  status: (signal?: AbortSignal) => requestJson("/api/status", { schema: serverStatusSchema, init: { signal } }),

  accessKeys: (signal?: AbortSignal) =>
    requestJson("/api/access-keys", { schema: z.array(accessKeySchema), init: { signal } }),
  createAccessKey: (name: string) =>
    requestJson("/api/access-keys", { schema: createdAccessKeySchema, init: jsonRequestInit("POST", { name }) }),
  deleteAccessKey: (id: number) =>
    requestJson(`/api/access-keys/${id}`, { schema: noContent, init: jsonRequestInit("DELETE") }),

  dictations: (signal?: AbortSignal) =>
    requestJson("/api/dictations", { schema: z.array(dictationSchema), init: { signal } }),
  deleteDictation: (id: number) =>
    requestJson(`/api/dictations/${id}`, { schema: noContent, init: jsonRequestInit("DELETE") }),

  userSettings: (signal?: AbortSignal) =>
    requestJson("/api/settings/me", { schema: userSettingsSchema, init: { signal } }),
  saveUserSettings: (settings: UserSettings) =>
    requestJson("/api/settings/me", { schema: userSettingsSchema, init: jsonRequestInit("PUT", settings) }),

  serverSettings: (signal?: AbortSignal) =>
    requestJson("/api/settings/server", { schema: serverSettingsSchema, init: { signal } }),
  saveServerSettings: (settings: ServerSettings) =>
    requestJson("/api/settings/server", { schema: serverSettingsSchema, init: jsonRequestInit("PUT", settings) }),

  anthropicApiKey: (signal?: AbortSignal) =>
    requestJson("/api/settings/server/anthropic-api-key", { schema: anthropicApiKeyStatusSchema, init: { signal } }),
  saveAnthropicApiKey: (apiKey: string) =>
    requestJson("/api/settings/server/anthropic-api-key", {
      schema: anthropicApiKeyStatusSchema,
      init: jsonRequestInit("PUT", { apiKey }),
    }),
  deleteAnthropicApiKey: () =>
    requestJson("/api/settings/server/anthropic-api-key", {
      schema: anthropicApiKeyStatusSchema,
      init: jsonRequestInit("DELETE"),
    }),

  users: (signal?: AbortSignal) => requestJson("/api/users", { schema: z.array(userSchema), init: { signal } }),
  createUser: (input: { username: string; password: string; role: UserRole }) =>
    requestJson("/api/users", { schema: userSchema, init: jsonRequestInit("POST", input) }),
  updateUser: (id: number, changes: { role?: UserRole; disabled?: boolean; password?: string }) =>
    requestJson(`/api/users/${id}`, { schema: userSchema, init: jsonRequestInit("PATCH", changes) }),
  deleteUser: (id: number) => requestJson(`/api/users/${id}`, { schema: noContent, init: jsonRequestInit("DELETE") }),
};

/** 失敗を画面に出す文にする。API の文はそのまま、通信の失敗だけ画面の言語で出す。 */
export function failureMessage(failure: unknown, networkError: string): string {
  if (isApiError(failure) && failure.code !== NETWORK_ERROR_CODE) {
    return failure.message;
  }
  return networkError;
}
