import type { ReactNode } from "react";
import { Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import { useText } from "../i18n/useText.ts";
import { Button } from "../ui/Button.tsx";
import { ErrorNotice, LoadingMessage } from "../ui/Feedback.tsx";
import { StatusBadge } from "../ui/StatusBadge.tsx";

// 文字起こしの常駐プロセスが起動し直したときに気づけるよう、ときどき読み直す
const STATUS_POLL_MS = 15000;

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line-subtle px-4 py-[13px] last:border-b-0">
      <dt className="w-40 text-fg-muted">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

/** 文字起こしと清書の状態と、端末のつなぎ方。 */
export function OverviewPage() {
  const { text } = useText();
  const navigate = useNavigate();
  const status = useQuery({ key: "status", load: kikitoriApi.status, pollMs: STATUS_POLL_MS });
  return (
    <section>
      <PageHeader title={text.overview} description={text.overviewDescription} />
      {status.loading && !status.value && <LoadingMessage label={text.loading} />}
      {status.error !== null && (
        <ErrorNotice message={failureMessage(status.error, text.networkError)} onRetry={status.reload} retryLabel={text.retry} />
      )}
      {status.value && (
        <dl className="rounded-[10px] border border-line bg-panel">
          <StatusRow label={text.statusAsr}>
            <StatusBadge ok={status.value.asr.reachable} label={status.value.asr.reachable ? text.statusReady : text.statusUnavailable} />
            {status.value.asr.model && <span className="font-mono text-[12.5px] text-accent-fg">{status.value.asr.model}</span>}
          </StatusRow>
          <StatusRow label={text.statusCorrection}>
            <StatusBadge
              ok={status.value.correction.configured}
              label={status.value.correction.configured ? text.statusConfigured : text.statusNotConfigured}
            />
          </StatusRow>
        </dl>
      )}
      <h2 className="mb-2 mt-10 text-[16px] font-semibold">{text.connectTitle}</h2>
      <p className="mb-4 text-fg-secondary">{text.connectSteps}</p>
      <dl className="mb-4 rounded-[10px] border border-line bg-panel">
        <StatusRow label={text.connectServerUrl}>
          <span className="font-mono text-[12.5px] text-accent-fg">{window.location.origin}</span>
        </StatusRow>
      </dl>
      <Button variant="primary" icon={<Key />} onClick={() => navigate("/keys")}>
        {text.newAccessKey}
      </Button>
    </section>
  );
}
