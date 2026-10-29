import { useEffect, type ReactNode } from "react";

/** 画面の見出し。ブラウザのタブの名前にもする。右に主な操作を置く。 */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Kikitori`;
  }, [title]);
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1.5 text-fg-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
