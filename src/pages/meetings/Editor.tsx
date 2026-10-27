// محرّر الاجتماع: الحقول كلها في صفحة واحدة تُحفظ تلقائياً بعد توقّفك عن الكتابة،
// وبجانبها خطوات التحضير الخمس تقول لك ما الخطوة التالية.

import * as DM from "@radix-ui/react-dropdown-menu";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, ListPlus, Lock, MoreHorizontal, Plus, Presentation, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { tempId, useMeetingActions, useTaskActions } from "@/data/hooks";
import type { AgendaItem, Followup, Meeting, MeetingStatus } from "@/data/types";
import { pick, t } from "@/lib/i18n";
import { KIND_LABEL, splitAttendees } from "@/lib/meetings";
import { Button, ButtonLink, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Confirm } from "@/ui/Dialog";
import { Field, Input, Segmented, Select, TextArea, control } from "@/ui/Field";
import { KINDS, STATUS_TONE, followupsCount, statusLabel, titleOf, topicsCount } from "./model";
import { PrepRail } from "./PrepRail";
import { SharePopover } from "./SharePopover";

type SaveState = "saved" | "pending" | "saving" | "error";

/** معرّف اجتماع أُنشئ للتوّ: يُركَّز عنوانه عند فتحه */
let justCreated: string | null = null;
export function markJustCreated(id: string) {
  justCreated = id;
}

const layoutSpring = { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const };

