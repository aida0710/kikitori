/** API サーバーを起動する。 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { hashPassword } from "./auth/secrets.ts";
import { readServerConfig } from "./config.ts";
import { openDatabase } from "./database.ts";
import { createApp } from "./http/app.ts";
import { createServices, type ServerServices } from "./services.ts";

const INITIAL_PASSWORD_FILE_NAME = "initial-admin-password";

/** 利用者がいなければ管理者を作る。パスワードの指定が無ければ作って、データの場所のファイルに書く。 */
async function ensureInitialAdmin(services: ServerServices, config: ReturnType<typeof readServerConfig>) {
  if (services.users.count() > 0) {
    return;
  }
  let password = config.initialAdminPassword;
  if (!password) {
    password = randomBytes(18).toString("base64url");
    const passwordFile = join(dirname(config.databasePath), INITIAL_PASSWORD_FILE_NAME);
    writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
    console.log(`Created the initial administrator "${config.initialAdminUsername}". Password: ${passwordFile}`);
  }
  services.users.create({
    username: config.initialAdminUsername,
    role: "admin",
    passwordHash: await hashPassword(password),
  });
}

const config = readServerConfig();
const database = openDatabase(config.databasePath);
const services = createServices({ database, config });
await ensureInitialAdmin(services, config);

const app = createApp({ services, webDirectory: config.webDirectory });
// 音声のフレームは 100ms で 3.2KB。大きすぎるフレームは受け取らない
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
serve(
  { fetch: app.fetch, hostname: config.host, port: config.port, websocket: { server: websocketServer } },
  (info) => console.log(`kikitori server listening on http://${info.address}:${info.port}`),
);
