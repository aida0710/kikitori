/** 管理画面の REST（/api）。入力を確かめて、リポジトリを呼び、応答の形にするだけにする。 */
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  changePasswordRequestSchema,
  createAccessKeyRequestSchema,
  createUserRequestSchema,
  loginRequestSchema,
  serverSettingsSchema,
  type ServerStatus,
  updateUserRequestSchema,
  userSettingsSchema,
} from "@kikitori/protocol";
import { LOGIN_COOKIE_NAME, LOGIN_SESSION_DAYS } from "../auth/authentication.ts";
import { generateAccessKey, hashPassword, hashToken, verifyPassword } from "../auth/secrets.ts";
import { toUser } from "../repositories/userRepository.ts";
import type { ServerServices } from "../services.ts";
import { type AppEnv, errorResponse, parseJsonBody, requireAdmin, requirePrincipal } from "./requestContext.ts";

const SECONDS_PER_DAY = 24 * 60 * 60;
const HISTORY_PAGE_SIZE = 100;

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function createApiRoutes(services: ServerServices): Hono<AppEnv> {
  const api = new Hono<AppEnv>();

  api.post("/auth/login", async (c) => {
    const body = await parseJsonBody(c, loginRequestSchema);
    if (!body.ok) return body.response;
    const session = await services.authenticator.login(body.value.username, body.value.password);
    if (!session) {
      return errorResponse(c, 401, "invalid_credentials", "The username or password is incorrect");
    }
    setCookie(c, LOGIN_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: services.secureCookies,
      path: "/",
      maxAge: LOGIN_SESSION_DAYS * SECONDS_PER_DAY,
    });
    return c.json(toUser(session.user));
  });

  api.post("/auth/logout", (c) => {
    const token = getCookie(c, LOGIN_COOKIE_NAME);
    if (token) {
      services.authenticator.logout(token);
    }
    deleteCookie(c, LOGIN_COOKIE_NAME, { path: "/" });
    return c.body(null, 204);
  });

  api.use("*", requirePrincipal(services));

  api.get("/me", (c) => c.json(toUser(c.get("principal").user)));

  api.put("/me/password", async (c) => {
    const body = await parseJsonBody(c, changePasswordRequestSchema);
    if (!body.ok) return body.response;
    const { user } = c.get("principal");
    if (!(await verifyPassword(body.value.currentPassword, user.passwordHash))) {
      return errorResponse(c, 400, "invalid_credentials", "The current password is incorrect");
    }
    services.users.update(user.id, { passwordHash: await hashPassword(body.value.newPassword) });
    return c.body(null, 204);
  });

  api.get("/status", async (c) => {
    const status: ServerStatus = {
      asr: await services.asrWorker.checkHealth(),
      correction: { configured: services.correctionConfigured },
    };
    return c.json(status);
  });

  api.get("/access-keys", (c) => c.json(services.accessKeys.listForUser(c.get("principal").user.id)));

  api.post("/access-keys", async (c) => {
    const body = await parseJsonBody(c, createAccessKeyRequestSchema);
    if (!body.ok) return body.response;
    const { key, prefix } = generateAccessKey();
    const created = services.accessKeys.create({
      userId: c.get("principal").user.id,
      name: body.value.name,
      keyHash: hashToken(key),
      prefix,
    });
    return c.json({ ...created, key }, 201);
  });

  api.delete("/access-keys/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null || !services.accessKeys.delete({ id, userId: c.get("principal").user.id })) {
      return errorResponse(c, 404, "not_found", "The access key was not found");
    }
    return c.body(null, 204);
  });

  api.get("/settings/me", (c) => c.json(services.settings.getUserSettings(c.get("principal").user.id)));

  api.put("/settings/me", async (c) => {
    const body = await parseJsonBody(c, userSettingsSchema);
    if (!body.ok) return body.response;
    services.settings.saveUserSettings(c.get("principal").user.id, body.value);
    return c.json(body.value);
  });

  api.get("/dictations", (c) =>
    c.json(services.dictations.listForUser(c.get("principal").user.id, HISTORY_PAGE_SIZE)),
  );

  api.delete("/dictations/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null || !services.dictations.delete({ id, userId: c.get("principal").user.id })) {
      return errorResponse(c, 404, "not_found", "The dictation was not found");
    }
    return c.body(null, 204);
  });

  api.get("/settings/server", requireAdmin, (c) => c.json(services.settings.getServerSettings()));

  api.put("/settings/server", requireAdmin, async (c) => {
    const body = await parseJsonBody(c, serverSettingsSchema);
    if (!body.ok) return body.response;
    services.settings.saveServerSettings(body.value);
    return c.json(body.value);
  });

  api.get("/users", requireAdmin, (c) => c.json(services.users.list().map(toUser)));

  api.post("/users", requireAdmin, async (c) => {
    const body = await parseJsonBody(c, createUserRequestSchema);
    if (!body.ok) return body.response;
    if (services.users.findByUsername(body.value.username)) {
      return errorResponse(c, 409, "username_taken", "The username is already in use");
    }
    const user = services.users.create({
      username: body.value.username,
      role: body.value.role,
      passwordHash: await hashPassword(body.value.password),
    });
    return c.json(toUser(user), 201);
  });

  api.patch("/users/:id", requireAdmin, async (c) => {
    const id = parseId(c.req.param("id"));
    const target = id === null ? null : services.users.findById(id);
    if (!target) {
      return errorResponse(c, 404, "not_found", "The user was not found");
    }
    const body = await parseJsonBody(c, updateUserRequestSchema);
    if (!body.ok) return body.response;
    const losesAdmin = target.role === "admin" && (body.value.role === "member" || body.value.disabled === true);
    if (losesAdmin && services.users.countActiveAdmins() <= 1) {
      return errorResponse(c, 409, "last_admin", "At least one active administrator is required");
    }
    services.users.update(target.id, {
      role: body.value.role,
      disabled: body.value.disabled,
      passwordHash: body.value.password ? await hashPassword(body.value.password) : undefined,
    });
    if (body.value.disabled || body.value.password) {
      services.loginSessions.deleteForUser(target.id);
    }
    return c.json(toUser(services.users.findById(target.id)!));
  });

  api.delete("/users/:id", requireAdmin, (c) => {
    const id = parseId(c.req.param("id"));
    const target = id === null ? null : services.users.findById(id);
    if (!target) {
      return errorResponse(c, 404, "not_found", "The user was not found");
    }
    if (target.id === c.get("principal").user.id) {
      return errorResponse(c, 409, "cannot_delete_self", "You cannot delete your own account");
    }
    if (target.role === "admin" && !target.disabled && services.users.countActiveAdmins() <= 1) {
      return errorResponse(c, 409, "last_admin", "At least one active administrator is required");
    }
    services.users.delete(target.id);
    return c.body(null, 204);
  });

  return api;
}
