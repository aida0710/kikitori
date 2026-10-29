import { useState } from "react";
import type { User } from "@kikitori/protocol";
import { kikitoriApi } from "../api/kikitoriApi.ts";
import { KikitoriLogo } from "../components/KikitoriLogo.tsx";
import { useAction } from "../hooks/useAction.ts";
import { LANGUAGES, setLocale, useLocale } from "../i18n/locale.ts";
import { useText } from "../i18n/useText.ts";
import { Button } from "../ui/Button.tsx";
import { ErrorNotice } from "../ui/Feedback.tsx";
import { TextField } from "../ui/Field.tsx";

/** ログイン。黒の地の中央に、ロゴ・何のアプリか・フォームを並べたカード。 */
export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const { text } = useText();
  const locale = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const action = useAction();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <main className="w-full max-w-[380px] rounded-xl border border-line bg-panel p-7">
        <div className="mb-6 flex items-center justify-between">
          <KikitoriLogo />
          <select
            aria-label={text.language}
            value={locale}
            onChange={(event) => setLocale(event.target.value as typeof locale)}
            className="h-7 rounded-md border border-line-strong bg-canvas px-2 text-fg-secondary"
          >
            {LANGUAGES.map((language) => (
              <option key={language.locale} value={language.locale}>
                {language.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-fg-muted">{text.productDescription}</p>
        <h1 className="mb-6 mt-1 text-[24px] font-semibold tracking-[-0.02em]">{text.loginTitle}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => onLogin(await kikitoriApi.login(username, password)));
          }}
        >
          <TextField label={text.username} required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <TextField
            label={text.password}
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <ErrorNotice message={action.error} />
          <Button variant="primary" className="w-full justify-center" disabled={action.pending}>
            {text.login}
          </Button>
        </form>
      </main>
    </div>
  );
}
