/** ログインのセッションとアクセスキー。どちらも token の SHA-256 だけを保存する。 */
import type { DatabaseSync } from "node:sqlite";
import type { AccessKey } from "@kikitori/protocol";

interface AccessKeyRow {
  id: number;
  user_id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

function toAccessKey(row: AccessKeyRow): AccessKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export class LoginSessionRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(input: { tokenHash: string; userId: number; expiresAt: Date }): void {
    this.database
      .prepare("INSERT INTO login_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(input.tokenHash, input.userId, new Date().toISOString(), input.expiresAt.toISOString());
  }

  findUserId(tokenHash: string, now: Date): number | null {
    const row = this.database
      .prepare("SELECT user_id FROM login_sessions WHERE token_hash = ? AND expires_at > ?")
      .get(tokenHash, now.toISOString()) as { user_id: number } | undefined;
    return row?.user_id ?? null;
  }

  delete(tokenHash: string): void {
    this.database.prepare("DELETE FROM login_sessions WHERE token_hash = ?").run(tokenHash);
  }

  deleteForUser(userId: number): void {
    this.database.prepare("DELETE FROM login_sessions WHERE user_id = ?").run(userId);
  }
}

export class AccessKeyRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  listForUser(userId: number): AccessKey[] {
    const rows = this.database
      .prepare("SELECT * FROM access_keys WHERE user_id = ? ORDER BY id DESC")
      .all(userId) as unknown as AccessKeyRow[];
    return rows.map(toAccessKey);
  }

  create(input: { userId: number; name: string; keyHash: string; prefix: string }): AccessKey {
    const result = this.database
      .prepare("INSERT INTO access_keys (user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(input.userId, input.name, input.keyHash, input.prefix, new Date().toISOString());
    const row = this.database
      .prepare("SELECT * FROM access_keys WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as unknown as AccessKeyRow;
    return toAccessKey(row);
  }

  /** 鍵が見つかれば、使った時刻を記録して持ち主を返す。 */
  useKey(keyHash: string, now: Date): { accessKeyId: number; userId: number } | null {
    const row = this.database
      .prepare("SELECT id, user_id FROM access_keys WHERE key_hash = ?")
      .get(keyHash) as { id: number; user_id: number } | undefined;
    if (!row) {
      return null;
    }
    this.database.prepare("UPDATE access_keys SET last_used_at = ? WHERE id = ?").run(now.toISOString(), row.id);
    return { accessKeyId: row.id, userId: row.user_id };
  }

  delete(input: { id: number; userId: number }): boolean {
    const result = this.database
      .prepare("DELETE FROM access_keys WHERE id = ? AND user_id = ?")
      .run(input.id, input.userId);
    return result.changes > 0;
  }
}
