import { intlLocaleOf } from "@mado/design-system/locale";
import { useLocale } from "@mado/design-system/react";
import { catalogs, localeStore, type TextCatalog } from "./catalog.ts";

/** 今の表示言語の文言と、日時の書式に使う Intl の言語。 */
export function useText(): { text: TextCatalog; intlLocale: string } {
  const { locale } = useLocale(localeStore);
  return { text: catalogs[locale], intlLocale: intlLocaleOf(locale) };
}
