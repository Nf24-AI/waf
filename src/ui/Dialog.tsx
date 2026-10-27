// نافذة حوار: في وسط الشاشة على الحاسب، ولوح يصعد من الأسفل على الجوّال.

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { IconButton } from "./Button";
import { cx } from "./cx";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="waf-overlay fixed inset-0 z-50 bg-[rgb(8_12_22/0.45)] backdrop-blur-[2px]" />
        <RD.Content
          className={cx(
            "waf-dialog fixed z-50 flex max-h-[92dvh] flex-col bg-sheet text-ink shadow-[var(--shadow-float)] focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] border-t border-line pb-[env(safe-area-inset-bottom)]",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:rounded-[var(--radius-lg)] sm:border sm:pb-0",
            size === "sm" && "sm:max-w-sm",
            size === "md" && "sm:max-w-lg",
            size === "lg" && "sm:max-w-2xl",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <header className="flex items-start gap-3 px-5 pt-4 sm:pt-5">
            <div className="min-w-0 flex-1">
              <RD.Title className="text-lg font-semibold">{title}</RD.Title>
              {description ? <RD.Description className="mt-1 text-sm text-ink-2">{description}</RD.Description> : <RD.Description className="sr-only">{typeof title === "string" ? title : ""}</RD.Description>}
            </div>
            <RD.Close asChild>
              <IconButton label={t("إغلاق", "Close")} size="sm" className="-me-1.5 -mt-1">
                <X className="size-4" />
              </IconButton>
            </RD.Close>
          </header>
          {children && <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** تأكيد قبل فعل لا رجعة فيه */
export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={title}
      description={body}
      footer={
        <>
          <RD.Close asChild>
            <button type="button" className="press h-10 rounded-sm px-4 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink">
              {t("إلغاء", "Cancel")}
            </button>
          </RD.Close>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={cx("press h-10 rounded-sm px-4 text-sm font-medium", danger ? "bg-ember text-white dark:text-[#1d0f0b]" : "bg-inverse text-on-inverse")}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
