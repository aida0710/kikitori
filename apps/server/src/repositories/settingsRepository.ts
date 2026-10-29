/** サーバー全体の添削の設定（管理者が変える）と、利用者ごとの設定。 */
import type { DatabaseSync } from "node:sqlite";
import type { ServerSettings, UserSettings } from "@kikitori/protocol";

// 速さを優先して Haiku 5.5 を既定にする。管理画面で Sonnet 5.5・Opus 5.5 に変えられる
const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  correctionEnabled: true,
  correctionModel: "claude-haiku-5-5",
  correctionEffort: "low",
};

const DEFAULT_USER_SETTINGS: UserSettings = { terms: "", instructions: "", saveHistory: true };

export class SettingsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  getServerSettings(): ServerSettings {
    const row = this.database.prepare("SELECT * FROM server_settings WHERE id = 1").get() as
      | { correction_enabled: number; correction_model: string; correction_effort: string }
      | undefined;
    if (!row) {
      return DEFAULT_SERVER_SETTINGS;
    }
    return {
      correctionEnabled: row.correction_enabled === 1,
      correctionModel: row.correction_model as ServerSettings["correctionModel"],
      correctionEffort: row.correction_effort as ServerSettings["correctionEffort"],
    };
  }

  saveServerSettings(settings: ServerSettings): void {
    this.database
      .prepare(
        `INSERT INTO server_settings (id, correction_enabled, correction_model, correction_effort)
         VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET correction_enabled = excluded.correction_enabled,
           correction_model = excluded.correction_model, correction_effort = excluded.correction_effort`,
      )
      .run(settings.correctionEnabled ? 1 : 0, settings.correctionModel, settings.correctionEffort);
  }

  getUserSettings(userId: number): UserSettings {
    const row = this.database.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId) as
      | { terms: string; instructions: string; save_history: number }
      | undefined;
    if (!row) {
      return DEFAULT_USER_SETTINGS;
    }
    return { terms: row.terms, instructions: row.instructions, saveHistory: row.save_history === 1 };
  }

  saveUserSettings(userId: number, settings: UserSettings): void {
    this.database
      .prepare(
        `INSERT INTO user_settings (user_id, terms, instructions, save_history) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET terms = excluded.terms,
           instructions = excluded.instructions, save_history = excluded.save_history`,
      )
      .run(userId, settings.terms, settings.instructions, settings.saveHistory ? 1 : 0);
  }
}
