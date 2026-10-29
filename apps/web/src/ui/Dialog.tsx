import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** ブラウザの <dialog> をモーダルで開く。開いている間だけ描く（{open && <Dialog …/>}）。Escape で閉じる。 */
export function Dialog({
  title,
  subtitle,
  closeLabel,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-xl border border-[#2a2a2a] bg-raised p-0 text-fg shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-fg-muted">{subtitle}</p>}
        </div>
        <button className="cursor-pointer rounded-md p-1 text-fg-muted hover:bg-hover hover:text-fg" aria-label={closeLabel} onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  );
}
