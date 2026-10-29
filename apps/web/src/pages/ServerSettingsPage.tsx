import { useEffect, useState } from "react";
import {
  ANTHROPIC_API_KEY_ERROR_CODES,
  correctionModelSchema,
  type AnthropicApiKeyStatus,
  type ServerSettings,
} from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useQuery } from "../hooks/useQuery.ts";
import type { TextCatalog } from "../i18n/catalog.ts";
import { useText } from "../i18n/useText.ts";
import { ApiError, isApiError } from "../lib/http.ts";
import { Button } from "../ui/Button.tsx";
import { ErrorNotice, LoadingMessage, SuccessNotice } from "../ui/Feedback.tsx";
import { CheckboxField, SelectField, TextField } from "../ui/Field.tsx";
import { StatusBadge } from "../ui/StatusBadge.tsx";

const MODEL_NAMES: Record<ServerSettings["correctionModel"], string> = {
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-opus-5-5": "Claude Opus 5.5",
};

/** 全員に共通の清書の設定と、清書に使う Claude の API キー（管理者だけ）。 */
export function ServerSettingsPage() {
  const { text } = useText();
  const loaded = useQuery({ key: "server-settings", load: kikitoriApi.serverSettings });
  const apiKeyStatus = useQuery({ key: "anthropic-api-key", load: kikitoriApi.anthropicApiKey });
  return (
    <section>
      <PageHeader title={text.serverSettings} description={text.serverSettingsDescription} />
      {loaded.loading && !loaded.value && <LoadingMessage label={text.loading} />}
      {loaded.error !== null && <ErrorNotice message={failureMessage(loaded.error, text.networkError)} onRetry={loaded.reload} retryLabel={text.retry} />}
      {loaded.value && <ServerSettingsForm initial={loaded.value} />}
      <h2 className="mb-2 mt-10 text-[16px] font-semibold">{text.anthropicApiKey}</h2>
      <p className="mb-4 text-fg-secondary">{text.anthropicApiKeyDescription}</p>
      {apiKeyStatus.loading && !apiKeyStatus.value && <LoadingMessage label={text.loading} />}
      {apiKeyStatus.error !== null && (
        <ErrorNotice message={failureMessage(apiKeyStatus.error, text.networkError)} onRetry={apiKeyStatus.reload} retryLabel={text.retry} />
      )}
      {apiKeyStatus.value && <AnthropicApiKeyForm initial={apiKeyStatus.value} />}
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
      <CheckboxField
        label={text.correctionEnabled}
        checked={settings.correctionEnabled}
        onChange={(event) => setSettings({ ...settings, correctionEnabled: event.target.checked })}
      />
      <SelectField
        label={text.correctionModel}
        value={settings.correctionModel}
        onChange={(event) => setSettings({ ...settings, correctionModel: correctionModelSchema.parse(event.target.value) })}
      >
        {correctionModelSchema.options.map((model) => (
          <option key={model} value={model}>
            {MODEL_NAMES[model]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={text.correctionEffort}
        value={settings.correctionEffort}
        onChange={(event) => setSettings({ ...settings, correctionEffort: event.target.value as ServerSettings["correctionEffort"] })}
      >
        {efforts.map((effort) => (
          <option key={effort.value} value={effort.value}>
            {effort.label}
          </option>
        ))}
      </SelectField>
      <ErrorNotice message={action.error} />
      {saved && <SuccessNotice>{text.saved}</SuccessNotice>}
      <Button variant="primary" disabled={action.pending}>
        {text.save}
      </Button>
    </form>
  );
}

/** キーを保存できなかった理由を、画面の言語の文にする（API の文は英語のため）。 */
function localizeApiKeyFailure(failure: unknown, text: TextCatalog): unknown {
  if (!isApiError(failure)) return failure;
  const messages: Record<string, string> = {
    [ANTHROPIC_API_KEY_ERROR_CODES.rejected]: text.anthropicApiKeyRejected,
    [ANTHROPIC_API_KEY_ERROR_CODES.unreachable]: text.anthropicUnreachable,
  };
  const message = failure.code ? messages[failure.code] : undefined;
  return message ? new ApiError({ status: failure.status, code: failure.code, message }) : failure;
}

function AnthropicApiKeyForm({ initial }: { initial: AnthropicApiKeyStatus }) {
  const { text } = useText();
  const [status, setStatus] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const sourceLabels: Record<NonNullable<AnthropicApiKeyStatus["source"]>, string> = {
    dashboard: text.anthropicApiKeyFromDashboard,
    "server-file": text.anthropicApiKeyFromServerFile,
  };
  const removeDashboardKey = () => {
    if (!window.confirm(text.deleteAnthropicApiKeyConfirm)) return;
    setSaved(false);
    void action.run(async () => setStatus(await kikitoriApi.deleteAnthropicApiKey()));
  };
  return (
    <form
      className="max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        void action.run(async () => {
          try {
            setStatus(await kikitoriApi.saveAnthropicApiKey(apiKey));
          } catch (failure) {
            throw localizeApiKeyFailure(failure, text);
          }
          setApiKey("");
          setSaved(true);
        });
      }}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge ok={status.source !== null} label={status.source ? sourceLabels[status.source] : text.anthropicApiKeyMissing} />
        {status.hint && (
          <span className="text-[12.5px] text-fg-muted">
            {text.anthropicApiKeyEnding} <span className="font-mono text-accent-fg">{status.hint}</span>
          </span>
        )}
      </div>
      <TextField
        label={text.newAnthropicApiKey}
        note={text.anthropicApiKeyNote}
        required
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-ant-…"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
      />
      <ErrorNotice message={action.error} />
      {saved && <SuccessNotice>{text.saved}</SuccessNotice>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={action.pending}>
          {text.saveAnthropicApiKey}
        </Button>
        {status.source === "dashboard" && (
          <Button type="button" variant="danger" disabled={action.pending} onClick={removeDashboardKey}>
            {text.deleteAnthropicApiKey}
          </Button>
        )}
      </div>
    </form>
  );
}
