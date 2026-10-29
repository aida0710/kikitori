/** HTTP の入口。/api（管理画面）、/v1/dictation（端末）、それ以外は管理画面のファイル。 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { ServerServices } from "../services.ts";
import { createApiRoutes } from "./apiRoutes.ts";
import { createDictationRoute } from "./dictationRoute.ts";
import type { AppEnv } from "./requestContext.ts";

export function createApp(input: {
  services: ServerServices;
  webDirectory: string | null;
}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.route("/api", createApiRoutes(input.services));
  app.route("/v1/dictation", createDictationRoute(input.services));

  const { webDirectory } = input;
  if (webDirectory) {
    app.use("/*", serveStatic({ root: webDirectory }));
    // 画面の中の移動（/keys など）は、どれも index.html を返して画面側で振り分ける
    const indexHtml = readFileSync(join(webDirectory, "index.html"), "utf8");
    app.get("*", (c) => c.html(indexHtml));
  }
  return app;
}
