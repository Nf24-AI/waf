// رابط القراءة فقط: صفحة اجتماع واحد لمن لا حساب له. بلا ملاحظات ولا حقول ولا مؤقّت.

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useSharedMeeting } from "@/data/hooks";
import { ApiError } from "@/data/types";
import { t } from "@/lib/i18n";
import { IconButton } from "@/ui/Button";
import { LangToggle, ThemeToggle, Wordmark } from "@/ui/Chrome";
import { Failure, Loading } from "@/ui/States";
import { MeetingDocument } from "./MeetingDocument";
import { printTitle } from "./model";
import "./meetings.css";

export default function SharedMeeting({ token }: { token: string }) {
  const { data, isLoading, error, refetch } = useSharedMeeting(token);

  useEffect(() => {
    if (!data) return;
    const base = document.title;
    document.title = printTitle(data);
    return () => {
      document.title = base;
    };
  }, [data]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[60rem] items-center gap-2 px-3 sm:px-8">
          <Wordmark href="/" />
          <span className="ms-2 hidden border-s border-line ps-3 text-sm text-ink-3 sm:inline">{t("اجتماع مُشارَك للقراءة فقط", "Shared meeting, read only")}</span>
          <div className="ms-auto flex items-center gap-1">
            {data && (
              <IconButton
                label={t("تنزيل PDF", "Download PDF")}
                className="max-sm:size-11"
                onClick={() => {
                  toast(t("اختر «حفظ كملف PDF» في وجهة الطباعة.", "Choose “Save as PDF” as the destination."));
                  window.print();
                }}
              >
                <Printer className="size-[18px]" strokeWidth={1.75} />
              </IconButton>
            )}
            <LangToggle short className="max-sm:h-11 max-sm:px-3" />
            <ThemeToggle className="max-sm:size-11" />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {isLoading ? (
          <div className="mx-auto max-w-[60rem] px-5 py-16 sm:px-10">
            <Loading />
          </div>
        ) : error ? (
          <LinkProblem error={error} onRetry={() => refetch()} />
        ) : data ? (
          <MeetingDocument meeting={data} />
        ) : null}
      </main>

      <footer className="no-print border-t border-line">
        <div className="mx-auto flex max-w-[60rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-6 text-sm text-ink-3 sm:px-10">
          <p>{t("صفحة للقراءة فقط. صاحب الاجتماع وحده يعدّلها، ولا تظهر هنا ملاحظاته الخاصة.", "Read only. Only the meeting’s owner can edit it, and their private notes don’t appear here.")}</p>
          <a href="/" className="press rounded-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            {t("ما واف؟", "What is Waf?")}
          </a>
        </div>
      </footer>
    </div>
  );
}

function LinkProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const code = error instanceof ApiError ? error.code : "network";
  if (code === "network")
    return (
      <div className="mx-auto max-w-[60rem] px-5 py-16 sm:px-10">
        <Failure title={t("تعذّر فتح الاجتماع", "Couldn’t open the meeting")} body={t("تحقّق من الاتصال ثم أعد المحاولة.", "Check your connection, then try again.")} onRetry={onRetry} />
      </div>
    );
  const expired = code === "expired";
  return (
    <div className="mx-auto max-w-[60rem] px-5 py-20 sm:px-10 sm:py-28" role="alert">
      <div className="h-px w-24 bg-line-strong" aria-hidden />
      <h1 className="mt-8 font-display text-3xl font-semibold sm:text-4xl">{expired ? t("انتهت صلاحية الرابط", "This link has expired") : t("رابط غير صالح", "This link isn’t valid")}</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-2">
        {expired
          ? t("هذا الرابط كان لاجتماع مضى. اطلب من صاحب الاجتماع رابطاً جديداً.", "This link was for a meeting that has passed. Ask the meeting’s owner for a new one.")
          : t("تأكد من نسخ الرابط كاملاً، أو اطلب رابطاً جديداً.", "Make sure you copied the whole link, or ask for a new one.")}
      </p>
    </div>
  );
}
