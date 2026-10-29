import { useState } from "react";
import { Copy, Eraser, Mic, Square, X } from "lucide-react";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import { useText } from "../i18n/useText.ts";
import { copyText } from "../lib/clipboard.ts";
import { type PlaygroundState, usePlaygroundSession } from "../playground/usePlaygroundSession.ts";
import { Button } from "../ui/Button.tsx";
import { Cell, DataTable } from "../ui/DataTable.tsx";
import { ErrorNotice } from "../ui/Feedback.tsx";
import { CheckboxField } from "../ui/Field.tsx";

/** ブラウザーのマイクで音声入力を試す。端末と同じ流れ（文字起こし → 区切りごとの清書）。 */
export function PlaygroundPage() {
  const { text } = useText();
  const session = usePlaygroundSession();
  const status = useQuery({ key: "status", load: kikitoriApi.status });
  const [correction, setCorrection] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const transcript = session.segments.map((segment) => segment.text).join("");
  const microphoneAvailable = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
  const statusLabel: Record<PlaygroundState, string> = {
    idle: text.playgroundIdle,
    connecting: text.playgroundConnecting,
    listening: text.playgroundListening,
    finishing: text.playgroundFinishing,
  };

  const start = () => {
    setStartError(null);
    setCopied(false);
    session.start({ correction }).catch((failure: unknown) => {
      const denied = failure instanceof DOMException && failure.name === "NotAllowedError";
      setStartError(denied ? text.playgroundMicrophoneDenied : failureMessage(failure, text.playgroundMicrophoneFailed));
    });
  };

  return (
    <section>
      <PageHeader title={text.playground} description={text.playgroundDescription} />
      {!microphoneAvailable && (
        <div className="mb-6 rounded-[10px] border border-line bg-panel px-4 py-3 text-fg-secondary">
          {text.playgroundNeedsHttps}
          {status.value?.httpsUrl && (
            <>
              {" "}
              <a className="font-mono text-[12.5px] text-accent-fg underline" href={`${status.value.httpsUrl}/playground`}>
                {`${status.value.httpsUrl}/playground`}
              </a>
            </>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-5 rounded-[10px] border border-line bg-panel px-5 py-4">
        <MicrophoneButton
          state={session.state}
          level={session.level}
          disabled={!microphoneAvailable}
          startLabel={text.playgroundStart}
          stopLabel={text.playgroundStop}
          onStart={start}
          onStop={session.stop}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-fg-muted">{statusLabel[session.state]}</p>
          <p className="mt-0.5 text-fg-secondary">{text.playgroundHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CheckboxField
            label={text.correctionEnabled}
            className=""
            checked={correction}
            disabled={session.state !== "idle"}
            onChange={(event) => setCorrection(event.target.checked)}
          />
          {session.state !== "idle" && (
            <Button icon={<X />} onClick={session.cancel}>
              {text.cancel}
            </Button>
          )}
        </div>
      </div>

      <ErrorNotice message={startError ?? session.error} />

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">{text.playgroundTranscript}</h2>
        <div className="flex gap-2">
          <Button icon={<Copy />} disabled={!transcript} onClick={() => void copyText(transcript).then(setCopied)}>
            {copied ? text.copied : text.copy}
          </Button>
          <Button icon={<Eraser />} disabled={session.state !== "idle" || (!transcript && !session.partial)} onClick={session.clear}>
            {text.playgroundClear}
          </Button>
        </div>
      </div>
      <div className="mb-8 min-h-[140px] rounded-[10px] border border-line bg-panel px-4 py-3 text-[15px] leading-relaxed">
        {transcript || session.partial ? (
          <>
            <span>{transcript}</span>
            <span className="text-fg-faint">{session.partial}</span>
          </>
        ) : (
          <span className="text-fg-faint">{text.playgroundEmpty}</span>
        )}
      </div>

      {session.segments.length > 0 && (
        <>
          <h2 className="mb-2 text-[16px] font-semibold">{text.playgroundSegments}</h2>
          <DataTable headers={["#", text.historyRaw, text.playgroundCorrected, text.playgroundArrived]}>
            {session.segments.map((segment) => (
              <tr key={segment.index} className="align-top">
                <Cell className="font-mono text-[12.5px] text-fg-faint">{segment.index + 1}</Cell>
                <Cell className="min-w-[220px] text-fg-muted">{segment.raw}</Cell>
                <Cell className="min-w-[220px]">
                  {segment.text}
                  {!segment.corrected && <span className="ml-2 text-[12px] text-fg-faint">{text.playgroundNotCorrected}</span>}
                </Cell>
                <Cell className="whitespace-nowrap font-mono text-[12.5px] tabular-nums text-fg-secondary">
                  {(segment.arrivedAfterMs / 1000).toFixed(1)} s
                </Cell>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </section>
  );
}

/** 押して話し始め、もう一度押して止める丸いボタン。話している音の大きさで外側の輪が広がる。 */
function MicrophoneButton({
  state,
  level,
  disabled,
  startLabel,
  stopLabel,
  onStart,
  onStop,
}: {
  state: PlaygroundState;
  level: number;
  disabled: boolean;
  startLabel: string;
  stopLabel: string;
  onStart: () => void;
  onStop: () => void;
}) {
  const listening = state === "listening" || state === "connecting";
  return (
    <div className="relative grid size-[72px] place-items-center">
      <span
        className="absolute inset-0 rounded-full bg-accent/25 transition-transform duration-100"
        style={{ transform: `scale(${listening ? 0.75 + level * 0.25 : 0.75})` }}
        aria-hidden="true"
      />
      <button
        aria-label={listening ? stopLabel : startLabel}
        disabled={disabled || state === "finishing"}
        onClick={listening ? onStop : onStart}
        className="relative grid size-14 cursor-pointer place-items-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-white disabled:cursor-default disabled:opacity-40"
      >
        {listening ? <Square className="size-5" fill="currentColor" /> : <Mic className="size-6" strokeWidth={1.75} />}
      </button>
    </div>
  );
}
