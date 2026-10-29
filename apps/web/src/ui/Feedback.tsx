import type { ReactNode } from "react";

/** 失敗の文。message が無ければ何も出さない。 */
export function ErrorNotice({ message, onRetry, retryLabel }: { message: string | null; onRetry?: () => void; retryLabel?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="my-3 flex items-center gap-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-red-300">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button className="cursor-pointer text-fg-secondary underline hover:text-fg" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="my-3 rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-green-300">
      {children}
    </div>
  );
}

export function LoadingMessage({ label }: { label: string }) {
  return <p className="py-6 text-fg-muted">{label}</p>;
}

export function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] border border-line bg-panel px-4 py-8 text-center text-fg-muted">{children}</p>;
}
