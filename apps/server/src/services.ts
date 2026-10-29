/** サーバーが使う部品をまとめて作る。試験では asrWorker と correctorFor を差し替える。 */
import Anthropic from "@anthropic-ai/sdk";
import type { DatabaseSync } from "node:sqlite";
import type { ServerSettings } from "@kikitori/protocol";
import { Authenticator } from "./auth/authentication.ts";
import type { ServerConfig } from "./config.ts";
import { type AsrWorker, WebSocketAsrWorker } from "./dictation/asrWorkerClient.ts";
import { ClaudeCorrector } from "./dictation/claudeCorrector.ts";
import { PassthroughCorrector, type TextCorrector } from "./dictation/textCorrector.ts";
import { AccessKeyRepository, LoginSessionRepository } from "./repositories/credentialRepository.ts";
import { DictationRepository } from "./repositories/dictationRepository.ts";
import { SettingsRepository } from "./repositories/settingsRepository.ts";
import { UserRepository } from "./repositories/userRepository.ts";

export interface ServerServices {
  users: UserRepository;
  loginSessions: LoginSessionRepository;
  accessKeys: AccessKeyRepository;
  settings: SettingsRepository;
  dictations: DictationRepository;
  authenticator: Authenticator;
  asrWorker: AsrWorker;
  correctionConfigured: boolean;
  correctorFor(settings: ServerSettings): TextCorrector;
  secureCookies: boolean;
}

export function createServices(input: {
  database: DatabaseSync;
  config: ServerConfig;
  asrWorker?: AsrWorker;
  correctorFor?: (settings: ServerSettings) => TextCorrector;
}): ServerServices {
  const { database, config } = input;
  const users = new UserRepository(database);
  const loginSessions = new LoginSessionRepository(database);
  const accessKeys = new AccessKeyRepository(database);
  const anthropic = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;
  const passthrough = new PassthroughCorrector();
  return {
    users,
    loginSessions,
    accessKeys,
    settings: new SettingsRepository(database),
    dictations: new DictationRepository(database),
    authenticator: new Authenticator({ users, loginSessions, accessKeys }),
    asrWorker:
      input.asrWorker ?? new WebSocketAsrWorker({ url: config.asrWorkerUrl, token: config.asrWorkerToken }),
    correctionConfigured: anthropic !== null || input.correctorFor !== undefined,
    correctorFor:
      input.correctorFor ??
      ((settings) =>
        settings.correctionEnabled && anthropic ? new ClaudeCorrector({ client: anthropic, settings }) : passthrough),
    secureCookies: config.secureCookies,
  };
}
