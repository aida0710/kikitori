/** 状態の印。ok なら緑、そうでなければ赤。 */
export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  const tone = ok ? "border-success/25 bg-success/10 text-green-300" : "border-danger/25 bg-danger/10 text-red-300";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] ${tone}`}>
      <span className={`size-1.5 rounded-full ${ok ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
      {label}
    </span>
  );
}
