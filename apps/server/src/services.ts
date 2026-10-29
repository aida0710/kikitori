/** サーバーが使う部品をまとめて作る。試験では asrWorker・correctorFor・checkAnthropicApiKey を差し替える。 */
import Anthropic from "@anthropic-ai/sdk";
import type { DatabaseSync } from "node:sqlite";
import type { AnthropicApiKeyStatus, ServerSettings } from "@kikitori/protocol";
import { Authenticator } from "./auth/authentication.ts";
import type { ServerConfig } from "./config.ts";
import { type AsrWorker, WebSocketAsrWorker } from "./dictation/asrWorkerClient.ts";
import { ClaudeCorrector } from "./dictation/claudeCorrector.ts";
import { PassthroughCorrector, type TextCorrector } from "./dictation/textCorrector.ts";
import { AccessKeyRepository, LoginSessionRepository } from "./repositories/credentialRepository.ts";
import { DictationRepository } from "./repositories/dictationRepository.ts";
import { SettingsRepository } from "./repositories/settingsRepository.ts";
import { UserRepository } from "./repositories/userRepository.ts";

// 画面に出す、キーの末尾の文字数（どのキーかを見分けるため）
const API_KEY_HINT_CHARACTERS = 4;
// キーを確かめる問い合わせの上限。Anthropic に届かないときに、画面を長く待たせない
const API_KEY_CHECK_TIMEOUT_MS = 10000;

export type AnthropicApiKeyCheck = "valid" | "rejected" | "unreachable";

export interface ServerServices {
  users: UserRepository;
  loginSessions: LoginSessionRepository;
  accessKeys: AccessKeyRepository;
  settings: SettingsRepository;
  dictations: DictationRepository;
  authenticator: Authenticator;
  asrWorker: AsrWorker;
  correctorFor(settings: ServerSettings): TextCorrector;
  anthropicApiKeyStatus(): AnthropicApiKeyStatus;
  checkAnthropicApiKey(apiKey: string): Promise<AnthropicApiKeyCheck>;
  secureCookies: boolean;
  httpsUrl: string | null;
}

/** Anthropic にキーを見せて、使えるかを確かめる（モデルの一覧を 1 件だけ読む）。 */
async function checkWithAnthropic(apiKey: string): Promise<AnthropicApiKeyCheck> {
  try {
    await new Anthropic({ apiKey, maxRetries: 0, timeout: API_KEY_CHECK_TIMEOUT_MS }).models.list({ limit: 1 });
    return "valid";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return "rejected";
    }
    return "unreachable";
  }
}

export function createServices(input: {
  database: DatabaseSync;
  config: ServerConfig;
  asrWorker?: AsrWorker;
  correctorFor?: (settings: ServerSettings) => TextCorrector;
  checkAnthropicApiKey?: (apiKey: string) => Promise<AnthropicApiKeyCheck>;
}): ServerServices {
  const { database, config } = input;
  const users = new UserRepository(database);
  const loginSessions = new LoginSessionRepository(database);
  const accessKeys = new AccessKeyRepository(database);
  const settings = new SettingsRepository(database);
  const passthrough = new PassthroughCorrector();
  // 管理画面で入れたキーを、サーバーの起動の設定のキーより先に使う
  const currentApiKey = () => settings.getAnthropicApiKey() ?? config.anthropicApiKey;
  const clients = new Map<string, Anthropic>();
  const clientFor = (apiKey: string) => {
    let client = clients.get(apiKey);
    if (!client) {
      client = new Anthropic({ apiKey });
      clients.clear();
      clients.set(apiKey, client);
    }
    return client;
  };
  return {
    users,
    loginSessions,
    accessKeys,
    settings,
    dictations: new DictationRepository(database),
    authenticator: new Authenticator({ users, loginSessions, accessKeys }),
    asrWorker:
      input.asrWorker ?? new WebSocketAsrWorker({ url: config.asrWorkerUrl, token: config.asrWorkerToken }),
    correctorFor:
      input.correctorFor ??
      ((serverSettings) => {
        const apiKey = currentApiKey();
        return serverSettings.correctionEnabled && apiKey
          ? new ClaudeCorrector({ client: clientFor(apiKey), settings: serverSettings })
          : passthrough;
      }),
    anthropicApiKeyStatus: () => {
      const dashboardKey = settings.getAnthropicApiKey();
      const apiKey = dashboardKey ?? config.anthropicApiKey;
      return {
        source: dashboardKey ? "dashboard" : config.anthropicApiKey ? "server-file" : null,
        hint: apiKey ? apiKey.slice(-API_KEY_HINT_CHARACTERS) : null,
      };
    },
    checkAnthropicApiKey: input.checkAnthropicApiKey ?? checkWithAnthropic,
    secureCookies: config.secureCookies,
    httpsUrl: config.httpsUrl,
  };
}
