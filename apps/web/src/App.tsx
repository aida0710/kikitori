import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { failureMessage, kikitoriApi } from "./api/kikitoriApi.ts";
import { useQuery } from "./hooks/useQuery.ts";
import { useText } from "./i18n/useText.ts";
import { AppShell } from "./layout/AppShell.tsx";
import { isUnauthorizedError, UNAUTHORIZED_EVENT } from "./lib/http.ts";
import { AccessKeysPage } from "./pages/AccessKeysPage.tsx";
import { HistoryPage } from "./pages/HistoryPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { OverviewPage } from "./pages/OverviewPage.tsx";
import { ServerSettingsPage } from "./pages/ServerSettingsPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { UsersPage } from "./pages/UsersPage.tsx";
import { ErrorNotice, LoadingMessage } from "./ui/Feedback.tsx";

/** ログインしているかで、ログイン画面か、枠と各画面かを出す。 */
export function App() {
  const { text } = useText();
  const me = useQuery({ key: "me", load: kikitoriApi.me });
  // ログインの期限切れやログアウトで、どれかの API が 401 を返したら、ログインの画面へ移る
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    const showLogin = () => setSignedOut(true);
    window.addEventListener(UNAUTHORIZED_EVENT, showLogin);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, showLogin);
  }, []);
  // 読み込みの部品は 401 のあとも前の利用者の値を持ったままなので、値より先に見る
  if (signedOut || isUnauthorizedError(me.error)) {
    return (
      <LoginPage
        onLogin={() => {
          setSignedOut(false);
          me.reload();
        }}
      />
    );
  }
  if (!me.value) {
    if (me.error) {
      return <ErrorNotice message={failureMessage(me.error, text.networkError)} onRetry={me.reload} retryLabel={text.retry} />;
    }
    return <LoadingMessage label={text.loading} />;
  }
  const user = me.value;
  const isAdmin = user.role === "admin";
  return (
    <Routes>
      <Route element={<AppShell user={user} onLoggedOut={me.reload} />}>
        <Route index element={<OverviewPage />} />
        <Route path="keys" element={<AccessKeysPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {isAdmin && <Route path="admin/users" element={<UsersPage currentUser={user} />} />}
        {isAdmin && <Route path="admin/server" element={<ServerSettingsPage />} />}
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
