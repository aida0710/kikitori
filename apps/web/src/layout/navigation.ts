import { AudioLines, History, Key, LayoutDashboard, Server, Settings, Users, type LucideIcon } from "lucide-react";
import type { User } from "@kikitori/protocol";
import type { TextCatalog } from "../i18n/catalog.ts";

export interface NavigationLink {
  to: string;
  label: string;
  Icon: LucideIcon;
}

export interface NavigationGroup {
  label: string;
  links: NavigationLink[];
}

/** サイドバー・ドロワーに並べる画面。管理の組は管理者だけに出す。 */
export function navigationGroups(user: User, text: TextCatalog): NavigationGroup[] {
  const groups: NavigationGroup[] = [
    {
      label: text.groupDictation,
      links: [
        { to: "/", label: text.overview, Icon: LayoutDashboard },
        { to: "/playground", label: text.playground, Icon: AudioLines },
        { to: "/keys", label: text.accessKeys, Icon: Key },
        { to: "/history", label: text.history, Icon: History },
        { to: "/settings", label: text.settings, Icon: Settings },
      ],
    },
  ];
  if (user.role === "admin") {
    groups.push({
      label: text.groupAdministration,
      links: [
        { to: "/admin/users", label: text.users, Icon: Users },
        { to: "/admin/server", label: text.serverSettings, Icon: Server },
      ],
    });
  }
  return groups;
}
