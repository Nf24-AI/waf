// سجلّ القرارات: كل قرار كُتب في بند من بنود الاجتماعات، ومن يملكه ومتى.
// يُقرأ من الاجتماعات نفسها، للقراءة فقط. دفتر هادئ: صفوف وخطوط، لا بطاقات.

import { Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PageHead } from "@/app/AppShell";
import { useMeetings } from "@/data/hooks";
import { formatDay, pick, t, useLang } from "@/lib/i18n";
import { decisionsOf, KIND_LABEL, type DecisionEntry } from "@/lib/meetings";
import { ButtonLink } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { control, Select } from "@/ui/Field";
import { Empty, Failure, Loading } from "@/ui/States";

const ALL = "__all__";
const NONE = "__none__";

const norm = (s: string) => s.toLocaleLowerCase().normalize("NFKD").replace(/[ً-ْـ]/g, "");

export default function Decisions() {
  const lang = useLang();
  const q = useMeetings();
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState(ALL);

  const all = useMemo(() => decisionsOf(q.data ?? []), [q.data]);
  const owners = useMemo(() => [...new Set(all.map((d) => d.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang === "ar" ? "ar" : "en")), [all, lang]);
  const unowned = all.filter((d) => !d.owner).length;

  const needle = norm(query.trim());
  const shown = all.filter((d) => {
    if (owner === NONE ? d.owner : owner !== ALL && d.owner !== owner) return false;
    if (!needle) return true;
    return norm([d.decision, d.topic, d.context, d.meetingTitle, d.owner].join(" ")).includes(needle);
  });
  const filtering = !!needle || owner !== ALL;

  return (
    <div>
      <PageHead
        back={{ href: "/meetings", label: t("الاجتماعات", "Meetings") }}
        title={t("سجلّ القرارات", "Decision log")}
        lede={t(
          "كل قرار اتُّخذ في اجتماع، ومن يملكه ومتى. يُقرأ من الاجتماعات نفسها، فما تكتبه هناك يظهر هنا دون خطوة إضافية.",
          "Every decision made in a meeting, who owns it and when. It reads from the meetings themselves, so what you write there shows up here with no extra step.",
        )}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure
          title={t("تعذّر قراءة الاجتماعات.", "Couldn’t read your meetings.")}
          body={t("السجلّ يُقرأ من الاجتماعات. تحقّق من الاتصال، ثم أعد المحاولة.", "The log reads from your meetings. Check your connection, then try again.")}
          onRetry={() => q.refetch()}
        />
      ) : all.length === 0 ? (
        <Empty
          title={t("لا قرارات بعد", "No decisions yet")}
          body={t("القرار يُكتب في بند جدول الأعمال أثناء الاجتماع. أول قرار تكتبه هناك يظهر هنا.", "A decision is written on an agenda item during the meeting. The first one you write there appears here.")}
          action={
            <ButtonLink href="/meetings" variant="quiet">
              {t("افتح الاجتماعات", "Open meetings")}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("ابحث في القرارات…", "Search decisions…")}
                aria-label={t("ابحث في القرارات", "Search decisions")}
                enterKeyHint="search"
                className={cx(control, "h-11 ps-9 pe-10 sm:h-10 [&::-webkit-search-cancel-button]:hidden")}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("امسح البحث", "Clear search")}
                  className="press absolute inset-y-0 end-0 inline-flex w-10 items-center justify-center rounded-sm text-ink-3 hover:text-ink"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            <Select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label={t("المالك", "Owner")} className="h-11 sm:h-10 sm:w-56">
              <option value={ALL}>{t("كل المالكين", "All owners")}</option>
              {unowned > 0 && <option value={NONE}>{t("بلا مالك", "No owner")}</option>}
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <p className="tnum mt-4 text-sm text-ink-2" aria-live="polite">
            {t(`${shown.length} من ${all.length}`, `${shown.length} of ${all.length}`)}
            {!filtering && unowned > 0 && (
              <>
                <span className="mx-2 text-ink-3" aria-hidden>
                  /
                </span>
                <button type="button" onClick={() => setOwner(NONE)} className="text-ember underline decoration-ember/30 underline-offset-4 hover:decoration-ember">
                  {t(`${unowned} بلا مالك`, `${unowned} without an owner`)}
                </button>
              </>
            )}
          </p>

          {shown.length === 0 ? (
            <Empty
              title={t("لا قرارات مطابقة", "No matching decisions")}
              body={t("جرّب كلمة أخرى، أو أزل التصفية.", "Try another word, or clear the filter.")}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setOwner(ALL);
                  }}
                  className="press h-10 rounded-sm border border-line bg-sheet px-4 text-sm font-medium hover:border-line-strong"
                >
                  {t("أزل التصفية", "Clear filters")}
                </button>
              }
            />
          ) : (
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {shown.map((d) => (
                <Entry key={d.id} d={d} />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function attending(n: number): string {
  if (n === 1) return t("حاضر واحد", "1 attending");
  if (n === 2) return t("حاضران", "2 attending");
  return t(`${n} ${n <= 10 ? "حاضرين" : "حاضراً"}`, `${n} attending`);
}

function Entry({ d }: { d: DecisionEntry }) {
  const title = d.meetingTitle.trim() || t("اجتماع بلا عنوان", "Untitled meeting");
  return (
    <li className="grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <div className="tnum text-sm text-ink-3">{d.day ? <time dateTime={d.day}>{formatDay(d.day, { day: "numeric", month: "short", year: "numeric" })}</time> : t("بلا تاريخ", "No date")}</div>
      <div className="min-w-0">
        <p className="break-words text-lg font-medium leading-snug">{d.decision}</p>
        {d.topic.trim() && <p className="mt-1 break-words text-sm text-ink-2">{d.topic}</p>}
        {d.context.trim() && <p className="mt-2 line-clamp-3 max-w-prose break-words text-sm text-ink-3">{d.context}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {d.owner ? (
            <span className="inline-flex max-w-full items-center rounded-full bg-dusk-wash px-2.5 py-1 font-medium text-dusk">
              <span className="truncate">{d.owner}</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-ember-wash px-2.5 py-1 font-medium text-ember">{t("بلا مالك", "No owner")}</span>
          )}
          {d.attendees.length > 0 && (
            <span className="tnum inline-flex items-center gap-1.5 text-ink-3" title={d.attendees.join("، ")}>
              <Users className="size-3.5" strokeWidth={1.75} aria-hidden />
              {attending(d.attendees.length)}
              <span className="sr-only">{`: ${d.attendees.join("، ")}`}</span>
            </span>
          )}
          <Link href={`/meetings/${d.meetingId}`} className="inline-flex min-h-11 max-w-full items-center gap-1.5 text-ink-2 hover:text-dusk sm:min-h-0">
            <span className="truncate underline decoration-line-strong underline-offset-4">{title}</span>
            <span className="shrink-0 text-ink-3">({pick(KIND_LABEL[d.kind])})</span>
          </Link>
        </div>
      </div>
    </li>
  );
}
