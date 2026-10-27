// رابط القراءة فقط: صفحة هذا الاجتماع وحده، بلا حساب، ويتوقف من تلقاء نفسه بعد يوم الاجتماع.

import * as RP from "@radix-ui/react-popover";
import { Check, Copy, Link2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMeetingActions } from "@/data/hooks";
import type { Meeting } from "@/data/types";
import { formatDay, t } from "@/lib/i18n";
import { shareExpired, shareLastDay } from "@/lib/meetings";
import { Button, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";

export function SharePopover({ meeting, draftDay, ensureSaved }: { meeting: Meeting; draftDay: string | null; ensureSaved: () => Promise<void> }) {
  const actions = useMeetingActions();
  const [copied, setCopied] = useState(false);
  const token = meeting.shareToken;
  const url = token ? `${window.location.origin}/s/${token}` : "";
  const last = shareLastDay(draftDay);
  const expired = token ? shareExpired(draftDay) : false;
  const busy = actions.share.isPending || actions.unshare.isPending;

  const create = async () => {
    await ensureSaved();
    actions.share.mutate(meeting.id, { onSuccess: () => toast(t("أُنشئ الرابط. انسخه وشاركه.", "Link created. Copy it and share it.")) });
  };
  const stop = () => actions.unshare.mutate(meeting.id, { onSuccess: () => toast(t("أُوقفت المشاركة. الرابط لم يعد يعمل.", "Sharing stopped. The link no longer works.")) });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("تعذّر النسخ. حدّد الرابط وانسخه يدوياً.", "Couldn’t copy. Select the link and copy it yourself."));
    }
  };

  return (
    <RP.Root>
      <RP.Trigger asChild>
        <button
          type="button"
          className={cx(
            "press inline-flex h-10 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors max-sm:h-11",
            token && !expired ? "text-dusk hover:bg-dusk-wash" : "text-ink-2 hover:bg-sunk hover:text-ink",
          )}
        >
          <Link2 className="size-[18px]" strokeWidth={1.75} />
          <span className="max-sm:sr-only">{token ? t("مُشارَك", "Shared") : t("شارك", "Share")}</span>
        </button>
      </RP.Trigger>
      <RP.Portal>
        <RP.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="mt-pop z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-md border border-line bg-sheet p-4 text-sm shadow-[var(--shadow-float)] focus:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-base font-semibold">{t("رابط للقراءة فقط", "Read-only link")}</p>
            <RP.Close asChild>
              <IconButton label={t("إغلاق", "Close")} size="sm" className="-me-1.5 -mt-1">
                <X className="size-4" />
              </IconButton>
            </RP.Close>
          </div>
          <p className="mt-1 text-ink-2">
            {t(
              "يفتح صفحة هذا الاجتماع وحده، بلا حساب ولا وصول إلى بقية اجتماعاتك. من يفتحه يقرأ ولا يعدّل، ولا تظهر له ملاحظاتك التحضيرية.",
              "Opens this meeting’s page alone, with no account and no access to your other meetings. Whoever opens it can read but not edit, and your prep notes stay hidden.",
            )}
          </p>

          {!draftDay ? (
            <p className="mt-4 rounded-sm bg-sunk px-3 py-2.5 text-ink-2">{t("أضف تاريخ الاجتماع أولاً، فصلاحية الرابط تُحسب منه.", "Add the meeting date first: the link’s expiry is counted from it.")}</p>
          ) : token ? (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  dir="ltr"
                  aria-label={t("رابط المشاركة", "Share link")}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-sunk px-3 text-xs text-ink-2 focus:border-dusk focus:outline-none max-sm:h-11"
                />
                <Button variant="solid" onClick={copy} className="max-sm:h-11" icon={copied ? <Check className="size-4" strokeWidth={2.25} /> : <Copy className="size-4" strokeWidth={1.75} />}>
                  {copied ? t("نُسخ", "Copied") : t("انسخ", "Copy")}
                </Button>
              </div>
              {expired ? (
                <p className="mt-3 text-ember">{t("انتهت صلاحية هذا الرابط لأن الاجتماع مضى. من يفتحه يرى أنه انتهى.", "This link has expired because the meeting has passed. Anyone opening it is told so.")}</p>
              ) : (
                last && <p className="mt-3 text-ink-3">{t(`يعمل حتى نهاية ${formatDay(last)}، ثم يتوقف من تلقاء نفسه.`, `Works until the end of ${formatDay(last)}, then stops by itself.`)}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <a href={url} target="_blank" rel="noreferrer" className="press inline-flex h-10 items-center rounded-sm px-1 text-dusk underline decoration-dusk/30 underline-offset-4 hover:decoration-dusk max-sm:h-11">
                  {t("افتح الرابط", "Open the link")}
                </a>
                <button type="button" onClick={stop} disabled={busy} className="press h-8 rounded-sm px-3 text-xs font-medium text-ember hover:bg-ember-wash disabled:opacity-45 max-sm:h-11">
                  {t("أوقف المشاركة", "Stop sharing")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {last && <p className="text-ink-3">{t(`يعمل حتى نهاية ${formatDay(last)}.`, `Works until the end of ${formatDay(last)}.`)}</p>}
              <Button variant="solid" onClick={create} disabled={busy} className="ms-auto max-sm:h-11">
                {t("أنشئ الرابط", "Create the link")}
              </Button>
            </div>
          )}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
