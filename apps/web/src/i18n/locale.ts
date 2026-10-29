/** 表示言語。選び直した言語 → ブラウザの優先言語 → 英語の順に決め、選び直したものはブラウザに覚えさせる。 */
import { useSyncExternalStore } from "react";

export type Locale = "en" | "ja";

export const LANGUAGES: ReadonlyArray<{ locale: Locale; name: string }> = [
  { locale: "ja", name: "日本語" },
  { locale: "en", name: "English" },
];

const STORAGE_KEY = "kikitori.locale";
const listeners = new Set<() => void>();

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ja";
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // 保存できない（プライベートのウィンドウなど）ときは、ブラウザの言語で決める
  }
  return navigator.languages.some((language) => language.toLowerCase().startsWith("ja")) ? "ja" : "en";
}

let currentLocale: Locale = initialLocale();

export function applyLocaleToDocument(): void {
  document.documentElement.lang = currentLocale;
}

export function setLocale(next: Locale): void {
  currentLocale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 覚えられなくても、この画面の間は切り替える
  }
  applyLocaleToDocument();
  listeners.forEach((listener) => listener());
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentLocale,
  );
}

export function intlLocaleOf(locale: Locale): string {
  return locale === "ja" ? "ja-JP" : "en-US";
}