export function Editor({ meeting }: { meeting: Meeting }) {
  const actions = useMeetingActions();
  const tasks = useTaskActions("waf");
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<Meeting>(meeting);
  const [save, setSave] = useState<SaveState>("saved");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [autoTitle] = useState(() => {
    const yes = justCreated === meeting.id;
    if (yes) justCreated = null;
    return yes;
  });

  // ───────── الحفظ التلقائي ─────────
  const latest = useRef(draft);
  const dirty = useRef(false);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dead = useRef(false);

  const run = (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (dead.current) return Promise.resolve();
    if (inflight.current) return inflight.current.then(() => (dirty.current ? run() : undefined));
    if (!dirty.current) return Promise.resolve();
    dirty.current = false;
    const sentDraft = latest.current;
    setSave("saving");
    const p = actions.save
      .mutateAsync(sentDraft)
      .then((server) => {
        // البنود الجديدة أخذت معرّفاتها من الخادم: نطابقها بالترتيب حتى لا تُنشأ مرة أخرى
        const remap = <T extends { id: string }>(local: T[], sentItems: T[], saved: { id: string }[]) => {
          const map = new Map<string, string>();
          sentItems.forEach((x, i) => x.id.startsWith("tmp-") && saved[i] && map.set(x.id, saved[i].id));
          return map.size ? local.map((x) => (map.has(x.id) ? { ...x, id: map.get(x.id)! } : x)) : local;
        };
        const cur = latest.current;
        const next = { ...cur, agenda: remap(cur.agenda, sentDraft.agenda, server.agenda), followups: remap(cur.followups, sentDraft.followups, server.followups) };
        if (next.agenda !== cur.agenda || next.followups !== cur.followups) {
          latest.current = next;
          setDraft(next);
        }
        inflight.current = null;
        if (dirty.current) return run();
        setSave("saved");
      })
      .catch(() => {
        inflight.current = null;
        dirty.current = true;
        setSave("error");
      });
    inflight.current = p;
    return p;
  };

  const edit = (fn: (m: Meeting) => Meeting) => {
    const next = fn(latest.current);
    latest.current = next;
    setDraft(next);
    dirty.current = true;
    setSave((s) => (s === "saving" ? s : "pending"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, 800);
  };
  const set = <K extends keyof Meeting>(key: K, value: Meeting[K]) => edit((m) => ({ ...m, [key]: value }));

  // عند مغادرة الاجتماع داخل التطبيق: احفظ ما لم يُحفظ بعد
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && !dead.current) {
        dirty.current = false;
        actions.save.mutate(latest.current, { onError: () => toast.error(t("لم يُحفظ آخر تعديل على الاجتماع.", "Your last change to the meeting wasn’t saved.")) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // ───────── البنود والمتابعات ─────────
  const move = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };
  const setAgenda = (fn: (a: AgendaItem[]) => AgendaItem[]) => edit((m) => ({ ...m, agenda: fn(m.agenda) }));
  const setFollowups = (fn: (f: Followup[]) => Followup[]) => edit((m) => ({ ...m, followups: fn(m.followups) }));
  const addTopic = () => {
    const id = tempId();
    setAgenda((a) => [...a, { id, title: "", context: "", goal: "", decision: "", owner: "", covered: false }]);
    setFocusId(id);
  };
  const addFollowup = () => {
    const id = tempId();
    setFollowups((f) => [...f, { id, text: "", done: false }]);
    setFocusId(id);
  };

  const sendToTasks = (f: Followup) => {
    const title = f.text.trim();
    if (!title) return;
    tasks.create.mutate(
      { title, sourceMeetingId: meeting.id },
      {
        onSuccess: () => {
          setSent((s) => new Set(s).add(f.id));
          toast(t("أُرسلت إلى مهامك", "Sent to your tasks"), {
            description: t("تجدها في مصفوفة نظام واف لتصنّفها.", "It’s in the Waf system matrix, ready to sort."),
            action: { label: t("افتح المصفوفة", "Open the matrix"), onClick: () => navigate("/waf/matrix") },
          });
        },
      },
    );
  };

  const duplicate = () => {
    const d = latest.current;
    actions.create.mutate(
      {
        title: t(`${titleOf(d)} (نسخة)`, `${titleOf(d)} (copy)`),
        kind: d.kind,
        attendees: d.attendees,
        goal: d.goal,
        link: d.link,
        image: d.image,
        agenda: d.agenda.map(({ id: _i, ...a }) => ({ ...a, decision: "", owner: "", covered: false })),
        followups: d.followups.map(({ id: _i, ...f }) => ({ ...f, done: false })),
      },
      {
        onSuccess: (m) => {
          markJustCreated(m.id);
          toast(t("أُنشئت نسخة من الاجتماع", "Meeting copied"));
          navigate(`/meetings/${m.id}`);
        },
      },
    );
  };

  const archive = () => {
    dead.current = true;
    if (timer.current) clearTimeout(timer.current);
    actions.remove.mutate(meeting.id, {
      onSuccess: () => {
        toast(t("أُرشف الاجتماع", "Meeting archived"));
        navigate("/meetings");
      },
      onError: () => {
        dead.current = false;
      },
    });
  };

  const endBeforeStart = draft.startTime && draft.endTime && draft.endTime <= draft.startTime;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16.5rem] xl:gap-8">
      <PrepRail meeting={draft} className="xl:order-2" />

      <div className="sheet min-w-0 xl:order-1">
        {/* ───── شريط المحرّر ───── */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 border-b border-line px-4 py-3 sm:px-6">
          <Segmented<MeetingStatus>
            label={t("حالة الاجتماع", "Meeting status")}
            size="sm"
            value={draft.status}
            onChange={(v) => set("status", v)}
            className="max-sm:w-full [&>button]:whitespace-nowrap max-sm:[&>button]:h-10 max-sm:[&>button]:flex-1 max-sm:[&>button]:px-1.5"
            options={(["draft", "ready", "done"] as const).map((s) => ({
              value: s,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cx("size-1.5 rounded-full", STATUS_TONE[s].dot)} aria-hidden />
                  {statusLabel(s)}
                </span>
              ),
            }))}
          />
          <SaveBadge state={save} onRetry={() => void run()} />
          <div className="ms-auto flex items-center gap-1">
            <SharePopover meeting={meeting} draftDay={draft.day} ensureSaved={run} />
            <DM.Root dir={document.documentElement.dir as "rtl" | "ltr"}>
              <DM.Trigger asChild>
                <IconButton label={t("المزيد", "More")} className="max-sm:size-11">
                  <MoreHorizontal className="size-[18px]" strokeWidth={1.75} />
                </IconButton>
              </DM.Trigger>
              <DM.Portal>
                <DM.Content align="end" sideOffset={6} className="mt-pop z-50 min-w-52 rounded-md border border-line bg-sheet p-1.5 text-sm shadow-[var(--shadow-float)]">
                  <MenuItem onSelect={duplicate} icon={<Copy className="size-4" strokeWidth={1.75} />}>
                    {t("كرّر الاجتماع", "Duplicate meeting")}
                  </MenuItem>
                  <DM.Separator className="my-1 h-px bg-line" />
                  <MenuItem onSelect={() => setConfirmArchive(true)} icon={<Trash2 className="size-4" strokeWidth={1.75} />} danger>
                    {t("أرشف الاجتماع", "Archive meeting")}
                  </MenuItem>
                </DM.Content>
              </DM.Portal>
            </DM.Root>
            <ButtonLink href={`/meetings/${meeting.id}/present`} variant="saffron" className="ms-1 max-sm:h-11" icon={<Presentation className="size-[18px]" strokeWidth={1.75} />}>
              {t("اعرض", "Present")}
            </ButtonLink>
          </div>
        </div>

        <div className="px-4 pb-8 pt-6 sm:px-8">
          {/* ───── الأساسيات ───── */}
          <section id="sec-basics" className="scroll-mt-24" aria-label={t("الأساسيات", "Basics")}>
            <textarea
              rows={1}
              dir="auto"
              value={draft.title}
              autoFocus={autoTitle}
              onFocus={autoTitle ? (e) => e.currentTarget.select() : undefined}
              onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder={t("اسم الاجتماع", "Meeting name")}
              aria-label={t("اسم الاجتماع", "Meeting name")}
              maxLength={200}
              className="mt-bare resize-none font-display text-2xl leading-snug font-semibold [field-sizing:content] sm:text-[2rem] [overflow-wrap:anywhere]"
            />
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
              <Field label={t("التاريخ", "Date")} className="col-span-2 sm:col-span-1">
                {(p) => <Input {...p} type="date" value={draft.day ?? ""} onChange={(e) => set("day", e.target.value || null)} className="tnum max-sm:h-11" />}
              </Field>
              <Field label={t("يبدأ", "Starts")}>
                {(p) => <Input {...p} type="time" value={draft.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} className="tnum max-sm:h-11" />}
              </Field>
              <Field label={t("ينتهي", "Ends")} error={endBeforeStart ? t("قبل البداية", "Before the start") : null}>
                {(p) => <Input {...p} type="time" value={draft.endTime ?? ""} onChange={(e) => set("endTime", e.target.value || null)} className="tnum max-sm:h-11" />}
              </Field>
              <Field label={t("النوع", "Kind")} className="col-span-2 sm:col-span-1">
                {(p) => (
                  <Select {...p} value={draft.kind} onChange={(e) => set("kind", e.target.value as Meeting["kind"])} className="max-sm:h-11">
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {pick(KIND_LABEL[k])}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div id="sec-people" className="mt-4 scroll-mt-24">
              <Attendees value={draft.attendees} onChange={(v) => set("attendees", v)} />
            </div>
          </section>

          {/* ───── الهدف ───── */}
          <Section id="sec-goal" title={t("هدف الاجتماع", "Meeting goal")} hint={t("النتيجة التي يجب الخروج بها، في جملة واحدة.", "The outcome you must leave with, in one sentence.")}>
            <TextArea
              dir="auto"
              value={draft.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder={t("ما الذي نحتاج أن نخرج به من هذا الاجتماع؟", "What do we need to leave this meeting with?")}
              aria-label={t("هدف الاجتماع", "Meeting goal")}
              rows={2}
              className="text-base sm:text-lg"
            />
          </Section>

          {/* ───── المحاور ───── */}
          <Section
            id="sec-agenda"
            title={t("محاور النقاش", "Discussion topics")}
            hint={t("رتّبها بحسب تسلسل المحادثة.", "Order them the way the conversation will go.")}
            aside={draft.agenda.length > 0 && <span className="tnum text-sm text-ink-3">{topicsCount(draft.agenda.length)}</span>}
          >
            {draft.agenda.length === 0 ? (
              <p className="py-2 text-sm text-ink-2">{t("لا محاور بعد. أضف أول ما ستتحدثون عنه.", "No topics yet. Add the first thing you’ll talk about.")}</p>
            ) : (
              <ol className="divide-y divide-line border-y border-line">
                {draft.agenda.map((a, i) => (
                  <motion.li key={a.id} layout="position" transition={layoutSpring} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-2 py-5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:gap-x-3">
                    <span className="tnum pt-2 font-display text-lg font-semibold text-ink-3" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 space-y-3">
                      <Input
                        dir="auto"
                        value={a.title}
                        autoFocus={focusId === a.id}
                        onChange={(e) => setAgenda((l) => l.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))}
                        placeholder={t("عمّ نتحدث؟", "What are we discussing?")}
                        aria-label={t(`عنوان المحور ${i + 1}`, `Topic ${i + 1} title`)}
                        className="font-medium max-sm:h-11"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Labeled label={t("السياق أو الخلفية", "Context")}>
                          {(id) => (
                            <TextArea
                              dir="auto"
                              id={id}
                              rows={2}
                              value={a.context}
                              onChange={(e) => setAgenda((l) => l.map((x) => (x.id === a.id ? { ...x, context: e.target.value } : x)))}
                              placeholder={t("لماذا نتحدث فيه الآن؟", "Why does it come up now?")}
                              className="min-h-[3rem] text-sm"
                            />
                          )}
                        </Labeled>
                        <Labeled label={t("نريد الخروج بـ", "We want to leave with")}>
                          {(id) => (
                            <TextArea
                              dir="auto"
                              id={id}
                              rows={2}
                              value={a.goal}
                              onChange={(e) => setAgenda((l) => l.map((x) => (x.id === a.id ? { ...x, goal: e.target.value } : x)))}
                              placeholder={t("قرار، أو رقم، أو مالك…", "A decision, a number, an owner…")}
                              className="min-h-[3rem] text-sm"
                            />
                          )}
                        </Labeled>
                      </div>
                      {(draft.status === "done" || a.decision.trim() || a.owner.trim()) && (
                        <div className="grid gap-3 rounded-md bg-sunk p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                          <Labeled label={t("القرار", "Decision")}>
                            {(id) => (
                              <Input id={id} dir="auto" value={a.decision} onChange={(e) => setAgenda((l) => l.map((x) => (x.id === a.id ? { ...x, decision: e.target.value } : x)))} placeholder={t("ما الذي اتُّفق عليه؟", "What was agreed?")} className="max-sm:h-11" />
                            )}
                          </Labeled>
                          <Labeled label={t("المسؤول", "Owner")}>
                            {(id) => <Input id={id} dir="auto" value={a.owner} onChange={(e) => setAgenda((l) => l.map((x) => (x.id === a.id ? { ...x, owner: e.target.value } : x)))} placeholder={t("من ينفّذه؟", "Who carries it out?")} className="max-sm:h-11" />}
                          </Labeled>
                        </div>
                      )}
                    </div>
                    <RowActions
                      name={a.title || t(`المحور ${i + 1}`, `topic ${i + 1}`)}
                      first={i === 0}
                      last={i === draft.agenda.length - 1}
                      onUp={() => setAgenda((l) => move(l, i, -1))}
                      onDown={() => setAgenda((l) => move(l, i, 1))}
                      onDelete={() => setAgenda((l) => l.filter((x) => x.id !== a.id))}
                      deleteLabel={t("احذف المحور", "Delete topic")}
                      vertical
                    />
                  </motion.li>
                ))}
              </ol>
            )}
            <Button variant="quiet" size="sm" className="mt-4 max-sm:h-11 max-sm:w-full" icon={<Plus className="size-4" />} onClick={addTopic}>
              {t("أضف محوراً", "Add a topic")}
            </Button>
          </Section>

          {/* ───── المتابعة ───── */}
          <Section
            id="sec-followups"
            title={t("نقاط المتابعة", "Follow-ups")}
            hint={t("ما يجب أن تخرج به مكتوباً. أرسل أيّها إلى مهامك حين يصير عملاً.", "What you must leave with in writing. Send any of them to your tasks once it becomes work.")}
            aside={draft.followups.length > 0 && <span className="tnum text-sm text-ink-3">{followupsCount(draft.followups.length)}</span>}
          >
            {draft.followups.length > 0 && (
              <ul className="divide-y divide-line border-y border-line">
                {draft.followups.map((f, i) => (
                  <motion.li key={f.id} layout="position" transition={layoutSpring} className="flex items-center gap-1.5 py-2 sm:gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={f.done}
                      aria-label={t(`أُنجزت: ${f.text || "نقطة بلا نص"}`, `Done: ${f.text || "empty follow-up"}`)}
                      onClick={() => setFollowups((l) => l.map((x) => (x.id === f.id ? { ...x, done: !x.done } : x)))}
                      className="press grid size-11 shrink-0 place-items-center rounded-sm hover:bg-sunk sm:size-9"
                    >
                      <span className={cx("grid size-5 place-items-center rounded-[5px] border transition-colors duration-150", f.done ? "border-palm bg-palm text-bg" : "border-line-strong")}>
                        {f.done && <Check className="size-3.5" strokeWidth={2.75} />}
                      </span>
                    </button>
                    <input
                      dir="auto"
                      value={f.text}
                      autoFocus={focusId === f.id}
                      onChange={(e) => setFollowups((l) => l.map((x) => (x.id === f.id ? { ...x, text: e.target.value } : x)))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          if (i === draft.followups.length - 1) addFollowup();
                        }
                      }}
                      placeholder={t("نقطة متابعة", "Follow-up")}
                      aria-label={t(`نقطة المتابعة ${i + 1}`, `Follow-up ${i + 1}`)}
                      className={cx(
                        "h-11 min-w-0 flex-1 rounded-sm bg-transparent px-2 transition-colors placeholder:text-ink-3 hover:bg-sunk/60 focus:bg-sheet focus:outline-none focus:ring-2 focus:ring-dusk/25 sm:h-9",
                        f.done && "text-ink-3 line-through decoration-line-strong",
                      )}
                    />
                    <IconButton
                      label={sent.has(f.id) ? t("أُرسلت إلى مهامك", "Sent to your tasks") : t("أرسل إلى مهامي", "Send to my tasks")}
                      onClick={() => sendToTasks(f)}
                      disabled={!f.text.trim() || sent.has(f.id) || tasks.create.isPending}
                      className={cx("max-sm:size-11", sent.has(f.id) && "!opacity-100 text-palm")}
                    >
                      {sent.has(f.id) ? <Check className="size-[18px]" strokeWidth={2} /> : <ListPlus className="size-[18px]" strokeWidth={1.75} />}
                    </IconButton>
                    <RowActions
                      name={f.text || t(`النقطة ${i + 1}`, `follow-up ${i + 1}`)}
                      first={i === 0}
                      last={i === draft.followups.length - 1}
                      onUp={() => setFollowups((l) => move(l, i, -1))}
                      onDown={() => setFollowups((l) => move(l, i, 1))}
                      onDelete={() => setFollowups((l) => l.filter((x) => x.id !== f.id))}
                      deleteLabel={t("احذف النقطة", "Delete follow-up")}
                    />
                  </motion.li>
                ))}
              </ul>
            )}
            <Button variant="quiet" size="sm" className="mt-4 max-sm:h-11 max-sm:w-full" icon={<Plus className="size-4" />} onClick={addFollowup}>
              {t("أضف نقطة", "Add a follow-up")}
            </Button>
          </Section>

          {/* ───── الملاحظات الخاصة ───── */}
          <Section
            id="sec-note"
            title={
              <span className="inline-flex items-center gap-2">
                <Lock className="size-4 text-ink-3" strokeWidth={1.75} />
                {t("ملاحظاتك التحضيرية", "Your prep notes")}
              </span>
            }
            hint={t("لك وحدك: لا تظهر في رابط المشاركة، وتبقى مخفية في العرض حتى تُظهرها.", "Yours only: never in the shared link, and hidden while presenting until you show them.")}
          >
            <TextArea dir="auto" value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder={t("ما تريد تذكّره قبل الدخول…", "What you want to remember going in…")} aria-label={t("ملاحظاتك التحضيرية", "Your prep notes")} rows={3} />
          </Section>

          {/* ───── المرجع ───── */}
          <Section id="sec-ref" title={t("المرجع والصورة", "Reference and image")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("رابط مرجع خارجي", "External reference link")} hint={t("مستند، أو عرض، أو صفحة المشروع.", "A doc, a deck, or the project page.")}>
                {(p) => (
                  <div className="flex gap-2">
                    <Input {...p} type="url" inputMode="url" dir="ltr" value={draft.link} onChange={(e) => set("link", e.target.value.trim())} placeholder="https://" className="max-sm:h-11" />
                    {/^https?:\/\//.test(draft.link) && (
                      <a href={draft.link} target="_blank" rel="noreferrer" aria-label={t("افتح المرجع", "Open the reference")} title={t("افتح المرجع", "Open the reference")} className="press grid size-10 shrink-0 place-items-center rounded-sm border border-line text-ink-2 hover:border-line-strong hover:text-ink max-sm:size-11">
                        <ExternalLink className="size-4" strokeWidth={1.75} />
                      </a>
                    )}
                  </div>
                )}
              </Field>
              <Field label={t("رابط صورة أو شعار", "Image or logo link")} hint={t("تظهر أعلى صفحة العرض: شعار الجهة أو الشريك.", "Shown at the top of the presentation: the partner’s logo.")}>
                {(p) => (
                  <div className="flex gap-2">
                    <Input {...p} type="url" inputMode="url" dir="ltr" value={draft.image} onChange={(e) => set("image", e.target.value.trim())} placeholder="https://" className="max-sm:h-11" />
                    {draft.image && <ImagePreview src={draft.image} />}
                  </div>
                )}
              </Field>
            </div>
          </Section>
        </div>
      </div>

      <Confirm
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("أرشف هذا الاجتماع؟", "Archive this meeting?")}
        body={t(
          "يختفي من القائمة ومن سجلّ القرارات وتقرير الحالة، ويتوقف رابط المشاركة إن وُجد.",
          "It leaves the list, the decision log and the status report, and its shared link stops working.",
        )}
        confirmLabel={t("أرشف الاجتماع", "Archive meeting")}
        onConfirm={archive}
      />
    </div>
  );
}

