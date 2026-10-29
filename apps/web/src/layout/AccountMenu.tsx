import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { User } from "@kikitori/protocol";
import { LANGUAGES, setLocale, useLocale } from "../i18n/locale.ts";
import { useText } from "../i18n/useText.ts";

/** 上部バーの右の丸（利用者の頭文字）。押すと、設定・表示言語・ログアウトを出す。 */
export function AccountMenu({ user, onLogout, loggingOut }: { user: User; onLogout: () => void; loggingOut: boolean }) {
  const { text } = useText();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const itemClass = "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-fg-secondary hover:bg-hover hover:text-fg";
  return (
    <div ref={container} className="relative">
      <button
        aria-label={text.userMenu}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-[30px] cursor-pointer place-items-center rounded-full border border-line-strong bg-line text-[11px] text-fg-secondary hover:text-fg"
      >
        {user.username.slice(0, 2).toUpperCase()}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-20 w-56 rounded-[10px] border border-[#2a2a2a] bg-raised p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <div className="border-b border-line px-2.5 pb-2 pt-1 text-fg">{user.username}</div>
          <div className="py-1.5">
            <Link role="menuitem" to="/settings" className={itemClass} onClick={() => setOpen(false)}>
              {text.settings}
            </Link>
          </div>
          <div className="border-t border-line py-1.5">
            <span className="block px-2.5 pb-1 text-[11px] uppercase tracking-[0.04em] text-fg-faint">{text.language}</span>
            {LANGUAGES.map((language) => (
              <button key={language.locale} role="menuitemradio" aria-checked={locale === language.locale} className={itemClass} onClick={() => setLocale(language.locale)}>
                <span className="flex-1">{language.name}</span>
                {locale === language.locale && <Check className="size-4 text-accent-fg" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-1.5">
            <button role="menuitem" className={itemClass} disabled={loggingOut} onClick={onLogout}>
              {text.logout}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
