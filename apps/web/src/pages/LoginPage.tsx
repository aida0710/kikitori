import { useState } from "react";
import { ErrorNotice, LanguagePicker, LoginHeader } from "@mado/design-system/react";
import type { User } from "@kikitori/protocol";
import { kikitoriApi } from "../api/kikitoriApi.ts";
import { KikitoriLogo } from "../components/KikitoriLogo.tsx";
import { useAction } from "../hooks/useAction.ts";
import { localeStore } from "../i18n/catalog.ts";
import { useText } from "../i18n/useText.ts";

/** ログイン。窓ファミリーと同じカード（ロゴと表示言語、何のアプリか、フォーム）。 */
export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const { text } = useText();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const action = useAction();
  return (
    <div className="login-page">
      <main className="login-card">
        <LoginHeader logo={<KikitoriLogo />} languagePicker={<LanguagePicker store={localeStore} label={text.language} />} />
        <p className="login-eyebrow">{text.productDescription}</p>
        <h1>{text.loginTitle}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => onLogin(await kikitoriApi.login(username, password)));
          }}
        >
          <label className="field">
            <span>{text.username}</span>
            <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field">
            <span>{text.password}</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <ErrorNotice message={action.error} />
          <button className="button primary" disabled={action.pending}>
            {text.login}
          </button>
        </form>
      </main>
    </div>
  );
}