// ───────── أجزاء صغيرة ─────────

function Section({ id, title, hint, aside, children }: { id: string; title: ReactNode; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24 border-t border-line pt-6" aria-labelledby={`${id}-h`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`${id}-h`} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {hint && <p className="mt-1 max-w-prose text-sm text-ink-3">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

let labeledSeq = 0;
function Labeled({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const [id] = useState(() => `mt-f-${++labeledSeq}`);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-3">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  return (
    <div className="flex min-h-8 items-center" aria-live="polite">
      {state === "error" ? (
        <button type="button" onClick={onRetry} className="press inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-ember hover:bg-ember-wash max-sm:h-10">
          <span className="size-1.5 rounded-full bg-ember" aria-hidden />
          {t("لم يُحفظ. أعد المحاولة", "Not saved. Try again")}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2 text-xs text-ink-3">
          {state === "saved" ? <Check className="size-3.5" strokeWidth={2} /> : <span className="size-1.5 animate-pulse rounded-full bg-ink-3" aria-hidden />}
          {state === "saved" ? t("محفوظ", "Saved") : t("يُحفظ…", "Saving…")}
        </span>
      )}
    </div>
  );
}

function MenuItem({ onSelect, icon, danger, children }: { onSelect: () => void; icon: ReactNode; danger?: boolean; children: ReactNode }) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cx(
        "flex h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 outline-none max-sm:h-11",
        danger ? "text-ember data-[highlighted]:bg-ember-wash" : "text-ink-2 data-[highlighted]:bg-sunk data-[highlighted]:text-ink",
      )}
    >
      {icon}
      {children}
    </DM.Item>
  );
}

