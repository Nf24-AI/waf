// الواجهة العامة. المشهد الأول غروب تنومة: الكلمة كبيرة، وتحتها الأفق يُرسم مرة واحدة
// حتى «الآن». الخط نفسه يرافق المستخدم في كل صفحة بعد ذلك.

import { ArrowUpLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import village from "@/assets/village-at-dusk.jpg";
import { useAuth } from "@/lib/auth";
import { formatClock, pick, t, useLang } from "@/lib/i18n";
import { ButtonLink } from "@/ui/Button";
import { LangToggle, ThemeToggle } from "@/ui/Chrome";
import { cx } from "@/ui/cx";
import { dayFraction, useNow } from "@/ui/DayLine";

const SERVICES = [
  {
    id: "meetings",
    href: "/meetings",
    name: ["الاجتماعات", "Meetings"],
    line: ["جهّز الاجتماع في خمس خطوات، اعرضه على الشاشة، واكتب القرار ومالكه وأنت فيه.", "Prepare in five steps, present it on screen, and write each decision and its owner as it happens."],
    outputs: [
      ["سجلّ القرارات", "Decision log"],
      ["تقرير الحالة الأسبوعي", "Weekly status report"],
      ["رابط للقراءة فقط", "Read-only link"],
    ],
  },
  {
    id: "time",
    href: "/time",
    name: ["الوقت", "Time"],
    line: ["ثلاثة إطارات يعمل كلٌّ منها وحده: مصفوفة أيزنهاور، وحجز الوقت، وجلسة التركيز.", "Three frameworks, each works alone: the Eisenhower matrix, time blocking, and focus sessions."],
    outputs: [
      ["مصفوفة أيزنهاور", "Eisenhower matrix"],
      ["حجز الوقت", "Time blocking"],
      ["جلسة التركيز", "Focus session"],
    ],
  },
] as const;

const FLOW = [
  [["اكتب", "Write"], ["كل ما عليك، مرة واحدة.", "Everything on your plate, once."]],
  [["صنّف", "Sort"], ["المهم والعاجل في مصفوفة أيزنهاور.", "Important and urgent, in the Eisenhower matrix."]],
  [["احجز", "Book"], ["لكل مهمة ساعتها على جدول اليوم.", "Each task gets its hour on today’s schedule."]],
  [["ركّز", "Focus"], ["جلسة على المهمة نفسها حتى تُنجَز.", "A session on that same task until it’s done."]],
] as const;

const SOON = [
  [["سجلّ المخاطر", "Risk register"], ["المخاطر المفتوحة باحتمالها وأثرها ومالكها، ومراجعة دورية تُغلق ما انتهى.", "Open risks with likelihood, impact and owner, and a regular review that closes what’s done."]],
  [["خريطة أصحاب المصلحة", "Stakeholder map"], ["من يقرّر ومن يُستشار ومن يُبلَّغ فقط، ودرجة تأثير كلٍّ منهم.", "Who decides, who is consulted, who is only informed, and how much each one sways the project."]],
  [["الافتراضات والاعتماديات", "Assumptions & dependencies"], ["ما يقوم عليه التخطيط وما ينتظر طرفاً آخر، وتاريخ التحقق من كل بند.", "What the plan rests on and what waits on someone else, with a check date for each."]],
  [["تخطيط السعة", "Capacity planning"], ["الجهد المتاح للفريق مقابل الملتزَم به، فيظهر التحميل الزائد قبل أن يصير تأخيراً.", "The team’s available effort against what’s committed, so overload shows before it becomes delay."]],
] as const;

function useTypedWord(word: string, enabled: boolean) {
  const [n, setN] = useState(enabled ? 0 : word.length);
  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setN(word.length);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= word.length) clearInterval(id);
    }, 140);
    return () => clearInterval(id);
  }, [word, enabled]);
  return word.slice(0, n);
}

