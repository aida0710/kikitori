import { Trash2 } from "lucide-react";
import type { Dictation } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useQuery } from "../hooks/useQuery.ts";
import { useText } from "../i18n/useText.ts";
import { formatAudioLength, formatDateTime } from "../lib/displayFormat.ts";
import { Button } from "../ui/Button.tsx";
import { Cell, DataTable } from "../ui/DataTable.tsx";
import { EmptyMessage, ErrorNotice, LoadingMessage } from "../ui/Feedback.tsx";

/** 最近の音声入力。清書の前の文は、清書の後と違うときだけ折りたたんで見せる。 */
export function HistoryPage() {
  const { text, intlLocale } = useText();
  const dictations = useQuery({ key: "dictations", load: kikitoriApi.dictations });
  const deletion = useAction();

  const remove = (dictation: Dictation) =>
    void deletion.run(async () => {
      await kikitoriApi.deleteDictation(dictation.id);
      dictations.reload();
    });

  return (
    <section>
      <PageHeader title={text.history} description={text.historyDescription} />
      <ErrorNotice message={deletion.error} />
      {dictations.loading && !dictations.value && <LoadingMessage label={text.loading} />}
      {dictations.error !== null && (
        <ErrorNotice message={failureMessage(dictations.error, text.networkError)} onRetry={dictations.reload} retryLabel={text.retry} />
      )}
      {dictations.value?.length === 0 && <EmptyMessage>{text.noHistory}</EmptyMessage>}
      {dictations.value && dictations.value.length > 0 && (
        <DataTable
          headers={[
            text.historyStarted,
            text.historyClient,
            text.historyLength,
            text.historyText,
            text.historyModel,
            text.historyTokens,
            <span className="sr-only">{text.delete}</span>,
          ]}
        >
          {dictations.value.map((dictation) => (
            <tr key={dictation.id} className="align-top">
              <Cell className="whitespace-nowrap">{formatDateTime(dictation.startedAt, intlLocale)}</Cell>
              <Cell className="text-fg-secondary">{dictation.client ?? "—"}</Cell>
              <Cell className="font-mono text-[12.5px] tabular-nums">{formatAudioLength(dictation.audioMs)}</Cell>
              <Cell className="min-w-[240px]">
                <DictationText dictation={dictation} />
              </Cell>
              <Cell className="whitespace-nowrap font-mono text-[12.5px] text-accent-fg">{dictation.correctionModel ?? "—"}</Cell>
              <Cell className="whitespace-nowrap font-mono text-[12.5px] tabular-nums text-fg-secondary">
                {dictation.inputTokens + dictation.outputTokens > 0 ? `${dictation.inputTokens} / ${dictation.outputTokens}` : "—"}
              </Cell>
              <Cell className="text-right">
                <Button variant="danger" icon={<Trash2 />} disabled={deletion.pending} onClick={() => remove(dictation)}>
                  {text.delete}
                </Button>
              </Cell>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

function DictationText({ dictation }: { dictation: Dictation }) {
  const { text } = useText();
  if (dictation.correctedText === null) {
    return <span className="text-fg-faint">{text.historyNotSaved}</span>;
  }
  return (
    <>
      <div className="leading-relaxed">{dictation.correctedText}</div>
      {dictation.error && <div className="mt-1 text-danger">{dictation.error}</div>}
      {dictation.rawText && dictation.rawText !== dictation.correctedText && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-fg-faint">{text.historyRaw}</summary>
          <div className="mt-1 text-fg-muted">{dictation.rawText}</div>
        </details>
      )}
    </>
  );
}
