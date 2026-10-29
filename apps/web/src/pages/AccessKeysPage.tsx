import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import type { AccessKey, CreatedAccessKey } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useQuery } from "../hooks/useQuery.ts";
import { useText } from "../i18n/useText.ts";
import { copyText } from "../lib/clipboard.ts";
import { formatDateTime } from "../lib/displayFormat.ts";
import { Button } from "../ui/Button.tsx";
import { Cell, DataTable } from "../ui/DataTable.tsx";
import { Dialog } from "../ui/Dialog.tsx";
import { EmptyMessage, ErrorNotice, LoadingMessage } from "../ui/Feedback.tsx";
import { TextField } from "../ui/Field.tsx";

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
    <section>
      <PageHeader
        title={text.accessKeys}
        description={text.accessKeysDescription}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            {text.newAccessKey}
          </Button>
        }
      />
      <ErrorNotice message={deletion.error} />
      {keys.loading && !keys.value && <LoadingMessage label={text.loading} />}
      {keys.error !== null && <ErrorNotice message={failureMessage(keys.error, text.networkError)} onRetry={keys.reload} retryLabel={text.retry} />}
      {keys.value?.length === 0 && <EmptyMessage>{text.noAccessKeys}</EmptyMessage>}
      {keys.value && keys.value.length > 0 && (
        <DataTable headers={[text.accessKeyName, text.accessKeyPrefix, text.accessKeyCreated, text.accessKeyLastUsed, <span className="sr-only">{text.delete}</span>]}>
          {keys.value.map((key) => (
            <tr key={key.id}>
              <Cell className="whitespace-nowrap">{key.name}</Cell>
              <Cell className="font-mono text-[12.5px] text-accent-fg">{key.prefix}…</Cell>
              <Cell className="whitespace-nowrap">{formatDateTime(key.createdAt, intlLocale)}</Cell>
              <Cell className={`whitespace-nowrap ${key.lastUsedAt ? "" : "text-fg-faint"}`}>
                {key.lastUsedAt ? formatDateTime(key.lastUsedAt, intlLocale) : text.accessKeyNever}
              </Cell>
              <Cell className="text-right">
                <Button variant="danger" icon={<Trash2 />} disabled={deletion.pending} onClick={() => remove(key)}>
                  {text.delete}
                </Button>
              </Cell>
            </tr>
          ))}
        </DataTable>
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
      closeLabel={text.close}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.cancel}</Button>
          <Button variant="primary" form={formId} disabled={action.pending || !name.trim()}>
            {text.create}
          </Button>
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
        <TextField
          label={text.accessKeyName}
          required
          autoFocus
          maxLength={80}
          placeholder={text.accessKeyNamePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
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
      closeLabel={text.close}
      onClose={onClose}
      footer={
        <>
          <Button icon={<Copy />} onClick={() => void copyText(accessKey.key).then(setCopied)}>
            {copied ? text.copied : text.copy}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {text.close}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-fg-secondary">{text.accessKeyCreatedNote}</p>
      <p className="select-all break-all rounded-md border border-line-strong bg-canvas px-3 py-2 font-mono text-[12.5px] text-accent-fg">
        {accessKey.key}
      </p>
    </Dialog>
  );
}
