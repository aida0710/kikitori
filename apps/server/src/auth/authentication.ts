/**
 * だれの要求かを決める。管理画面はログインの cookie、端末はアクセスキー（Authorization: Bearer）を使う。
 */
import type { AccessKeyRepository, LoginSessionRepository } from "../repositories/credentialRepository.ts";
import type { UserRecord, UserRepository } from "../repositories/userRepository.ts";
import { ACCESS_KEY_PREFIX, generateLoginToken, hashToken, verifyPassword } from "./secrets.ts";

export const LOGIN_COOKIE_NAME = "kikitori_session";
export const LOGIN_SESSION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface Principal {
  user: UserRecord;
  // アクセスキーで来た要求のときだけ入る
  accessKeyId: number | null;
}

export class Authenticator {
  private readonly users: UserRepository;
  private readonly loginSessions: LoginSessionRepository;
  private readonly accessKeys: AccessKeyRepository;

  constructor(input: {
    users: UserRepository;
    loginSessions: LoginSessionRepository;
    accessKeys: AccessKeyRepository;
  }) {
    this.users = input.users;
    this.loginSessions = input.loginSessions;
    this.accessKeys = input.accessKeys;
  }

  async login(username: string, password: string): Promise<{ token: string; user: UserRecord } | null> {
    const user = this.users.findByUsername(username);
    if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
      return null;
    }
    const token = generateLoginToken();
    this.loginSessions.create({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + LOGIN_SESSION_DAYS * MS_PER_DAY),
    });
    return { token, user };
  }

  logout(loginToken: string): void {
    this.loginSessions.delete(hashToken(loginToken));
  }

  resolve(input: { authorization: string | undefined; loginToken: string | undefined }): Principal | null {
    const now = new Date();
    const bearer = input.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (bearer?.startsWith(ACCESS_KEY_PREFIX)) {
      const owner = this.accessKeys.useKey(hashToken(bearer), now);
      return owner ? this.activePrincipal(owner.userId, owner.accessKeyId) : null;
    }
    if (input.loginToken) {
      const userId = this.loginSessions.findUserId(hashToken(input.loginToken), now);
      return userId === null ? null : this.activePrincipal(userId, null);
    }
    return null;
  }

  private activePrincipal(userId: number, accessKeyId: number | null): Principal | null {
    const user = this.users.findById(userId);
    if (!user || user.disabled) {
      return null;
    }
    return { user, accessKeyId };
  }
}
