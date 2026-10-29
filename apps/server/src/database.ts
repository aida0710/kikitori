/** SQLite（node:sqlite）の接続と表の作成。 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_keys (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  terms TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  save_history INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS server_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  correction_enabled INTEGER NOT NULL,
  correction_model TEXT NOT NULL,
  correction_effort TEXT NOT NULL
);

-- 管理画面で入れた鍵（清書に使う Claude の API キーなど）
CREATE TABLE IF NOT EXISTS server_secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dictations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  access_key_id INTEGER REFERENCES access_keys (id) ON DELETE SET NULL,
  client TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  audio_ms INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 0,
  raw_text TEXT,
  corrected_text TEXT,
  correction_model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  correction_ms REAL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS dictations_by_user ON dictations (user_id, started_at DESC);
`;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  database.exec(SCHEMA);
  return database;
}
