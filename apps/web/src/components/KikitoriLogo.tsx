import { Mic } from "lucide-react";

/** 製品のロゴ。紫の傾きの角丸の印にマイク、横に名前。compact では印だけを見せる（名前は読み上げ用に残す）。 */
export function KikitoriLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold">
      <span className="grid size-[26px] place-items-center rounded-[7px] bg-gradient-to-br from-accent to-accent-deep text-white">
        <Mic className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className={compact ? "sr-only" : ""}>Kikitori</span>
    </span>
  );
}
