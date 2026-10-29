import { useId } from "react";
import { NavLink } from "react-router-dom";
import { useText } from "../i18n/useText.ts";
import type { NavigationGroup } from "./navigation.ts";

/** ナビゲーションのリンク。アイコンだけの列では名前をツールチップで出す。 */
export function NavigationLinkList({ groups, showsTitles = false }: { groups: NavigationGroup[]; showsTitles?: boolean }) {
  const { text } = useText();
  const idPrefix = useId();
  return (
    <nav aria-label={text.navigation}>
      {groups.map((group, index) => {
        const labelId = `${idPrefix}-group-${index}`;
        return (
          <div key={group.label} className="navigation-group" role="group" aria-labelledby={labelId}>
            <span id={labelId} className="navigation-group-label">
              {group.label}
            </span>
            {group.links.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} className="navigation-link" title={showsTitles ? label : undefined}>
                <Icon aria-hidden="true" />
                <span className="navigation-label">{label}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
