import React, { useEffect, useRef, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { attentionList } from "@shared/dashboard";
import { nextActionOf } from "@shared/tasks";
import { TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import { getLang, locale, t } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import LangToggle from "@/components/LangToggle";

/**
 * الشريط العلوي.
 *
 * البحث والجرس يعملان. المرجع يضعهما، ووضعُ زرٍّ لا يفعل شيئاً أسوأ من عدم
 * وضعه: يُضغط مرّة فيُظنّ معطوباً، ويُضغط ثانيةً فيُترك المنتج كلّه.
 *
 * والبحث لا يفتح محرّكاً: يمرّر الكلمة إلى صفحة المهام فتصفّي بها. مهام
 * شخص واحد تُصفّى في المتصفّح، وبناء بحثٍ على الخادم لها هندسةٌ لمسألة
 * ليست موجودة.
 */

function hrefOf(taskId: string, method: ReturnType<typeof nextActionOf>["method"]): string {
  const route =
    method === "eisenhower"
      ? TIME_METHOD_ROUTES.eisenhower
      : method === "time-blocking"
        ? TIME_METHOD_ROUTES.timeBlocking
        : TIME_METHOD_ROUTES.focus;
  return `${route}?task=${taskId}`;
}

export default function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  const due = attentionList(open.data ?? [], new Date(), 5);

  // ⌘K / Ctrl+K — الاختصار معروض في الشريط، فليعمل.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setPanel(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // نقرة خارج اللوحة تُغلقها: لوحة تبقى مفتوحة حتى يُضغط زرّها ثانيةً تُنسى مفتوحة.
  useEffect(() => {
    if (!panel) return;
    const onDown = (event: MouseEvent) => {
      if (!bellRef.current?.contains(event.target as Node)) setPanel(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panel]);

  const today = new Date().toLocaleDateString(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = query.trim();
    navigate(clean ? `${TASKS_ROUTE}?q=${encodeURIComponent(clean)}` : TASKS_ROUTE);
  }

  return (
    <header className="tp-top">
      <button
        type="button"
        className="tp-burger"
        onClick={onOpenNav}
        aria-label={t("فتح القائمة", "Open menu")}
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <form className="tp-search" onSubmit={submit} role="search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder={t("ابحث عن مهمة، اجتماع، أو أي شيء …", "Search tasks, meetings, or anything …")}
          aria-label={t("بحث في المهام", "Search tasks")}
          onChange={event => setQuery(event.target.value)}
        />
        <span className="tp-kbd" aria-hidden="true">
          ⌘K
        </span>
      </form>

      <div className="tp-top-end">
        <time className="tp-date">{today}</time>

        <LangToggle short className="tp-icon-btn" />

        <div className="tp-bell-wrap" ref={bellRef}>
          <button
            type="button"
            className="tp-icon-btn"
            onClick={() => setPanel(current => !current)}
            aria-label={
              due.length
                ? t(
                    `${due.length} مهمة تحتاج انتباهك`,
                    due.length === 1 ? "1 task needs your attention" : `${due.length} tasks need your attention`,
                  )
                : t("لا شيء يحتاج انتباهك", "Nothing needs your attention")
            }
            aria-expanded={panel}
          >
            <Bell size={17} aria-hidden="true" />
            {due.length > 0 && <span className="tp-bell-dot" aria-hidden="true" />}
          </button>

          {panel && (
            <div className="tp-panel" role="dialog" aria-label={t("ما يحتاج انتباهك", "What needs your attention")}>
              <h2>{t("تحتاج انتباهك", "Needs your attention")}</h2>
              {due.length === 0 ? (
                <p className="tp-empty">{t("لا شيء متأخّر ولا عاجل.", "Nothing overdue or urgent.")}</p>
              ) : (
                <ul className="tp-panel-list">
                  {due.map(task => (
                    <li key={task.id}>
                      <Link
                        className="tp-panel-row"
                        href={hrefOf(task.id, nextActionOf(task, getLang()).method)}
                        onClick={() => setPanel(false)}
                      >
                        <span className="tp-dot" data-tone="danger" aria-hidden="true" />
                        <span>{task.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
