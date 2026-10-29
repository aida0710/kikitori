import { useEffect, useState } from "react";
import { ErrorNotice, LoadingMessage, useQuery } from "@mado/design-system/react";
import { correctionModelSchema, type ServerSettings } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useText } from "../i18n/useText.ts";

const MODEL_NAMES: Record<ServerSettings["correctionModel"], string> = {
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-opus-5-5": "Claude Opus 5.5",
};

/** 全員に共通の清書の設定（管理者だけ）。 */
export function ServerSettingsPage() {
  const { text } = useText();
  const loaded = useQuery({ key: "server-settings", load: kikitoriApi.serverSettings });
  return (
    <section className="page">
      <PageHeader title={text.serverSettings} description={text.serverSettingsDescription} />
      {loaded.loading && !loaded.value && <LoadingMessage label={text.loading} />}
      {loaded.error !== undefined && loaded.error !== null && (
        <ErrorNotice message={failureMessage(loaded.error, text.networkError)} retry={loaded.reload} />
      )}
      {loaded.value && <ServerSettingsForm initial={loaded.value} />}
    </section>
  );
}

function ServerSettingsForm({ initial }: { initial: ServerSettings }) {
  const { text } = useText();
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  useEffect(() => setSaved(false), [settings]);
  const efforts: { value: ServerSettings["correctionEffort"]; label: string }[] = [
    { value: "low", label: text.effortLow },
    { value: "medium", label: text.effortMedium },
    { value: "high", label: text.effortHigh },
  ];
  return (
    <form
      className="max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          setSettings(await kikitoriApi.saveServerSettings(settings));
          setSaved(true);
        });
      }}
    >
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={settings.correctionEnabled}
          onChange={(event) => setSettings({ ...settings, correctionEnabled: event.target.checked })}
        />
        <span>{text.correctionEnabled}</span>
      </label>
      <label className="field">
        <span>{text.correctionModel}</span>
        <select
          value={settings.correctionModel}
          onChange={(event) =>
            setSettings({ ...settings, correctionModel: correctionModelSchema.parse(event.target.value) })
          }
        >
          {correctionModelSchema.options.map((model) => (
            <option key={model} value={model}>
              {MODEL_NAMES[model]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{text.correctionEffort}</span>
        <select
          value={settings.correctionEffort}
          onChange={(event) =>
            setSettings({ ...settings, correctionEffort: event.target.value as ServerSettings["correctionEffort"] })
          }
        >
          {efforts.map((effort) => (
            <option key={effort.value} value={effort.value}>
              {effort.label}
            </option>
          ))}
        </select>
      </label>
      <ErrorNotice message={action.error} />
      {saved && <p className="notice success">{text.saved}</p>}
      <button className="button primary" disabled={action.pending}>
        {text.save}
      </button>
    </form>
  );
}
