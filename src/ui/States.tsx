// حالات الصفحة: الفراغ دعوة للفعل، والخطأ يقول ما حدث وكيف يُصلَح.

import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./Button";
import { cx } from "./cx";

export function Empty({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-start gap-2 py-8", className)}>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="max-w-prose text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Failure({ title, body, onRetry, className }: { title: string; body?: ReactNode; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx("flex flex-col items-start gap-2 rounded-md border border-ember/30 bg-ember-wash p-4", className)}>
      <p className="font-medium text-ember">{title}</p>
      {body && <p className="text-sm text-ink-2">{body}</p>}
      {onRetry && (
        <Button variant="quiet" size="sm" onClick={onRetry} className="mt-1">
          {t("أعد المحاولة", "Try again")}
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function Loading({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{label ?? t("جارٍ التحميل…", "Loading…")}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
