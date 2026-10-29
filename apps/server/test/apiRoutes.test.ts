import { beforeEach, describe, expect, it } from "vitest";
import type { CreatedAccessKey, User } from "@kikitori/protocol";
import { hashPassword } from "../src/auth/secrets.ts";
import { readServerConfig } from "../src/config.ts";
import { openDatabase } from "../src/database.ts";
import { createApp } from "../src/http/app.ts";
import { PassthroughCorrector } from "../src/dictation/textCorrector.ts";
import { createServices, type ServerServices } from "../src/services.ts";

let services: ServerServices;
let app: ReturnType<typeof createApp>;

async function login(username: string, password: string): Promise<string> {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

function jsonRequest(method: string, body: unknown, cookie: string): RequestInit {
  return { method, headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) };
}

beforeEach(async () => {
  const database = openDatabase(":memory:");
  services = createServices({
    database,
    config: { ...readServerConfig({}), anthropicApiKey: null },
    correctorFor: () => new PassthroughCorrector(),
    checkAnthropicApiKey: async (apiKey) => (apiKey === "sk-ant-valid-key" ? "valid" : "rejected"),
  });
  services.users.create({ username: "admin", role: "admin", passwordHash: await hashPassword("admin-password") });
  app = createApp({ services, webDirectory: null });
});

describe("REST API", () => {
  it("ログインしていないと 401 になる", async () => {
    const response = await app.request("/api/me");
    expect(response.status).toBe(401);
  });

  it("パスワードが違うとログインできない", async () => {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong-password" }),
    });
    expect(response.status).toBe(401);
  });

  it("作ったアクセスキーで API を使え、消すと使えなくなる", async () => {
    const cookie = await login("admin", "admin-password");
    const created = await app.request("/api/access-keys", jsonRequest("POST", { name: "Windows" }, cookie));
    expect(created.status).toBe(201);
    const accessKey = (await created.json()) as CreatedAccessKey;
    expect(accessKey.key.startsWith("kkt_")).toBe(true);
    expect(accessKey.key.startsWith(accessKey.prefix)).toBe(true);

    const withKey = await app.request("/api/me", { headers: { authorization: `Bearer ${accessKey.key}` } });
    expect(((await withKey.json()) as User).username).toBe("admin");

    const listed = await app.request("/api/access-keys", { headers: { cookie } });
    expect(JSON.stringify(await listed.json())).not.toContain(accessKey.key);

    await app.request(`/api/access-keys/${accessKey.id}`, { method: "DELETE", headers: { cookie } });
    const revoked = await app.request("/api/me", { headers: { authorization: `Bearer ${accessKey.key}` } });
    expect(revoked.status).toBe(401);
  });

  it("一般の利用者は利用者の一覧とサーバーの設定を触れない", async () => {
    const adminCookie = await login("admin", "admin-password");
    await app.request(
      "/api/users",
      jsonRequest("POST", { username: "member", password: "member-password", role: "member" }, adminCookie),
    );
    const memberCookie = await login("member", "member-password");

    expect((await app.request("/api/users", { headers: { cookie: memberCookie } })).status).toBe(403);
    expect((await app.request("/api/settings/server", { headers: { cookie: memberCookie } })).status).toBe(403);
    expect((await app.request("/api/settings/me", { headers: { cookie: memberCookie } })).status).toBe(200);
  });

  it("最後の管理者は一般の利用者にも無効にもできない", async () => {
    const cookie = await login("admin", "admin-password");
    const admin = services.users.findByUsername("admin")!;
    const demoted = await app.request(`/api/users/${admin.id}`, jsonRequest("PATCH", { role: "member" }, cookie));
    expect(demoted.status).toBe(409);
    const disabled = await app.request(`/api/users/${admin.id}`, jsonRequest("PATCH", { disabled: true }, cookie));
    expect(disabled.status).toBe(409);
  });

  it("無効にした利用者は、ログインの cookie もアクセスキーも使えなくなる", async () => {
    const adminCookie = await login("admin", "admin-password");
    await app.request(
      "/api/users",
      jsonRequest("POST", { username: "member", password: "member-password", role: "member" }, adminCookie),
    );
    const memberCookie = await login("member", "member-password");
    const created = await app.request("/api/access-keys", jsonRequest("POST", { name: "phone" }, memberCookie));
    const { key } = (await created.json()) as CreatedAccessKey;
    const member = services.users.findByUsername("member")!;

    await app.request(`/api/users/${member.id}`, jsonRequest("PATCH", { disabled: true }, adminCookie));

    expect((await app.request("/api/me", { headers: { cookie: memberCookie } })).status).toBe(401);
    expect((await app.request("/api/me", { headers: { authorization: `Bearer ${key}` } })).status).toBe(401);
  });

  it("利用者の設定を保存して読み戻せる", async () => {
    const cookie = await login("admin", "admin-password");
    const settings = { terms: "kikitori\nQwen3-ASR", instructions: "敬体で", saveHistory: false };
    const saved = await app.request("/api/settings/me", jsonRequest("PUT", settings, cookie));
    expect(saved.status).toBe(200);
    const loaded = await app.request("/api/settings/me", { headers: { cookie } });
    expect(await loaded.json()).toEqual(settings);
  });

  it("ClaudeのAPIキーは、Anthropicが受け付けたものだけ保存し、末尾4文字だけを返す", async () => {
    const cookie = await login("admin", "admin-password");
    const rejected = await app.request("/api/settings/server/anthropic-api-key", jsonRequest("PUT", { apiKey: "sk-ant-wrong" }, cookie));
    expect(rejected.status).toBe(400);
    expect(services.settings.getAnthropicApiKey()).toBeNull();

    const saved = await app.request("/api/settings/server/anthropic-api-key", jsonRequest("PUT", { apiKey: "sk-ant-valid-key" }, cookie));
    expect(await saved.json()).toEqual({ source: "dashboard", hint: "-key" });
    const status = await app.request("/api/status", { headers: { cookie } });
    expect(((await status.json()) as { correction: { configured: boolean } }).correction.configured).toBe(true);

    const removed = await app.request("/api/settings/server/anthropic-api-key", { method: "DELETE", headers: { cookie } });
    expect(await removed.json()).toEqual({ source: null, hint: null });
  });

  it("一般の利用者はClaudeのAPIキーを見ることも変えることもできない", async () => {
    const adminCookie = await login("admin", "admin-password");
    await app.request(
      "/api/users",
      jsonRequest("POST", { username: "member", password: "member-password", role: "member" }, adminCookie),
    );
    const memberCookie = await login("member", "member-password");
    expect((await app.request("/api/settings/server/anthropic-api-key", { headers: { cookie: memberCookie } })).status).toBe(403);
    const changed = await app.request(
      "/api/settings/server/anthropic-api-key",
      jsonRequest("PUT", { apiKey: "sk-ant-valid-key" }, memberCookie),
    );
    expect(changed.status).toBe(403);
  });
});
