// الاجتماع كوثيقة هادئة تُقرأ على شاشة القاعة أو تُطبع: العنوان والموعد والحضور،
// ثم الهدف، ثم المحاور واحداً بعد الآخر، ثم المتابعة. تستعملها صفحة العرض (بحقول حيّة)
// وصفحة رابط المشاركة (للقراءة فقط).

import { Check, ExternalLink, Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AgendaItem, Followup, SharedMeeting } from "@/data/types";
import { pick, t } from "@/lib/i18n";
import { KIND_LABEL } from "@/lib/meetings";
import { cx } from "@/ui/cx";
import { longDate, timeRange, titleOf, topicsCount } from "./model";

const two = (n: number) => String(n).padStart(2, "0");

export interface LiveHandlers {
  active: number;
  onActivate: (i: number) => void;
  onToggleCovered: (i: number) => void;
  onAgendaField: (i: number, patch: Partial<Pick<AgendaItem, "decision" | "owner">>) => void;
  onToggleFollowup: (i: number) => void;
  note?: string;
}

export function MeetingDocument({
  meeting,
  agenda = meeting.agenda,
  followups = meeting.followups,
  live,
}: {
  meeting: SharedMeeting;
  agenda?: AgendaItem[];
  followups?: Followup[];
  /** حين تُعطى تصير الوثيقة صفحة عرض بحقول حيّة */
  live?: LiveHandlers;
}) {
  const time = timeRange(meeting);
  const [imgOk, setImgOk] = useState(true);
  const visibleFollowups = followups.filter((f) => f.text.trim());

  return (
    <article className="mt-doc mx-auto w-full max-w-[60rem] px-5 pb-24 pt-10 sm:px-10 sm:pt-14 lg:pt-20">
      {/* ───── الرأس ───── */}
      <header>
        {meeting.image && imgOk && (
          <img src={meeting.image} alt="" onError={() => setImgOk(false)} className="mb-8 h-12 w-auto max-w-[14rem] object-contain object-[inline-start] sm:h-14" />
        )}
        <p className="text-sm font-medium text-ink-2 sm:text-base">{pick(KIND_LABEL[meeting.kind])}</p>
        <h1
          dir="auto"
          className={cx(
            "mt-2 font-display leading-[1.15] font-semibold [overflow-wrap:anywhere]",
            titleOf(meeting).length > 70 ? "text-[clamp(1.6rem,3.2vw,2.6rem)]" : titleOf(meeting).length > 36 ? "text-[clamp(1.85rem,4.2vw,3.4rem)]" : "text-[clamp(2rem,5.2vw,4.25rem)]",
          )}
        >{titleOf(meeting)}</h1>

        <dl className="mt-8 grid gap-x-10 gap-y-5 border-y border-line py-5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
          <Meta label={t("التاريخ", "Date")}>{meeting.day ? longDate(meeting.day) : <span className="text-ink-3">{t("لم يُحدَّد", "Not set")}</span>}</Meta>
          <Meta label={t("الوقت", "Time")}>{time ? <span className="tnum">{time}</span> : <span className="text-ink-3">{t("لم يُحدَّد", "Not set")}</span>}</Meta>
          <Meta label={t("الحضور", "Attendees")}>
            {meeting.attendees.length ? (
              <ul className="flex flex-wrap gap-x-1.5 gap-y-1.5">
                {meeting.attendees.map((p, i) => (
                  <li key={`${p}-${i}`} dir="auto" className="rounded-sm bg-sunk px-2.5 py-0.5 text-sm [overflow-wrap:anywhere]">
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-3">{t("لم يُضف الحضور", "No attendees yet")}</span>
            )}
          </Meta>
        </dl>
      </header>

      {/* ───── الهدف ───── */}
      <section className="mt-12" aria-labelledby="doc-goal">
        <h2 id="doc-goal" className="font-display text-lg font-semibold text-ink-2">
          {t("هدف الاجتماع", "Meeting goal")}
        </h2>
        {meeting.goal.trim() ? (
          <p dir="auto" className="mt-3 whitespace-pre-line text-xl leading-relaxed sm:text-2xl sm:leading-relaxed [overflow-wrap:anywhere]">{meeting.goal}</p>
        ) : (
          <p className="mt-3 text-ink-3">{t("لم يُكتب هدف بعد.", "No goal written yet.")}</p>
        )}
      </section>

      {/* ───── المحاور ───── */}
      <section className="mt-14" aria-labelledby="doc-agenda">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h2 id="doc-agenda" className="font-display text-lg font-semibold text-ink-2">
            {t("محاور النقاش", "Discussion topics")}
          </h2>
          {agenda.length > 0 && <span className="tnum text-sm text-ink-3">{topicsCount(agenda.length)}</span>}
        </div>
        {agenda.length === 0 ? (
          <p className="py-6 text-ink-3">{t("لا محاور بعد.", "No topics yet.")}</p>
        ) : (
          <ol className="divide-y divide-line">
            {agenda.map((a, i) => (
              <Topic key={a.id} item={a} index={i} live={live} />
            ))}
          </ol>
        )}
      </section>

      {/* ───── المتابعة ───── */}
      <section className="mt-14" aria-labelledby="doc-follow">
        <h2 id="doc-follow" className="border-b border-line pb-3 font-display text-lg font-semibold text-ink-2">
          {t("نقاط المتابعة", "Follow-ups")}
        </h2>
        {visibleFollowups.length === 0 ? (
          <p className="py-6 text-ink-3">{t("لا نقاط متابعة.", "No follow-ups.")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {followups.map((f, i) =>
              f.text.trim() ? (
                <li key={f.id}>
                  {live ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={f.done}
                      onClick={() => live.onToggleFollowup(i)}
                      className="press group flex min-h-14 w-full items-start gap-4 py-3.5 text-start"
                    >
                      <CheckBox on={f.done} />
                      <span dir="auto" className={cx("pt-0.5 text-lg [overflow-wrap:anywhere]", f.done && "text-ink-3 line-through decoration-line-strong")}>{f.text}</span>
                    </button>
                  ) : (
                    <div className="flex items-start gap-4 py-3.5">
                      <CheckBox on={f.done} />
                      <span dir="auto" className={cx("pt-0.5 text-lg [overflow-wrap:anywhere]", f.done && "text-ink-3 line-through decoration-line-strong")}>
                        {f.text}
                        {f.done && <span className="sr-only"> {t("(أُنجزت)", "(done)")}</span>}
                      </span>
                    </div>
                  )}
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      {live?.note !== undefined && <Notes note={live.note} />}

      {meeting.link.trim() && (
        <footer className="mt-16 border-t border-line pt-5">
          <a href={meeting.link} target="_blank" rel="noreferrer" className="press inline-flex min-h-11 items-center gap-2 rounded-sm text-dusk underline decoration-dusk/30 underline-offset-4 hover:decoration-dusk">
            <ExternalLink className="size-4" strokeWidth={1.75} />
            {t("المرجع الخارجي", "External reference")}
          </a>
          <span className="hidden text-xs text-ink-3 print:block" dir="ltr">
            {meeting.link}
          </span>
        </footer>
      )}
    </article>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-base sm:text-lg">{children}</dd>
    </div>
  );
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cx("mt-1 grid size-6 shrink-0 place-items-center rounded-[5px] border transition-colors duration-150", on ? "border-palm bg-palm text-bg" : "border-line-strong")}>
      {on && <Check className="size-4" strokeWidth={2.5} />}
    </span>
  );
}

function Topic({ item, index, live }: { item: AgendaItem; index: number; live?: LiveHandlers }) {
  const active = live?.active === index;
  return (
    <li
      id={`topic-${index}`}
      data-active={active}
      data-covered={item.covered}
      onClick={live ? () => live.onActivate(index) : undefined}
      className={cx("mt-topic relative grid scroll-mt-32 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 py-8 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-4 sm:py-10")}
    >
      {live && <span className="mt-topic-mark absolute inset-y-8 -start-3 w-[3px] rounded-full bg-saffron sm:-start-5" aria-hidden />}
      <span className={cx("tnum pt-1 font-display text-xl font-semibold sm:text-2xl", active ? "text-ink" : "text-ink-3")}>{two(index + 1)}</span>
      <div className="mt-topic-body min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <h3 dir="auto" className="min-w-0 flex-1 basis-60 font-display text-xl leading-snug font-semibold sm:text-[1.75rem] [overflow-wrap:anywhere]">{item.title.trim() || t("محور بلا عنوان", "Untitled topic")}</h3>
          {live && (
            <button
              type="button"
              aria-pressed={item.covered}
              onClick={(e) => {
                e.stopPropagation();
                live.onToggleCovered(index);
              }}
              className={cx(
                "press no-print inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150 sm:h-9",
                item.covered ? "border-transparent bg-palm-wash text-palm" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              <Check className={cx("size-4", !item.covered && "opacity-40")} strokeWidth={2} />
              {item.covered ? t("نوقش", "Covered") : t("علّم أنه نوقش", "Mark covered")}
            </button>
          )}
        </div>
        {item.context.trim() && <p dir="auto" className="mt-3 whitespace-pre-line text-lg leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{item.context}</p>}
        {item.goal.trim() && (
          <p className="mt-4 text-lg leading-relaxed [overflow-wrap:anywhere]">
            <span className="text-ink-3">{t("نريد الخروج بـ: ", "We want to leave with: ")}</span>
            <bdi>{item.goal}</bdi>
          </p>
        )}

        {live ? (
          <div className={cx("mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", !item.decision.trim() && !item.owner.trim() && "print:hidden")} onClick={(e) => e.stopPropagation()}>
            <LiveField label={t("القرار", "Decision")} placeholder={t("ما الذي اتُّفق عليه؟", "What was agreed?")} value={item.decision} onChange={(v) => live.onAgendaField(index, { decision: v })} onFocus={() => live.onActivate(index)} multiline />
            <LiveField label={t("المسؤول", "Owner")} placeholder={t("من ينفّذه؟", "Who carries it out?")} value={item.owner} onChange={(v) => live.onAgendaField(index, { owner: v })} onFocus={() => live.onActivate(index)} />
          </div>
        ) : (
          (item.decision.trim() || item.owner.trim()) && (
            <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-md bg-sunk px-4 py-3.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <dt className="text-xs text-ink-3">{t("القرار", "Decision")}</dt>
                <dd dir="auto" className="mt-0.5 text-lg [overflow-wrap:anywhere]">{item.decision.trim() || <span className="text-ink-3">{t("لم يُسجَّل", "Not recorded")}</span>}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-ink-3">{t("المسؤول", "Owner")}</dt>
                <dd dir="auto" className="mt-0.5 text-lg [overflow-wrap:anywhere]">{item.owner.trim() || <span className="text-ink-3">{t("لم يُحدَّد", "Not set")}</span>}</dd>
              </div>
            </dl>
          )
        )}
      </div>
    </li>
  );
}

function LiveField({
  label,
  placeholder,
  value,
  onChange,
  onFocus,
  multiline,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  multiline?: boolean;
}) {
  const cls =
    "mt-1 block w-full resize-none border-0 border-b border-line bg-transparent px-0 py-2 text-lg leading-relaxed text-ink placeholder:text-ink-3 transition-[border-color] duration-150 hover:border-line-strong focus:border-dusk focus:outline-none [field-sizing:content] print:hidden";
  return (
    <label className="block min-w-0">
      <span className="text-xs font-medium text-ink-3">{label}</span>
      {multiline ? (
        <textarea dir="auto" rows={1} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={cls} />
      ) : (
        <input dir="auto" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={cls} />
      )}
      <span dir="auto" className="hidden whitespace-pre-line py-1 text-lg print:block">{value.trim() || "—"}</span>
    </label>
  );
}

function Notes({ note }: { note: string }) {
  const [open, setOpen] = useState(false);
  if (!note.trim()) return null;
  return (
    <section className={cx("mt-14", !open && "print:hidden")} aria-labelledby="doc-note">
      <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
        <h2 id="doc-note" className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink-2">
          <Lock className="size-4" strokeWidth={1.75} />
          {t("ملاحظاتك التحضيرية", "Your prep notes")}
        </h2>
        <button type="button" aria-expanded={open} aria-controls="doc-note-body" onClick={() => setOpen((o) => !o)} className="press no-print h-11 rounded-sm px-3 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink sm:h-9">
          {open ? t("أخفِها", "Hide") : t("أظهرها", "Show")}
        </button>
      </div>
      {open ? (
        <p id="doc-note-body" dir="auto" className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
          {note}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-3">{t("مخفية لأن الشاشة قد يراها الحضور.", "Hidden because the room can see this screen.")}</p>
      )}
    </section>
  );
}
