import { Navigate, Route, Routes } from "react-router-dom";
import { failureMessage, kikitoriApi } from "./api/kikitoriApi.ts";
import { useQuery } from "./hooks/useQuery.ts";
import { useText } from "./i18n/useText.ts";
import { AppShell } from "./layout/AppShell.tsx";
import { isUnauthorizedError } from "./lib/http.ts";
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
  if (me.loading && !me.value) {
    return <LoadingMessage label={text.loading} />;
  }
  if (!me.value) {
    if (me.error && !isUnauthorizedError(me.error)) {
      return <ErrorNotice message={failureMessage(me.error, text.networkError)} onRetry={me.reload} retryLabel={text.retry} />;
    }
    return <LoginPage onLogin={me.reload} />;
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
