import { useEffect, useState } from "react";
import type { UserSettings } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useQuery } from "../hooks/useQuery.ts";
import { useText } from "../i18n/useText.ts";
import { Button } from "../ui/Button.tsx";
import { ErrorNotice, LoadingMessage, SuccessNotice } from "../ui/Feedback.tsx";
import { CheckboxField, TextAreaField, TextField } from "../ui/Field.tsx";

/** 利用者ごとの清書の設定と、パスワードの変更。 */
export function SettingsPage() {
  const { text } = useText();
  const loaded = useQuery({ key: "user-settings", load: kikitoriApi.userSettings });
  return (
    <section>
      <PageHeader title={text.settings} description={text.settingsDescription} />
      {loaded.loading && !loaded.value && <LoadingMessage label={text.loading} />}
      {loaded.error !== null && <ErrorNotice message={failureMessage(loaded.error, text.networkError)} onRetry={loaded.reload} retryLabel={text.retry} />}
      {loaded.value && <CorrectionSettingsForm initial={loaded.value} />}
      <h2 className="mb-4 mt-10 text-[16px] font-semibold">{text.changePassword}</h2>
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
      <TextAreaField
        label={text.terms}
        note={text.termsNote}
        rows={8}
        value={settings.terms}
        onChange={(event) => setSettings({ ...settings, terms: event.target.value })}
      />
      <TextAreaField
        label={text.instructions}
        note={text.instructionsNote}
        rows={3}
        value={settings.instructions}
        onChange={(event) => setSettings({ ...settings, instructions: event.target.value })}
      />
      <CheckboxField
        label={text.saveHistory}
        checked={settings.saveHistory}
        onChange={(event) => setSettings({ ...settings, saveHistory: event.target.checked })}
      />
      <ErrorNotice message={action.error} />
      {saved && <SuccessNotice>{text.saved}</SuccessNotice>}
      <Button variant="primary" disabled={action.pending}>
        {text.save}
      </Button>
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
      <TextField
        label={text.currentPassword}
        required
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <TextField
        label={text.newPassword}
        required
        minLength={8}
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <ErrorNotice message={action.error} />
      {changed && <SuccessNotice>{text.passwordChanged}</SuccessNotice>}
      <Button disabled={action.pending}>{text.changePassword}</Button>
    </form>
  );
}
