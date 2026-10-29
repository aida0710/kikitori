import type { ReactNode } from "react";

/** 表の枠と見出しの行。行は呼ぶ側が <tr> で書き、セルには Cell を使う。 */
export function DataTable({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-line bg-panel">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} scope="col" className="whitespace-nowrap border-b border-line px-4 py-[11px] text-left text-[12px] font-medium text-fg-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child_td]:border-b-0">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-line-subtle px-4 py-[13px] ${className}`}>{children}</td>;
}
