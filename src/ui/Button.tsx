import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import { cx } from "./cx";

type Variant = "solid" | "saffron" | "quiet" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-sm transition-[background-color,color,border-color,opacity] duration-150 disabled:opacity-45 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  solid: "bg-inverse text-on-inverse hover:opacity-90",
  saffron: "bg-saffron text-on-saffron hover:brightness-105",
  quiet: "bg-sheet text-ink border border-line hover:border-line-strong",
  ghost: "text-ink-2 hover:text-ink hover:bg-sunk",
  danger: "bg-ember text-white hover:opacity-90 dark:text-[#1d0f0b]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "solid", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "solid",
  size = "md",
  icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(base, variants[variant], sizes[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

/** زرّ أيقونة: التسمية إلزامية لقارئ الشاشة وتظهر تلميحاً */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }>(
  function IconButton({ label, size = "md", className, children, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cx(
          "press inline-flex shrink-0 items-center justify-center rounded-sm text-ink-2 transition-colors duration-150 hover:bg-sunk hover:text-ink disabled:opacity-40",
          size === "md" ? "size-10" : "size-8",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
