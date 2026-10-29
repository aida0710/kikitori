import { useState } from "react";
import { Dialog, ErrorNotice, LoadingMessage, useQuery } from "@mado/design-system/react";
import type { User, UserRole } from "@kikitori/protocol";
import { failureMessage, kikitoriApi } from "../api/kikitoriApi.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useText } from "../i18n/useText.ts";
import { formatDateTime } from "../lib/displayFormat.ts";

/** 利用者の一覧と、作成・役割の変更・無効化・パスワードの設定し直し・削除（管理者だけ）。 */
export function UsersPage({ currentUser }: { currentUser: User }) {
  const { text, intlLocale } = useText();
  const users = useQuery({ key: "users", load: kikitoriApi.users });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const action = useAction();
  const roleLabel = (role: UserRole) => (role === "admin" ? text.roleAdmin : text.roleMember);

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
    <section className="page">
      <PageHeader
        title={text.users}
        description={text.usersDescription}
        actions={
          <button className="button primary" onClick={() => setCreating(true)}>
            {text.newUser}
          </button>
        }
      />
      <ErrorNotice message={action.error} />
      {users.loading && !users.value && <LoadingMessage label={text.loading} />}
      {users.error !== undefined && users.error !== null && (
        <ErrorNotice message={failureMessage(users.error, text.networkError)} retry={users.reload} />
      )}
      {users.value && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{text.username}</th>
                <th scope="col">{text.role}</th>
                <th scope="col">{text.state}</th>
                <th scope="col">{text.accessKeyCreated}</th>
                <th scope="col">
                  <span className="sr-only">{text.settings}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.value.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>
                    <select
                      aria-label={text.role}
                      value={user.role}
                      disabled={action.pending}
                      onChange={(event) => change(user, { role: event.target.value as UserRole })}
                    >
                      <option value="admin">{roleLabel("admin")}</option>
                      <option value="member">{roleLabel("member")}</option>
                    </select>
                  </td>
                  <td>
                    <StatusBadge ok={!user.disabled} label={user.disabled ? text.disabled : text.active} />
                  </td>
                  <td className="nowrap">{formatDateTime(user.createdAt, intlLocale)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="button small" disabled={action.pending} onClick={() => setResetting(user)}>
                        {text.resetPassword}
                      </button>
                      <button
                        className="button small"
                        disabled={action.pending}
                        onClick={() => change(user, { disabled: !user.disabled })}
                      >
                        {user.disabled ? text.enable : text.disable}
                      </button>
                      {user.id !== currentUser.id && (
                        <button className="button small danger" disabled={action.pending} onClick={() => remove(user)}>
                          {text.delete}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          title={`${text.resetPassword}: ${resetting.username}`}
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
  passwordOnly = false,
  onClose,
  onSubmit,
}: {
  title: string;
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
      onClose={onClose}
      closeLabel={text.close}
      footer={
        <>
          <button className="button" onClick={onClose}>
            {text.cancel}
          </button>
          <button className="button primary" form={formId} disabled={action.pending}>
            {text.save}
          </button>
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
          <label className="field">
            <span>{text.username}</span>
            <input
              required
              autoComplete="off"
              value={values.username}
              onChange={(event) => setValues({ ...values, username: event.target.value })}
            />
          </label>
        )}
        <label className="field">
          <span>{text.newPassword}</span>
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
          />
        </label>
        {!passwordOnly && (
          <label className="field">
            <span>{text.role}</span>
            <select value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as UserRole })}>
              <option value="member">{text.roleMember}</option>
              <option value="admin">{text.roleAdmin}</option>
            </select>
          </label>
        )}
        <ErrorNotice message={action.error} />
      </form>
    </Dialog>
  );
}