/** أفعال الصف: ظاهرة على الحاسب، وفي قائمة واحدة على الجوّال حتى يبقى للنص مكانه */
function RowActions({
  name,
  first,
  last,
  onUp,
  onDown,
  onDelete,
  deleteLabel,
  vertical,
}: {
  name: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  deleteLabel: string;
  vertical?: boolean;
}) {
  return (
    <>
      <div className={cx("hidden shrink-0 sm:flex", vertical ? "flex-col" : "items-center")}>
        <IconButton label={t(`انقل «${name}» للأعلى`, `Move “${name}” up`)} size="sm" disabled={first} onClick={onUp}>
          <ArrowUp className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton label={t(`انقل «${name}» للأسفل`, `Move “${name}” down`)} size="sm" disabled={last} onClick={onDown}>
          <ArrowDown className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton label={`${deleteLabel}: ${name}`} size="sm" onClick={onDelete} className="hover:!bg-ember-wash hover:!text-ember">
          <X className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="sm:hidden">
        <DM.Root dir={document.documentElement.dir as "rtl" | "ltr"}>
          <DM.Trigger asChild>
            <IconButton label={t(`أفعال «${name}»`, `Actions for “${name}”`)} className="max-sm:size-11">
              <MoreHorizontal className="size-[18px]" strokeWidth={1.75} />
            </IconButton>
          </DM.Trigger>
          <DM.Portal>
            <DM.Content align="end" sideOffset={4} className="mt-pop z-50 min-w-48 rounded-md border border-line bg-sheet p-1.5 text-sm shadow-[var(--shadow-float)]">
              <MenuItem onSelect={onUp} icon={<ArrowUp className="size-4" strokeWidth={1.75} />}>
                {t("انقل للأعلى", "Move up")}
              </MenuItem>
              <MenuItem onSelect={onDown} icon={<ArrowDown className="size-4" strokeWidth={1.75} />}>
                {t("انقل للأسفل", "Move down")}
              </MenuItem>
              <DM.Separator className="my-1 h-px bg-line" />
              <MenuItem onSelect={onDelete} icon={<Trash2 className="size-4" strokeWidth={1.75} />} danger>
                {deleteLabel}
              </MenuItem>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
      </div>
    </>
  );
}

