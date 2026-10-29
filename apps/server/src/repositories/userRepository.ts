import type { DatabaseSync } from "node:sqlite";
import type { User, UserRole } from "@kikitori/protocol";

export interface UserRecord extends User {
  passwordHash: string;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  disabled: number;
  created_at: string;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    disabled: row.disabled === 1,
    createdAt: row.created_at,
  };
}

export function toUser(record: UserRecord): User {
  const { passwordHash: _passwordHash, ...user } = record;
  return user;
}

export class UserRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  count(): number {
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    return row.count;
  }

  list(): UserRecord[] {
    const rows = this.database.prepare("SELECT * FROM users ORDER BY id").all() as unknown as UserRow[];
    return rows.map(toUserRecord);
  }

  findById(id: number): UserRecord | null {
    const row = this.database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? toUserRecord(row) : null;
  }

  findByUsername(username: string): UserRecord | null {
    const row = this.database.prepare("SELECT * FROM users WHERE username = ?").get(username) as
      | UserRow
      | undefined;
    return row ? toUserRecord(row) : null;
  }

  create(input: { username: string; passwordHash: string; role: UserRole }): UserRecord {
    const result = this.database
      .prepare("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)")
      .run(input.username, input.passwordHash, input.role, new Date().toISOString());
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, changes: { role?: UserRole; disabled?: boolean; passwordHash?: string }): void {
    if (changes.role !== undefined) {
      this.database.prepare("UPDATE users SET role = ? WHERE id = ?").run(changes.role, id);
    }
    if (changes.disabled !== undefined) {
      this.database.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(changes.disabled ? 1 : 0, id);
    }
    if (changes.passwordHash !== undefined) {
      this.database.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(changes.passwordHash, id);
    }
  }

  delete(id: number): void {
    this.database.prepare("DELETE FROM users WHERE id = ?").run(id);
  }

  countActiveAdmins(): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND disabled = 0")
      .get() as { count: number };
    return row.count;
  }
}
