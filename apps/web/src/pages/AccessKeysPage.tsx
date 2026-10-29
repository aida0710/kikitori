import { useState } from "react";
import { copyText } from "@mado/design-system/clipboard";
import { Dialog, EmptyMessage, ErrorNotice, LoadingMessage, useQuery } from "@mado/design-system/react";
import type { AccessKey, CreatedAccessKey } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useText } from "../i18n/useText.ts";
import { formatDateTime } from "../lib/displayFormat.ts";

/** アクセスキーの一覧・作成・削除。作ったキーはダイアログで一度だけ見せる。 */
export function AccessKeysPage() {
  const { text, intlLocale } = useText();
  const keys = useQuery({ key: "access-keys", load: kikitoriApi.accessKeys });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAccessKey | null>(null);
  const deletion = useAction();

  const remove = (key: AccessKey) => {
    if (!window.confirm(text.deleteAccessKeyConfirm)) return;
    void deletion.run(async () => {
      await kikitoriApi.deleteAccessKey(key.id);
      keys.reload();
    });
  };

  return (
    <section className="page">
      <PageHeader
        title={text.accessKeys}
        description={text.accessKeysDescription}
        actions={
          <button className="button primary" onClick={() => setCreating(true)}>
            {text.newAccessKey}
          </button>
        }
      />
      <ErrorNotice message={deletion.error} />
      {keys.loading && !keys.value && <LoadingMessage label={text.loading} />}
      {keys.error !== undefined && keys.error !== null && (
        <ErrorNotice message={failureMessage(keys.error, text.networkError)} retry={keys.reload} />
      )}
      {keys.value && keys.value.length === 0 && <EmptyMessage>{text.noAccessKeys}</EmptyMessage>}
      {keys.value && keys.value.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{text.accessKeyName}</th>
                <th scope="col">{text.accessKeyPrefix}</th>
                <th scope="col">{text.accessKeyCreated}</th>
                <th scope="col">{text.accessKeyLastUsed}</th>
                <th scope="col">
                  <span className="sr-only">{text.delete}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.value.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td className="mono">{key.prefix}…</td>
                  <td className="nowrap">{formatDateTime(key.createdAt, intlLocale)}</td>
                  <td className="nowrap">
                    {key.lastUsedAt ? formatDateTime(key.lastUsedAt, intlLocale) : text.accessKeyNever}
                  </td>
                  <td>
                    <button className="button danger" disabled={deletion.pending} onClick={() => remove(key)}>
                      {text.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <CreateAccessKeyDialog
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false);
            setCreated(key);
            keys.reload();
          }}
        />
      )}
      {created && <CreatedAccessKeyDialog accessKey={created} onClose={() => setCreated(null)} />}
    </section>
  );
}

function CreateAccessKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: CreatedAccessKey) => void }) {
  const { text } = useText();
  const [name, setName] = useState("");
  const action = useAction();
  const formId = "create-access-key";
  return (
    <Dialog
      title={text.newAccessKey}
      onClose={onClose}
      closeLabel={text.close}
      footer={
        <>
          <button className="button" onClick={onClose}>
            {text.cancel}
          </button>
          <button className="button primary" form={formId} disabled={action.pending || !name.trim()}>
            {text.create}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => onCreated(await kikitoriApi.createAccessKey(name.trim())));
        }}
      >
        <label className="field">
          <span>{text.accessKeyName}</span>
          <input
            required
            maxLength={80}
            placeholder={text.accessKeyNamePlaceholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <ErrorNotice message={action.error} />
      </form>
    </Dialog>
  );
}

function CreatedAccessKeyDialog({ accessKey, onClose }: { accessKey: CreatedAccessKey; onClose: () => void }) {
  const { text } = useText();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      title={text.accessKeyCreatedTitle}
      subtitle={accessKey.name}
      onClose={onClose}
      closeLabel={text.close}
      footer={
        <>
          <button className="button" onClick={() => void copyText(accessKey.key).then(setCopied)}>
            {copied ? text.copied : text.copy}
          </button>
          <button className="button primary" onClick={onClose}>
            {text.close}
          </button>
        </>
      }
    >
      <p>{text.accessKeyCreatedNote}</p>
      <p className="secret-value">{accessKey.key}</p>
    </Dialog>
  );
}
