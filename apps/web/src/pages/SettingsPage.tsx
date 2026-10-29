import { useEffect, useState } from "react";
import { ErrorNotice, LoadingMessage, useQuery } from "@mado/design-system/react";
import type { UserSettings } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useText } from "../i18n/useText.ts";

/** 利用者ごとの清書の設定と、パスワードの変更。 */
export function SettingsPage() {
  const { text } = useText();
  const loaded = useQuery({ key: "user-settings", load: kikitoriApi.userSettings });
  return (
    <section className="page">
      <PageHeader title={text.settings} description={text.settingsDescription} />
      {loaded.loading && !loaded.value && <LoadingMessage label={text.loading} />}
      {loaded.error !== undefined && loaded.error !== null && (
        <ErrorNotice message={failureMessage(loaded.error, text.networkError)} retry={loaded.reload} />
      )}
      {loaded.value && <CorrectionSettingsForm initial={loaded.value} />}
      <h2 className="section-heading mt-10">{text.changePassword}</h2>
      <PasswordForm />
    </section>
  );
}

function CorrectionSettingsForm({ initial }: { initial: UserSettings }) {
  const { text } = useText();
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  useEffect(() => setSaved(false), [settings]);
  return (
    <form
      className="max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          setSettings(await kikitoriApi.saveUserSettings(settings));
          setSaved(true);
        });
      }}
    >
      <label className="field">
        <span>{text.terms}</span>
        <textarea
          rows={8}
          value={settings.terms}
          onChange={(event) => setSettings({ ...settings, terms: event.target.value })}
        />
        <span className="muted">{text.termsNote}</span>
      </label>
      <label className="field">
        <span>{text.instructions}</span>
        <textarea
          rows={3}
          value={settings.instructions}
          onChange={(event) => setSettings({ ...settings, instructions: event.target.value })}
        />
        <span className="muted">{text.instructionsNote}</span>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={settings.saveHistory}
          onChange={(event) => setSettings({ ...settings, saveHistory: event.target.checked })}
        />
        <span>{text.saveHistory}</span>
      </label>
      <ErrorNotice message={action.error} />
      {saved && <p className="notice success">{text.saved}</p>}
      <button className="button primary" disabled={action.pending}>
        {text.save}
      </button>
    </form>
  );
}

function PasswordForm() {
  const { text } = useText();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changed, setChanged] = useState(false);
  const action = useAction();
  return (
    <form
      className="max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        setChanged(false);
        void action.run(async () => {
          await kikitoriApi.changePassword(currentPassword, newPassword);
          setCurrentPassword("");
          setNewPassword("");
          setChanged(true);
        });
      }}
    >
      <label className="field">
        <span>{text.currentPassword}</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>
      <label className="field">
        <span>{text.newPassword}</span>
        <input
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </label>
      <ErrorNotice message={action.error} />
      {changed && <p className="notice success">{text.passwordChanged}</p>}
      <button className="button" disabled={action.pending}>
        {text.changePassword}
      </button>
    </form>
  );
}
