import { EmptyMessage, ErrorNotice, LoadingMessage, useQuery } from "@mado/design-system/react";
import type { Dictation } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useText } from "../i18n/useText.ts";
import { formatAudioLength, formatDateTime } from "../lib/displayFormat.ts";

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
    <section className="page">
      <PageHeader title={text.history} description={text.historyDescription} />
      <ErrorNotice message={deletion.error} />
      {dictations.loading && !dictations.value && <LoadingMessage label={text.loading} />}
      {dictations.error !== undefined && dictations.error !== null && (
        <ErrorNotice message={failureMessage(dictations.error, text.networkError)} retry={dictations.reload} />
      )}
      {dictations.value && dictations.value.length === 0 && <EmptyMessage>{text.noHistory}</EmptyMessage>}
      {dictations.value && dictations.value.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{text.historyStarted}</th>
                <th scope="col">{text.historyClient}</th>
                <th scope="col" className="numeric">{text.historyLength}</th>
                <th scope="col">{text.historyText}</th>
                <th scope="col">{text.historyModel}</th>
                <th scope="col" className="numeric">{text.historyTokens}</th>
                <th scope="col">
                  <span className="sr-only">{text.delete}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {dictations.value.map((dictation) => (
                <tr key={dictation.id}>
                  <td className="nowrap">{formatDateTime(dictation.startedAt, intlLocale)}</td>
                  <td>{dictation.client ?? "—"}</td>
                  <td className="numeric">{formatAudioLength(dictation.audioMs)}</td>
                  <td className="break-word">
                    <DictationText dictation={dictation} />
                  </td>
                  <td className="mono nowrap">{dictation.correctionModel ?? "—"}</td>
                  <td className="numeric nowrap">
                    {dictation.inputTokens + dictation.outputTokens > 0
                      ? `${dictation.inputTokens} / ${dictation.outputTokens}`
                      : "—"}
                  </td>
                  <td>
                    <button className="button small" disabled={deletion.pending} onClick={() => remove(dictation)}>
                      {text.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DictationText({ dictation }: { dictation: Dictation }) {
  const { text } = useText();
  if (dictation.correctedText === null) {
    return <span className="muted">{text.historyNotSaved}</span>;
  }
  return (
    <>
      <div>{dictation.correctedText}</div>
      {dictation.error && <div className="muted">{dictation.error}</div>}
      {dictation.rawText && dictation.rawText !== dictation.correctedText && (
        <details>
          <summary className="muted">{text.historyRaw}</summary>
          <div className="muted">{dictation.rawText}</div>
        </details>
      )}
    </>
  );
}
