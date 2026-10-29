import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";

// 試作の寸法: 主のボタンは高さ 34px、それ以外は 28px。角は 6px
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "h-[34px] px-3.5 bg-fg text-canvas font-medium hover:bg-white",
  ghost: "h-7 px-2.5 border border-line-strong text-fg-secondary hover:bg-hover hover:text-fg",
  danger: "h-7 px-2.5 border border-line-strong text-danger hover:bg-hover",
};

export function Button({
  variant = "ghost",
  icon,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md disabled:cursor-default disabled:opacity-50 [&_svg]:size-[18px] ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