function ImagePreview({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(true), [src]);
  if (!ok) return null;
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-sm border border-line bg-sheet max-sm:size-11">
      <img src={src} alt="" onError={() => setOk(false)} className="max-h-full max-w-full object-contain" />
    </span>
  );
}

/** الحضور شرائح: الفاصلة (, أو ،) أو Enter تضيف اسماً، وBackspace في حقل فارغ يحذف آخرها */
function Attendees({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commit = (raw: string) => {
    const names = splitAttendees(raw).filter((n) => !value.includes(n));
    if (names.length) onChange([...value, ...names]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      commit(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="mt-attendees" className="text-xs font-medium text-ink-2">
        {t("الحضور", "Attendees")}
      </label>
      <div className={cx(control, "flex min-h-10 cursor-text flex-wrap items-center gap-1.5 py-1.5 focus-within:border-dusk focus-within:ring-2 focus-within:ring-dusk/25 max-sm:min-h-11")} onClick={() => inputRef.current?.focus()}>
        {value.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-flex max-w-full items-center gap-0.5 rounded-sm bg-sunk py-0.5 ps-2.5 pe-0.5 text-sm">
            <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((_, j) => j !== i));
              }}
              aria-label={t(`احذف ${name}`, `Remove ${name}`)}
              className="press grid size-7 shrink-0 place-items-center rounded-[4px] text-ink-3 hover:bg-line hover:text-ink"
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id="mt-attendees"
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,،\n]/.test(v)) commit(v);
            else setText(v);
          }}
          onKeyDown={onKey}
          onBlur={() => text.trim() && commit(text)}
          enterKeyHint="done"
          placeholder={value.length ? t("أضف اسماً…", "Add a name…") : t("من يحضر؟ افصل بين الأسماء بفاصلة", "Who attends? Separate names with a comma")}
          aria-describedby="mt-attendees-hint"
          className="h-7 min-w-[8rem] flex-1 bg-transparent outline-none placeholder:text-ink-3"
        />
      </div>
      <p id="mt-attendees-hint" className="text-xs text-ink-3">
        {t("الفاصلة أو Enter تضيف الاسم. ضع من يملك القرار.", "A comma or Enter adds the name. Include whoever owns the decision.")}
      </p>
    </div>
  );
}
