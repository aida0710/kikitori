import { catalogs, type TextCatalog } from "./catalog.ts";
import { intlLocaleOf, useLocale } from "./locale.ts";

/** 今の表示言語の文言と、日時の書式に使う Intl の言語。 */
export function useText(): { text: TextCatalog; intlLocale: string } {
  const locale = useLocale();
  return { text: catalogs[locale], intlLocale: intlLocaleOf(locale) };
}
