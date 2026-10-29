import type { CSSProperties } from "react";
import { Link, Outlet } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { narrowerThan } from "@mado/design-system/layout";
import {
  ErrorNotice,
  LanguagePicker,
  NavigationDrawer,
  NavigationSidebar,
  useMediaQuery,
  useNavigationLayout,
  useTheme,
  UserMenu,
} from "@mado/design-system/react";
import type { User } from "@kikitori/protocol";
import { kikitoriApi } from "../api/kikitoriApi.ts";
import { KikitoriLogo } from "../components/KikitoriLogo.tsx";
import { useAction } from "../hooks/useAction.ts";
import { localeStore } from "../i18n/catalog.ts";
import { useText } from "../i18n/useText.ts";
import { navigationGroups } from "./navigation.ts";
import { NavigationLinkList } from "./NavigationLinkList.tsx";

const THEME_STORAGE_KEY = "kikitori.theme";
const NAVIGATION_STORAGE_PREFIX = "kikitori.navigation";

/** 画面の枠。上部バー（ロゴ・表示言語・テーマ・アカウント）と、サイドバー（狭い幅ではドロワー）。 */
export function AppShell({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const { text } = useText();
  const theme = useTheme({ storageKey: THEME_STORAGE_KEY });
  const layout = useNavigationLayout({ storageKeyPrefix: NAVIGATION_STORAGE_PREFIX });
  const compactLogo = useMediaQuery(narrowerThan("sm"));
  const logout = useAction();
  const groups = navigationGroups(user, text);
  return (
    <div
      className="app-shell"
      data-navigation={layout.mode}
      style={{ "--navigation-width": `${layout.width}px` } as CSSProperties}
    >
      <a className="skip-link" href="#content">
        {text.skipContent}
      </a>
      <header className="topbar">
        {layout.mode === "drawer" && (
          <NavigationDrawer
            labels={{ open: text.openNavigation, close: text.closeNavigation, navigation: text.navigation }}
            header={<KikitoriLogo />}
          >
            <NavigationLinkList groups={groups} />
          </NavigationDrawer>
        )}
        <Link to="/" className="brand">
          <KikitoriLogo compact={compactLogo} />
        </Link>
        <div className="topbar-actions">
          <LanguagePicker store={localeStore} label={text.language} />
          <button
            className="icon-button"
            onClick={theme.toggle}
            aria-label={theme.theme === "light" ? text.darkTheme : text.lightTheme}
          >
            {theme.theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <UserMenu
            displayName={user.username}
            label={text.userMenu}
            items={[
              { label: text.settings, href: "/settings" },
              {
                label: text.logout,
                startsGroup: true,
                disabled: logout.pending,
                onSelect: () => void logout.run(async () => {
                  await kikitoriApi.logout();
                  onLoggedOut();
                }),
              },
            ]}
            renderLink={(item, props) => (
              <Link to={item.href} {...props} />
            )}
          />
        </div>
      </header>
      <ErrorNotice message={logout.error} />
      <div className="app-body">
        {layout.mode !== "drawer" && (
          <NavigationSidebar
            layout={layout}
            labels={{
              sidebar: text.navigationSidebar,
              expand: text.expandNavigation,
              collapse: text.collapseNavigation,
              width: text.resizeNavigation,
            }}
            renderLinks={({ showsTitles }) => <NavigationLinkList groups={groups} showsTitles={showsTitles} />}
          />
        )}
        <div className="app-content">
          <main id="content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