function Horizon() {
  const now = useNow();
  const minute = now.getHours() * 60 + now.getMinutes();
  const f = dayFraction(minute);
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const before = minute < 6 * 60;
  return (
    <div className="dayline-draw relative mt-10 sm:mt-14" aria-hidden>
      <div className="h-px w-full bg-white/25" />
      <div className="dayline-fill absolute start-0 top-0 h-px bg-[#f2b04a] shadow-[0_0_24px_2px_rgb(242_176_74/0.55)]" style={{ width: `${f * 100}%` }} />
      {!before && f < 1 && (
        <div className="dayline-now absolute top-0" style={{ insetInlineStart: `${f * 100}%` }}>
          <span className="absolute -top-[5px] -ms-[5px] block size-[11px] rounded-full bg-[#f2b04a] ring-[6px] ring-[#f2b04a]/20" />
          <span className="tnum absolute -top-8 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-[#f4be66] rtl:translate-x-1/2">
            {t("الآن", "Now")} {formatClock(hhmm)}
          </span>
        </div>
      )}
      <div className="relative mt-3 h-4 text-[11px] text-white/45">
        {[6, 12, 18, 24].map((h, i) => {
          const pos = i / 3;
          // تختفي علامة الساعة إذا اقتربت من علامة «الآن» حتى لا تتراكبا
          if (!before && f < 1 && Math.abs(pos - f) < 0.09) return null;
          return (
            <span key={h} className={cx("tnum absolute", i === 0 ? "start-0" : i === 3 ? "end-0" : "-translate-x-1/2 rtl:translate-x-1/2")} style={i > 0 && i < 3 ? { insetInlineStart: `${pos * 100}%` } : undefined}>
              {formatClock(h === 24 ? "23:59" : `${String(h).padStart(2, "0")}:00`)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Landing() {
  const { account } = useAuth();
  const lang = useLang();
  const word = useTypedWord("وَاف", lang === "ar");

  return (
    <div className="min-h-dvh bg-bg">
      {/* ───── المشهد الأول: الغسق ───── */}
      <section className="relative isolate overflow-hidden bg-[#0b1322] text-white" aria-labelledby="hero-title">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 70% at 50% 100%, rgb(239 164 49 / 0.32) 0%, rgb(239 164 49 / 0.08) 38%, transparent 62%), linear-gradient(180deg, #0a1120 0%, #13284a 55%, #2a3f5f 100%)",
          }}
        />
        <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <span className="font-display text-2xl font-bold">وَاف</span>
          <nav className="ms-6 hidden gap-1 text-sm text-white/70 sm:flex" aria-label={t("أقسام الصفحة", "Page sections")}>
            <a href="#services" className="rounded-sm px-3 py-2 hover:text-white">
              {t("الخدمات", "Services")}
            </a>
            <a href="#about" className="rounded-sm px-3 py-2 hover:text-white">
              {t("عن واف", "About")}
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-1 [&_button]:text-white/75 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
            <LangToggle />
            {account ? (
              <ButtonLink href="/today" variant="saffron" size="sm" className="ms-2">
                {t("ادخل واف", "Open Waf")}
              </ButtonLink>
            ) : (
              <Link href="/login" className="ms-1 rounded-sm px-3 py-2 text-sm text-white/80 hover:text-white">
                {t("تسجيل الدخول", "Sign in")}
              </Link>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
          <p className="text-sm text-white/65">{t("أدوات مدير المشروع ومالك المنتج", "Tools for project managers and product owners")}</p>
          <h1 id="hero-title" className="mt-4 font-display text-[clamp(5.5rem,22vw,15rem)] leading-[0.9] font-bold tracking-tight">
            <span aria-hidden={lang === "ar"}>{lang === "ar" ? word || " " : "Waf"}</span>
            {lang === "ar" && <span className="sr-only">وَاف</span>}
          </h1>
          <p className="mt-5 font-display text-xl text-[#f4be66] sm:text-2xl">{t("من وَفَى: أتمَّ وأكمل.", "From wafā: to fulfil, to see through.")}</p>
          <p className="mt-4 max-w-xl text-white/75 sm:text-lg">
            {t(
              "تجهّز اجتماعك وتخرج منه بقرار له مالك، ثم ترتّب وقتك لتفي بما التزمت به. كل أداة تعمل وحدها، وتجدها حين تحتاجها.",
              "Prepare a meeting and leave with decisions that have owners, then arrange your time to keep what you committed to. Each tool works on its own, ready when you need it.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {account ? (
              <ButtonLink href="/today" variant="saffron" size="lg">
                {t("ادخل واف", "Open Waf")}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/signup" variant="saffron" size="lg">
                  {t("أنشئ حسابك", "Create your account")}
                </ButtonLink>
                <a href="/today?demo=1" className="press inline-flex h-12 items-center rounded-sm border border-white/25 px-6 font-medium text-white hover:bg-white/10">
                  {t("جرّبه بلا حساب", "Try it without an account")}
                </a>
              </>
            )}
          </div>
          <Horizon />
        </div>
      </section>

      {/* ───── الخدمات ───── */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="services-title">
        <h2 id="services-title" className="max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
          {t("خدمتان اليوم، وكل واحدة تكفي وحدها.", "Two services today, each enough on its own.")}
        </h2>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {SERVICES.map((s) => (
            <Link key={s.id} href={s.href} className="group grid gap-4 py-10 transition-colors sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:gap-10">
              <h3 className="font-display text-3xl font-semibold transition-colors group-hover:text-dusk">{pick(s.name)}</h3>
              <div>
                <p className="max-w-xl text-lg text-ink-2">{pick(s.line)}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {s.outputs.map((o) => (
                    <li key={o[0]} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2">
                      {pick(o)}
                    </li>
                  ))}
                </ul>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink sm:pt-2">
                {t("ادخل الخدمة", "Open")}
                <ArrowUpLeft className="size-4 transition-transform duration-200 ease-[var(--ease-out)] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 ltr:-scale-x-100" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-3">
          {t("ومعهما ", "Alongside them, ")}
          <a href="https://projec3-nf.vercel.app" className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink" target="_blank" rel="noreferrer">
            {t("أي خدمة", "Any Service")}
          </a>
          {t(": دليل موحّد لمزوّدي الخدمة والشركاء، تطبيق مستقلّ بدخوله الخاص.", ": one directory of providers and partners, a separate app with its own sign-in.")}
        </p>
      </section>

      {/* ───── نظام واف ───── */}
      <section className="border-y border-line bg-sheet" aria-labelledby="flow-title">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 id="flow-title" className="font-display text-3xl font-semibold">
              {t("نظام واف", "The Waf system")}
            </h2>
            <p className="mt-3 text-ink-2">
              {t(
                "حين تريد الإطارات معاً: تكتب المهمة مرة، ثم تنتقل هي نفسها من التصنيف إلى الجدول إلى جلسة التركيز.",
                "When you want the frameworks together: write a task once, and that same task moves from sorting to the schedule to a focus session.",
              )}
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
            {FLOW.map(([verb, line], i) => (
              <li key={verb[0]} className="relative bg-sheet p-5">
                <span className="tnum font-display text-sm text-saffron-ink">{i + 1}</span>
                <p className="mt-6 font-display text-2xl font-semibold">{pick(verb)}</p>
                <p className="mt-1 text-sm text-ink-2">{pick(line)}</p>
                <span className={cx("absolute inset-x-0 bottom-0 h-0.5 bg-saffron", "origin-[var(--o)]")} style={{ transform: `scaleX(${(i + 1) / 4})`, ["--o" as string]: lang === "ar" ? "right" : "left" }} aria-hidden />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── القادم ───── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="soon-title">
        <h2 id="soon-title" className="font-display text-2xl font-semibold">
          {t("ما نبنيه بعدها", "What we’re building next")}
        </h2>
        <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {SOON.map(([name, line]) => (
            <li key={name[0]} className="border-s-2 border-line ps-4">
              <p className="font-medium">{pick(name)}</p>
              <p className="mt-1 text-sm text-ink-2">{pick(line)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ───── عن واف ───── */}
      <section id="about" className="scroll-mt-6 bg-[#0b1322] text-white" aria-labelledby="about-title">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:gap-16">
          <figure className="relative">
            <img src={village} alt={t("قرية في تنومة عند الغروب، وخلفها الجبال", "A village in Tanomah at dusk, mountains behind it")} className="aspect-[4/5] w-full rounded-md object-cover" loading="lazy" width={924} height={1152} />
            <figcaption className="tnum mt-3 flex justify-between text-xs text-white/55">
              <span>{t("تنومة، المملكة العربية السعودية", "Tanomah, Saudi Arabia")}</span>
              <span dir="ltr">18.9881° N, 42.0669° E</span>
            </figcaption>
          </figure>
          <div>
            <h2 id="about-title" className="font-display text-3xl font-semibold sm:text-4xl">
              {t("من هناك بدأنا، ومن هنا نحكي.", "We started there; we tell it from here.")}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              {t(
                "تنومة، موطن الـ ٢٢ عاماً. هنا كبرت أحلامنا، وتشكّلت ملامحنا، وكانت البدايات. واليوم، نحمل ذلك المكان في كل ما نبنيه.",
                "Tanomah, home for 22 years. This is where our dreams grew, where we took shape, where it began. Today we carry that place into everything we build.",
              )}
            </p>
            <p className="mt-8 text-white/60">{t("الألوان التي تراها في واف من هذه الصورة: سماء الليل، وأفق الزعفران، وضوء الحجر.", "The colours you see in Waf come from this photo: the night sky, the saffron horizon, the light in the stone.")}</p>
          </div>
        </div>
        <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-6 text-sm text-white/55 sm:px-6">
          <span>{t("واف — أدوات مدير المشروع ومالك المنتج", "Waf — tools for project managers and product owners")}</span>
          <div className="flex items-center gap-1 [&_button]:text-white/60 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
            <ThemeToggle />
          </div>
        </footer>
      </section>
    </div>
  );
}
