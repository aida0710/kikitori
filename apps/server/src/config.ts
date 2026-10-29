/** API サーバーの設定。環境変数 KIKITORI_*（Claude の鍵だけは SDK と同じ ANTHROPIC_API_KEY）から読む。 */
import { existsSync, readFileSync } from "node:fs";

export interface ServerConfig {
  host: string;
  port: number;
  databasePath: string;
  asrWorkerUrl: string;
  asrWorkerToken: string | null;
  anthropicApiKey: string | null;
  // 利用者がまだ 1 人もいないときに作る管理者
  initialAdminUsername: string;
  initialAdminPassword: string | null;
  // 管理画面（apps/web の build 結果）の置き場所。無ければ API だけを出す
  webDirectory: string | null;
  // HTTPS の後ろで動かすときは true にして、ログインの cookie に Secure を付ける
  secureCookies: boolean;
  // HTTP と HTTPS の両方の入口があるときの HTTPS の側（プレイグラウンドの案内に使う）
  httpsUrl: string | null;
}

function readSecret(env: NodeJS.ProcessEnv, name: string): string | null {
  const filePath = env[`${name}_FILE`];
  // ファイルの場所だけ決めておき、鍵を置くまでは無いものとして動く（Claude の鍵が届く前など）
  if (filePath) {
    return existsSync(filePath) ? readFileSync(filePath, "utf8").trim() || null : null;
  }
  return env[name]?.trim() || null;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env.KIKITORI_HOST ?? "0.0.0.0",
    port: Number(env.KIKITORI_PORT ?? 8780),
    databasePath: env.KIKITORI_DATABASE_PATH ?? "data/kikitori.db",
    asrWorkerUrl: env.KIKITORI_ASR_URL ?? "ws://127.0.0.1:8781/v1/stream",
    asrWorkerToken: readSecret(env, "KIKITORI_ASR_TOKEN"),
    anthropicApiKey: readSecret(env, "ANTHROPIC_API_KEY"),
    initialAdminUsername: env.KIKITORI_INITIAL_ADMIN_USERNAME ?? "admin",
    initialAdminPassword: readSecret(env, "KIKITORI_INITIAL_ADMIN_PASSWORD"),
    webDirectory: env.KIKITORI_WEB_DIRECTORY ?? null,
    secureCookies: env.KIKITORI_SECURE_COOKIES === "true",
    httpsUrl: env.KIKITORI_HTTPS_URL?.trim() || null,
  };
}
