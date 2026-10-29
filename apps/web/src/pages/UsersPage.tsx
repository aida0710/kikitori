import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { User, UserRole } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useQuery } from "../hooks/useQuery.ts";
import { useText } from "../i18n/useText.ts";
import { formatDateTime } from "../lib/displayFormat.ts";
import { Button } from "../ui/Button.tsx";
import { Cell, DataTable } from "../ui/DataTable.tsx";
import { Dialog } from "../ui/Dialog.tsx";
import { ErrorNotice, LoadingMessage } from "../ui/Feedback.tsx";
import { InlineSelect, SelectField, TextField } from "../ui/Field.tsx";
import { StatusBadge } from "../ui/StatusBadge.tsx";

/** 利用者の一覧と、作成・役割の変更・無効化・パスワードの設定し直し・削除（管理者だけ）。 */
export function UsersPage({ currentUser }: { currentUser: User }) {
  const { text, intlLocale } = useText();
  const users = useQuery({ key: "users", load: kikitoriApi.users });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const action = useAction();

  const change = (user: User, changes: { role?: UserRole; disabled?: boolean }) =>
    void action.run(async () => {
      await kikitoriApi.updateUser(user.id, changes);
      users.reload();
    });
  const remove = (user: User) => {
    if (!window.confirm(text.deleteUserConfirm)) return;
    void action.run(async () => {
      await kikitoriApi.deleteUser(user.id);
      users.reload();
    });
  };

  return (
    <section>
      <PageHeader
        title={text.users}
        description={text.usersDescription}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            {text.newUser}
          </Button>
        }
      />
      <ErrorNotice message={action.error} />
      {users.loading && !users.value && <LoadingMessage label={text.loading} />}
      {users.error !== null && <ErrorNotice message={failureMessage(users.error, text.networkError)} onRetry={users.reload} retryLabel={text.retry} />}
      {users.value && (
        <DataTable headers={[text.username, text.role, text.state, text.accessKeyCreated, <span className="sr-only">{text.settings}</span>]}>
          {users.value.map((user) => (
            <tr key={user.id}>
              <Cell>{user.username}</Cell>
              <Cell>
                <InlineSelect
                  aria-label={text.role}
                  value={user.role}
                  disabled={action.pending}
                  onChange={(event) => change(user, { role: event.target.value as UserRole })}
                >
                  <option value="admin">{text.roleAdmin}</option>
                  <option value="member">{text.roleMember}</option>
                </InlineSelect>
              </Cell>
              <Cell>
                <StatusBadge ok={!user.disabled} label={user.disabled ? text.disabled : text.active} />
              </Cell>
              <Cell className="whitespace-nowrap">{formatDateTime(user.createdAt, intlLocale)}</Cell>
              <Cell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button disabled={action.pending} onClick={() => setResetting(user)}>
                    {text.resetPassword}
                  </Button>
                  <Button disabled={action.pending} onClick={() => change(user, { disabled: !user.disabled })}>
                    {user.disabled ? text.enable : text.disable}
                  </Button>
                  {user.id !== currentUser.id && (
                    <Button variant="danger" icon={<Trash2 />} disabled={action.pending} onClick={() => remove(user)}>
                      {text.delete}
                    </Button>
                  )}
                </div>
              </Cell>
            </tr>
          ))}
        </DataTable>
      )}
      {creating && (
        <UserFormDialog
          title={text.newUser}
          onClose={() => setCreating(false)}
          onSubmit={async ({ username, password, role }) => {
            await kikitoriApi.createUser({ username, password, role });
            setCreating(false);
            users.reload();
          }}
        />
      )}
      {resetting && (
        <UserFormDialog
          title={text.resetPassword}
          subtitle={resetting.username}
          passwordOnly
          onClose={() => setResetting(null)}
          onSubmit={async ({ password }) => {
            await kikitoriApi.updateUser(resetting.id, { password });
            setResetting(null);
          }}
        />
      )}
    </section>
  );
}

interface UserFormValues {
  username: string;
  password: string;
  role: UserRole;
}

function UserFormDialog({
  title,
  subtitle,
  passwordOnly = false,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  passwordOnly?: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}) {
  const { text } = useText();
  const [values, setValues] = useState<UserFormValues>({ username: "", password: "", role: "member" });
  const action = useAction();
  const formId = "user-form";
  return (
    <Dialog
      title={title}
      subtitle={subtitle}
      closeLabel={text.close}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.cancel}</Button>
          <Button variant="primary" form={formId} disabled={action.pending}>
            {text.save}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(() => onSubmit(values));
        }}
      >
        {!passwordOnly && (
          <TextField
            label={text.username}
            required
            autoFocus
            autoComplete="off"
            value={values.username}
            onChange={(event) => setValues({ ...values, username: event.target.value })}
          />
        )}
        <TextField
          label={text.newPassword}
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        {!passwordOnly && (
          <SelectField label={text.role} value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as UserRole })}>
            <option value="member">{text.roleMember}</option>
            <option value="admin">{text.roleAdmin}</option>
          </SelectField>
        )}
        <ErrorNotice message={action.error} />
      </form>
    </Dialog>
  );
}
