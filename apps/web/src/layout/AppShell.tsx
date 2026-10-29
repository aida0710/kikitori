import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import type { User } from "@kikitori/protocol";
import { kikitoriApi } from "../api/kikitoriApi.ts";
import { KikitoriLogo } from "../components/KikitoriLogo.tsx";
import { useAction } from "../hooks/useAction.ts";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { useText } from "../i18n/useText.ts";
import { ErrorNotice } from "../ui/Feedback.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { navigationGroups } from "./navigation.ts";
import { NavigationLinkList } from "./NavigationLinkList.tsx";

// これより狭い画面では、サイドバーをやめて上部バーのボタンから開くドロワーにする
const NARROW_SCREEN = "(width < 900px)";

/** 画面の枠。上部バー（ロゴ・アカウント）と、左のサイドバー（狭い画面ではドロワー）。 */
export function AppShell({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const { text } = useText();
  const narrow = useMediaQuery(NARROW_SCREEN);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const logout = useAction();
  const groups = navigationGroups(user, text);
  useEffect(() => setDrawerOpen(false), [location.pathname, narrow]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2">
        {text.skipContent}
      </a>
      <header className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-line bg-canvas px-5">
        <div className="flex items-center gap-3">
          {narrow && (
            <button
              aria-label={drawerOpen ? text.closeNavigation : text.openNavigation}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="cursor-pointer rounded-md p-1 text-fg-secondary hover:bg-hover hover:text-fg"
            >
              {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
          <Link to="/">
            <KikitoriLogo />
          </Link>
        </div>
        <AccountMenu
          user={user}
          loggingOut={logout.pending}
          onLogout={() =>
            void logout.run(async () => {
              await kikitoriApi.logout();
              onLoggedOut();
            })
          }
        />
      </header>
      <div className="flex flex-1">
        {(!narrow || drawerOpen) && (
          <aside
            className={
              narrow
                ? "fixed inset-x-0 bottom-0 top-[52px] z-20 overflow-y-auto bg-canvas px-2.5 py-3.5"
                : "sticky top-[52px] h-[calc(100vh-52px)] w-[228px] shrink-0 overflow-y-auto border-r border-line px-2.5 py-3.5"
            }
          >
            <NavigationLinkList groups={groups} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        )}
        <main id="content" className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8">
          <ErrorNotice message={logout.error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
