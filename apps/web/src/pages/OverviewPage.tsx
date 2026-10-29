import { ErrorNotice, LoadingMessage, useQuery } from "@mado/design-system/react";
import { Link } from "react-router-dom";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { useText } from "../i18n/useText.ts";

// 文字起こしの常駐プロセスが起動し直したときに気づけるよう、ときどき読み直す
const STATUS_POLL_MS = 15000;

/** 文字起こしと清書の状態と、端末のつなぎ方。 */
export function OverviewPage() {
  const { text } = useText();
  const status = useQuery({ key: "status", load: kikitoriApi.status, pollMs: STATUS_POLL_MS });
  return (
    <section className="page">
      <PageHeader title={text.overview} description={text.overviewDescription} />
      {status.loading && !status.value && <LoadingMessage label={text.loading} />}
      {status.error !== undefined && status.error !== null && (
        <ErrorNotice message={failureMessage(status.error, text.networkError)} retry={status.reload} />
      )}
      {status.value && (
        <dl className="details-list">
          <div>
            <dt>{text.statusAsr}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <StatusBadge
                ok={status.value.asr.reachable}
                label={status.value.asr.reachable ? text.statusReady : text.statusUnavailable}
              />
              {status.value.asr.model && <span className="mono muted">{status.value.asr.model}</span>}
            </dd>
          </div>
          <div>
            <dt>{text.statusCorrection}</dt>
            <dd>
              <StatusBadge
                ok={status.value.correction.configured}
                label={status.value.correction.configured ? text.statusConfigured : text.statusNotConfigured}
              />
            </dd>
          </div>
        </dl>
      )}
      <h2 className="section-heading mt-10">{text.connectTitle}</h2>
      <p>{text.connectSteps}</p>
      <dl className="details-list">
        <div>
          <dt>{text.connectServerUrl}</dt>
          <dd className="mono">{window.location.origin}</dd>
        </div>
      </dl>
      <p>
        <Link className="button" to="/keys">
          {text.newAccessKey}
        </Link>
      </p>
    </section>
  );
}
