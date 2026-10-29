/** 状態の印。ok なら success、そうでなければ danger の色。 */
export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`status-badge ${ok ? "status-success" : "status-danger"}`}>{label}</span>;
}
