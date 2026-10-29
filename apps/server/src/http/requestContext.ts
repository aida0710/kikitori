/** Hono の型と、ログイン・管理者を求める middleware と、エラーの応答の形。 */
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { ApiErrorBody } from "@kikitori/protocol";
import type { z } from "zod";
import { LOGIN_COOKIE_NAME, type Principal } from "../auth/authentication.ts";
import type { ServerServices } from "../services.ts";

export interface AppEnv {
  Variables: { principal: Principal };
}

export function errorResponse(c: Context, status: 400 | 401 | 403 | 404 | 409 | 503, code: string, message: string) {
  const body: ApiErrorBody = { error: message, code };
  return c.json(body, status);
}

export function requirePrincipal(services: ServerServices): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const principal = services.authenticator.resolve({
      authorization: c.req.header("authorization"),
      loginToken: getCookie(c, LOGIN_COOKIE_NAME),
    });
    if (!principal) {
      return errorResponse(c, 401, "unauthorized", "Sign in or send a valid access key");
    }
    c.set("principal", principal);
    await next();
  };
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("principal").user.role !== "admin") {
    return errorResponse(c, 403, "forbidden", "Administrator role is required");
  }
  await next();
};

export async function parseJsonBody<Schema extends z.ZodType>(
  c: Context,
  schema: Schema,
): Promise<{ ok: true; value: z.infer<Schema> } | { ok: false; response: Response }> {
  const body = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
    return { ok: false, response: errorResponse(c, 400, "invalid_request", message) };
  }
  return { ok: true, value: parsed.data };
}
