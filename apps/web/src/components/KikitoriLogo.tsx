import { ProductLogo } from "@mado/design-system/react";

/** 製品のロゴ。マイクの印（強調色）と、声の線（文字色）。線の太さは窓ファミリーと同じ 1.75。 */
export function KikitoriLogo({ compact = false }: { compact?: boolean }) {
  return (
    <ProductLogo
      compact={compact}
      // 窓ファミリーの製品ではないので、前置きの「mado」を付けない
      prefix=""
      name="Kikitori"
      mark={
        <svg className="product-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path className="product-mark-accent" d="M12 3.5a2.75 2.75 0 0 0-2.75 2.75v5.5a2.75 2.75 0 0 0 5.5 0v-5.5A2.75 2.75 0 0 0 12 3.5Z" />
          <path className="product-mark-base" d="M6.5 11.25a5.5 5.5 0 0 0 11 0M12 16.75v3.75" />
        </svg>
      }
    />
  );
}
