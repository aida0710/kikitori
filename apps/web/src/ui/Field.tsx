import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL_CLASSES =
  "w-full rounded-md border border-line-strong bg-canvas px-3 text-fg placeholder:text-fg-faint focus:border-accent focus:outline-none";

function FieldFrame({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-5 block">
      <span className="mb-1.5 block text-[13px] text-fg-secondary">{label}</span>
      {children}
      {note && <span className="mt-1.5 block text-[12px] text-fg-faint">{note}</span>}
    </label>
  );
}

export function TextField({ label, note, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; note?: ReactNode }) {
  return (
    <FieldFrame label={label} note={note}>
      <input className={`h-9 ${CONTROL_CLASSES}`} {...props} />
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  note,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; note?: ReactNode }) {
  return (
    <FieldFrame label={label} note={note}>
      <textarea className={`py-2 ${CONTROL_CLASSES}`} {...props} />
    </FieldFrame>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <FieldFrame label={label}>
      <select className={`h-9 ${CONTROL_CLASSES}`} {...props}>
        {children}
      </select>
    </FieldFrame>
  );
}

export function CheckboxField({
  label,
  className = "mb-5",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 ${className}`}>
      <input type="checkbox" className="size-4 accent-accent" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** 表の中に置く小さな選択欄（利用者の役割など）。 */
export function InlineSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className="h-7 rounded-md border border-line-strong bg-canvas px-2 text-fg focus:border-accent focus:outline-none" {...props}>
      {children}
    </select>
  );
}
