import { useId } from "react";
import { NavLink } from "react-router-dom";
import { useText } from "../i18n/useText.ts";
import type { NavigationGroup } from "./navigation.ts";

/** ナビゲーションのリンク。サイドバーとドロワーで同じものを使う。 */
export function NavigationLinkList({ groups, onNavigate }: { groups: NavigationGroup[]; onNavigate?: () => void }) {
  const { text } = useText();
  const idPrefix = useId();
  return (
    <nav aria-label={text.navigation}>
      {groups.map((group, index) => {
        const labelId = `${idPrefix}-group-${index}`;
        return (
          <div key={group.label} className="mb-[18px]" role="group" aria-labelledby={labelId}>
            <span id={labelId} className="block px-2.5 pb-1.5 text-[11px] uppercase tracking-[0.04em] text-fg-faint">
              {group.label}
            </span>
            {group.links.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-2.5 py-[7px] ${isActive ? "bg-hover text-white" : "text-fg-secondary hover:text-fg"}`
                }
              >
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
