import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Image as ImageIcon,
  Link2,
  List,
  Maximize2,
  Menu,
  Minimize2,
  Palette,
  Pause,
  Play,
  Circle,
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Presentation,
  Save,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatAgendaIndex, getMeetingReadiness, moveListItem } from "@shared/meeting";
import { PREPARE_STEPS, completedSteps, nextStep } from "./prepare-steps";
import { fromIsoDate, toArabicDigits, toIsoDate } from "@shared/meeting-date";
import { buildTimeRange, parseTimeRange } from "@shared/meeting-time";
import { meetingFileName } from "@shared/meeting-pdf";
import type { MeetingRecord } from "@shared/meeting-store";


type UiSettings = { density: "comfortable" | "compact"; displayScale: "standard" | "compact"; theme: "ink" | "navy" };
const DEFAULT_UI_SETTINGS: UiSettings = { density: "comfortable", displayScale: "standard", theme: "ink" };
function readUiSettings(): UiSettings {
  try { const stored = { ...DEFAULT_UI_SETTINGS, ...JSON.parse(localStorage.getItem("meeting-prep-ui") ?? "{}") } as UiSettings; const params = new URLSearchParams(window.location.search); return params.get("displayDensity") === "compact" ? { ...stored, displayScale: "compact" } : stored; } catch { return DEFAULT_UI_SETTINGS; }
}

const statusTone: Record<string, string> = {
  "جاهز للعرض": "status-ready",
  مسودة: "status-draft",
  "تم الاجتماع": "status-done",
};

/**
 * A genuinely empty meeting. "New meeting" used to spread a sample record, so
 * every new page arrived in Notion pre-filled with someone else's attendees,
 * summary, and agenda.
 */
function blankMeeting(language: "ar" | "en"): Omit<MeetingRecord, "id"> {
  const isArabic = language === "ar";
  return {
    title: isArabic ? "اجتماع جديد" : "New meeting",
    date: isArabic ? "اختر التاريخ" : "Choose a date",
    time: isArabic ? "اختر الوقت" : "Choose a time",
    type: isArabic ? "أخرى" : "Other",
    status: "مسودة",
    attendees: [],
    summary: "",
    agenda: [],
    actions: [],
    note: "",
    link: "",
    image: "",
  };
}

const templates = [
  {
    id: "internal",
    ar: "اجتماع داخلي",
    en: "Internal sync",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "اجتماع داخلي جديد", date: "اختر التاريخ", time: "اختر الوقت", type: "داخلي", status: "مسودة", attendees: [], summary: "ما النتيجة التي نحتاج إلى الخروج بها؟", agenda: [{ title: "المستجدات", context: "ما الذي تغيّر منذ آخر اجتماع؟", goal: "تحديد الأولوية التالية.", decision: "", owner: "" }], actions: ["تحديد الخطوة التالية"], note: "", link: "", image: "" }
      : { title: "New internal sync", date: "Choose a date", time: "Choose a time", type: "Internal", status: "مسودة", attendees: [], summary: "What outcome do we need from this meeting?", agenda: [{ title: "Updates", context: "What changed since the last meeting?", goal: "Choose the next priority.", decision: "", owner: "" }], actions: ["Confirm the next step"], note: "", link: "", image: "" },
  },
  {
    id: "partner",
    ar: "اجتماع شريك",
    en: "Partner review",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "مراجعة مع شريك", date: "اختر التاريخ", time: "اختر الوقت", type: "مع شريك تأميني", status: "مسودة", attendees: [], summary: "ما القرار أو الالتزام المطلوب من الطرفين؟", agenda: [{ title: "الهدف المشترك", context: "تأكيد ما نريد تحقيقه معًا.", goal: "الاتفاق على نتيجة قابلة للقياس.", decision: "", owner: "" }, { title: "الخطوات التالية", context: "المواعيد والمالكون المقترحون.", goal: "تثبيت المسؤوليات والموعد.", decision: "", owner: "" }], actions: ["تأكيد المالك والموعد"], note: "", link: "", image: "" }
      : { title: "Partner review", date: "Choose a date", time: "Choose a time", type: "Partner", status: "مسودة", attendees: [], summary: "What decision or commitment is needed from both sides?", agenda: [{ title: "Shared objective", context: "Confirm what we want to achieve together.", goal: "Agree on a measurable outcome.", decision: "", owner: "" }, { title: "Next steps", context: "Suggested owners and dates.", goal: "Confirm ownership and timing.", decision: "", owner: "" }], actions: ["Confirm owner and date"], note: "", link: "", image: "" },
  },
  {
    id: "leadership",
    ar: "اجتماع قيادة",
    en: "Leadership review",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "مراجعة فريق القيادة", date: "اختر التاريخ", time: "اختر الوقت", type: "إدارة", status: "مسودة", attendees: [], summary: "ما القرارات التي يجب حسمها اليوم؟", agenda: [{ title: "صورة سريعة", context: "أهم المؤشرات والمخاطر.", goal: "تمييز ما يحتاج إلى قرار.", decision: "", owner: "" }, { title: "قرارات مفتوحة", context: "المفاضلات والخيارات المتاحة.", goal: "الخروج بقرار ومالك واضح.", decision: "", owner: "" }], actions: ["تجهيز ملخص القرار"], note: "", link: "", image: "" }
      : { title: "Leadership review", date: "Choose a date", time: "Choose a time", type: "Leadership", status: "مسودة", attendees: [], summary: "Which decisions must be made today?", agenda: [{ title: "Quick picture", context: "Key signals and risks.", goal: "Identify what needs a decision.", decision: "", owner: "" }, { title: "Open decisions", context: "Trade-offs and available options.", goal: "Leave with a clear decision and owner.", decision: "", owner: "" }], actions: ["Prepare decision brief"], note: "", link: "", image: "" },
  },
  {
    id: "general",
    ar: "اجتماع عام",
    en: "General meeting",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "اجتماع جديد", date: "اختر التاريخ", time: "اختر الوقت", type: "أخرى", status: "مسودة", attendees: [], summary: "ما الغرض الأساسي من هذا الاجتماع؟", agenda: [{ title: "تحديد الهدف", context: "اكتب الخلفية التي يحتاجها الحضور.", goal: "الاتفاق على النتيجة المطلوبة.", decision: "", owner: "" }], actions: ["تأكيد الخطوة التالية"], note: "", link: "", image: "" }
      : { title: "New meeting", date: "Choose a date", time: "Choose a time", type: "Other", status: "مسودة", attendees: [], summary: "What is the main purpose of this meeting?", agenda: [{ title: "Set the goal", context: "Add the context attendees need.", goal: "Agree on the desired outcome.", decision: "", owner: "" }], actions: ["Confirm the next step"], note: "", link: "", image: "" },
  },
];

function translateStatus(status: MeetingRecord["status"], language: "ar" | "en") {
  if (language === "ar") return status;
  return status === "جاهز للعرض" ? "Ready to present" : status === "تم الاجتماع" ? "Completed" : "Draft";
}

export default function Home() {
  // Starts empty: meetings come from Notion, and showing samples first would
  // flash fake data that the user could mistake for their own.
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [uiSettings, setUiSettings] = useState<UiSettings>(readUiSettings);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).get("customize") === "1");
  const [location] = useLocation();
  const copy = language === "ar"
    ? { dashboard: "MEETINGS", intro: "الاجتماعات", introSub: "تضع البيانات الأساسية، وواف يبني صفحة الاجتماع.", newMeeting: "اجتماع جديد", edit: "وضع التحرير", display: "وضع العرض", basics: "المعلومات الأساسية", summary: "الملخص التنفيذي", notes: "ملاحظاتك التحضيرية", agenda: "مواضيع النقاش", external: "مرجع خارجي", actions: "نقاط متابعة", save: "حفظ التغييرات", back: "العودة للتحرير", refresh: "تحديث العرض", fullScreen: "ملء الشاشة", exitFullScreen: "الخروج من ملء الشاشة", pdf: "تنزيل PDF", pdfHint: "اختر «حفظ كملف PDF» في وجهة الطباعة، ثم شارك الملف.", goal: "هدف الاجتماع", topics: "محاور النقاش", title: "عنوان الاجتماع", date: "التاريخ", time: "الوقت", type: "نوع الاجتماع", attendees: "الحضور", hint: "افصل بين الأسماء بفاصلة", search: "ابحث...", noResults: "لا اجتماعات مطابقة", noResultsHint: "جرّب كلمة أخرى.", loading: "جارٍ التحميل", loadingHint: "تُقرأ الاجتماعات من Notion.", connected: "Notion متصل", syncing: "جاري المزامنة...", retry: "إعادة المحاولة", templates: "ابدأ بقالب", meetings: "القائمة", meetingsHint: "اختر اجتماعًا.", active: "الاجتماع النشط", scopeUpcoming: "القادمة", scopePast: "السابقة", scopeAll: "الكل", archive: "أرشفة الاجتماع", archiveConfirm: "سيُنقل هذا الاجتماع إلى أرشيف Notion. يمكنك استعادته من سلة المحذوفات هناك.", cancel: "إلغاء", image: "صورة أو شعار", imageHint: "رابط صورة تظهر أعلى صفحة الاجتماع — شعار الجهة أو الشريك.", emptyTitle: "لا اجتماعات", emptyHint: "قاعدة Notion متصلة وفارغة. ابدأ بقالب." }
    : { dashboard: "MEETINGS", intro: "Meetings", introSub: "You enter the essentials, and Waf builds the meeting page.", newMeeting: "New meeting", edit: "Edit mode", display: "Display mode", basics: "Meeting basics", summary: "Executive summary", notes: "Preparation notes", agenda: "Discussion topics", external: "External reference", actions: "Follow-ups", save: "Save changes", back: "Back to edit", refresh: "Refresh view", fullScreen: "Full screen", exitFullScreen: "Exit full screen", pdf: "Download PDF", pdfHint: "Pick “Save as PDF” as the destination, then share the file.", goal: "Meeting goal", topics: "Discussion topics", title: "Meeting title", date: "Date", time: "Time", type: "Meeting type", attendees: "Attendees", hint: "Separate names with commas", search: "Search...", noResults: "No results", noResultsHint: "Try a different search.", loading: "Loading", loadingHint: "Reading meetings from Notion.", connected: "Notion connected", syncing: "Syncing from Notion...", retry: "Retry", templates: "Start from a template", meetings: "List", meetingsHint: "Select a meeting.", active: "Active meeting", scopeUpcoming: "Upcoming", scopePast: "Past", scopeAll: "All", archive: "Archive meeting", archiveConfirm: "This meeting moves to the Notion archive. You can restore it from the trash there.", cancel: "Cancel", image: "Image or logo", imageHint: "Link to an image shown at the top of the meeting page — an organisation or partner mark.", emptyTitle: "No meetings", emptyHint: "Notion is connected and empty. Start from a template." };
  const isDisplay = location === "/display";
  const isArabic = language === "ar";
  const utils = trpc.useUtils();
  // Notion is the source of truth, so this query always runs.
  const notionQuery = trpc.meetings.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const notionUpdate = trpc.meetings.update.useMutation();
  const notionCreate = trpc.meetings.create.useMutation();
  const notionRemove = trpc.meetings.remove.useMutation();
  // Explains *why* Notion is unreachable: missing config, or a specific API error.
  const notionStatus = trpc.meetings.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  // No sample fallback: when there is nothing in Notion there is nothing to show.
  const activeMeeting: MeetingRecord | undefined = meetings.find((meeting) => meeting.id === activeId) ?? meetings[0];
  const notionMeetings = notionQuery.data?.meetings ?? [];
  const isActiveNotionMeeting = Boolean(activeMeeting) && notionMeetings.some((meeting) => meeting.id === activeMeeting?.id);
  const notionHasError = connectionError || notionQuery.isError;
  const workspaceLoading = isLoading || notionQuery.isLoading;
  // There is no prototype mode any more — Notion is the only source, so the
  // pill reports the real connection state instead of a third fake one.
  // The header used to hard-code a date and a greeting, so it always read
  // "Tuesday, 27 August 2026" no matter when the workspace was opened.
  const now = new Date();
  const today = fromIsoDate(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    language
  );
  const hour = now.getHours();
  const greeting = isArabic
    ? hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء الخير"
    : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  /** Two-digit count in the reader's own numerals; padding mixed them before. */
  const statCount = (value: number) => {
    const padded = String(value).padStart(2, "0");
    return isArabic ? toArabicDigits(padded) : padded;
  };

  // "This week" used to display the total meeting count regardless of date.
  const meetingsThisWeek = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfWindow = startOfToday + 7 * 24 * 60 * 60 * 1000;
    return meetings.filter((meeting) => {
      const iso = toIsoDate(meeting.date);
      if (!iso) return false;
      const time = new Date(`${iso}T00:00:00`).getTime();
      return time >= startOfToday && time < endOfWindow;
    }).length;
  }, [meetings, now]);

  const timeRange = activeMeeting ? parseTimeRange(activeMeeting.time) : { start: "", end: "" };

  const syncLabel = notionHasError
    ? (isArabic ? "تعذر الاتصال بـ Notion" : "Notion connection error")
    : notionQuery.isSuccess
      ? copy.connected
      : copy.syncing;

  useEffect(() => {
    localStorage.setItem("meeting-prep-ui", JSON.stringify(uiSettings));
  }, [uiSettings]);

  // The theme is a token scope on the root, not a class the components read:
  // every surface already resolves through --canvas / --surface-* / --accent,
  // so swapping the scope repaints the console without touching a component.
  // The stage keeps its own `.waf-stage` scope and stays light either way.
  useEffect(() => {
    const root = document.documentElement;
    if (uiSettings.theme === "ink") root.removeAttribute("data-waf-theme");
    else root.setAttribute("data-waf-theme", uiSettings.theme);
  }, [uiSettings.theme]);

  // Saving is manual, so leaving with pending edits used to lose them silently.
  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  // Adopt Notion's list even when it is empty — otherwise an empty database
  // silently leaves the sample meetings on screen as if they were real.
  const notionData = notionQuery.data?.meetings;
  useEffect(() => {
    if (!notionData) return;
    setMeetings(notionData);
    setActiveId((current) => notionData.some((meeting) => meeting.id === current) ? current : notionData[0]?.id ?? "");
  }, [notionData]);

  useEffect(() => {
  }, [meetings]);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  /** Meetings without a real date sort as upcoming — they are still being planned. */
  const isPast = (meeting: MeetingRecord) => {
    const iso = toIsoDate(meeting.date);
    if (!iso) return false;
    return new Date(`${iso}T00:00:00`).getTime() < startOfToday;
  };

  const scopedMeetings = useMemo(() => {
    const byScope = scope === "all" ? meetings : meetings.filter((m) => (scope === "past" ? isPast(m) : !isPast(m)));
    // Upcoming reads soonest-first; past reads most-recent-first.
    return [...byScope].sort((a, b) => {
      const ai = toIsoDate(a.date) ?? "";
      const bi = toIsoDate(b.date) ?? "";
      if (!ai) return -1;
      if (!bi) return 1;
      return scope === "past" ? bi.localeCompare(ai) : ai.localeCompare(bi);
    });
  }, [meetings, scope, startOfToday]);

  const pastCount = useMemo(() => meetings.filter(isPast).length, [meetings, startOfToday]);

  const filteredMeetings = useMemo(() => scopedMeetings.filter((meeting) => meeting.title.toLowerCase().includes(query.toLowerCase()) || meeting.type.toLowerCase().includes(query.toLowerCase())), [scopedMeetings, query]);

  const updateMeeting = (field: keyof MeetingRecord, value: unknown) => {
    setSaved(false);
    setMeetings((current) => current.map((meeting) => meeting.id === activeId ? { ...meeting, [field]: value } : meeting));
  };
  /** Used by the stage to capture decisions without leaving the meeting page. */
  const updateAgendaField = (index: number, field: "decision" | "owner", value: string) =>
    updateMeeting("agenda", (activeMeeting?.agenda ?? []).map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  const updateAgenda = (index: number, field: "title" | "context" | "goal", value: string) => updateMeeting("agenda", activeMeeting.agenda.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const addAgenda = () => updateMeeting("agenda", [...activeMeeting.agenda, { title: isArabic ? "موضوع جديد" : "New topic", context: isArabic ? "أضف خلفية مختصرة للموضوع." : "Add a short context.", goal: isArabic ? "ما النتيجة التي نريدها؟" : "What outcome do we need?" }]);
  const removeAgenda = (index: number) => updateMeeting("agenda", activeMeeting.agenda.filter((_, itemIndex) => itemIndex !== index));
  const moveAgenda = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex >= 0 && nextIndex < activeMeeting.agenda.length) updateMeeting("agenda", moveListItem(activeMeeting.agenda, index, nextIndex)); };
  const moveAction = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex >= 0 && nextIndex < activeMeeting.actions.length) updateMeeting("actions", moveListItem(activeMeeting.actions, index, nextIndex)); };

  const createMeeting = (meeting: Omit<MeetingRecord, "id">) => {
    // Create the Notion page first so the meeting survives a refresh. Falling
    // back to a local-only row would quietly lose the user's work.
    notionCreate.mutate(meeting, {
      onSuccess: (created) => {
        setMeetings((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setActiveId(created.id);
        setSaved(true);
        void utils.meetings.list.invalidate();
        toast.success(isArabic ? "أُنشئ اجتماع جديد في Notion" : "New meeting created in Notion");
      },
      onError: (error) => {
        toast.error(isArabic ? "تعذر إنشاء الاجتماع" : "Could not create the meeting", { description: error.message });
      },
    });
  };

  const deleteMeeting = (id: string) => {
    notionRemove.mutate({ id }, {
      onSuccess: () => {
        setMeetings((current) => {
          const next = current.filter((meeting) => meeting.id !== id);
          setActiveId((active) => (active === id ? next[0]?.id ?? "" : active));
          return next;
        });
        void utils.meetings.list.invalidate();
        toast.success(isArabic ? "نُقل الاجتماع إلى الأرشيف" : "Meeting moved to archive");
      },
      onError: (error) => {
        toast.error(isArabic ? "تعذر حذف الاجتماع" : "Could not delete the meeting", { description: error.message });
      },
    });
  };
  const createFromTemplate = (template: (typeof templates)[number]) => createMeeting(template.build(language));
  const saveMeeting = () => {
    if (isActiveNotionMeeting) {
      notionUpdate.mutate(activeMeeting, {
        onSuccess: () => {
          setSaved(true);
          void utils.meetings.list.invalidate();
          toast.success(isArabic ? "تم حفظ الاجتماع في Notion" : "Meeting saved to Notion");
        },
        // Keep the unsaved marker on failure; claiming "saved" would be a lie.
        onError: (error) => toast.error(isArabic ? "تعذر الحفظ في Notion" : "Could not save to Notion", { description: error.message }),
      });
      return;
    }
    // Not backed by a Notion page yet, so persist it as a new one.
    const { id: _unusedId, ...fields } = activeMeeting;
    createMeeting(fields);
  };
  const retryConnection = () => { setConnectionError(false); void notionQuery.refetch(); };

  // Loading and empty are checked before display mode on purpose: presenting a
  // sample meeting on a shared screen is the worst place for fake data.
  if (workspaceLoading) return <div dir={isArabic ? "rtl" : "ltr"} className="state-screen"><div className="state-card"><div className="loading-orb" /><h2>{copy.loading}</h2><p>{copy.loadingHint}</p></div></div>;
  if (isDisplay && activeMeeting) return <DisplayMode meeting={activeMeeting} onBack={() => window.history.back()} onRefresh={() => toast.success(copy.refresh)} onUpdateAgenda={updateAgendaField} copy={copy} language={language} />;
  // Connected, but the database has no meetings yet.
  if (meetings.length === 0 || !activeMeeting) return (
    <div dir={isArabic ? "rtl" : "ltr"} className="state-screen">
      <div className="state-card">
        <CalendarDays size={30} />
        <h2>{copy.emptyTitle}</h2>
        <p>{copy.emptyHint}</p>
        <div className="empty-templates">
          {templates.map((template) => (
            <button key={template.id} className="template-chip" disabled={notionCreate.isPending} onClick={() => createFromTemplate(template)}>
              {isArabic ? template.ar : template.en}
            </button>
          ))}
        </div>
        <button className="secondary-button" onClick={() => void notionQuery.refetch()}>{copy.retry}</button>
      </div>
    </div>
  );

  const updateUiSetting = <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => setUiSettings((current) => ({ ...current, [key]: value }));
  const themeLabel = uiSettings.theme === "navy"
    ? (isArabic ? "التبديل إلى المظهر الحبري" : "Switch to the ink theme")
    : (isArabic ? "التبديل إلى المظهر الكحلي" : "Switch to the navy theme");
  const resetUiSettings = () => setUiSettings(DEFAULT_UI_SETTINGS);

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className={`workspace-shell density-${uiSettings.density}`}>
      <aside className="workspace-sidebar hidden lg:flex">
        <div className="brand-lockup"><div className="brand-mark"><Sparkles size={17} /></div><div><p className="brand-title">واف</p><p className="brand-subtitle">{isArabic ? "أداة الاجتماعات الداخلية" : "Internal meetings tool"}</p></div></div>
        <div className="sidebar-section-label">{isArabic ? "مساحة العمل" : "Workspace"}</div>
        <nav className="sidebar-nav"><button className="sidebar-item active"><LayoutDashboard size={18} /><span>{copy.meetings}</span><span className="nav-count">{meetings.length}</span></button><button className="sidebar-item"><FileText size={18} /><span>{isArabic ? "الملاحظات المحفوظة" : "Saved notes"}</span></button></nav>
        <div className="sidebar-spacer" />
        <div className={`notion-card ${notionHasError ? "connection-error" : ""}`}>
          <div className="notion-icon">N</div><div><p className="notion-title">{notionHasError ? (isArabic ? "تعذر الاتصال بـ Notion" : "Notion connection error") : syncLabel}</p><p className="notion-caption">{notionHasError ? (notionStatus.data && !notionStatus.data.reachable && notionStatus.data.error ? notionStatus.data.error : (isArabic ? "تحقق من الاتصال ثم أعد المحاولة" : "Check the connection and retry")) : (isArabic ? "تقرأ من قاعدة Meeting Prep وتكتب فيها" : "Reading from and writing to Meeting Prep")}</p></div>
          {notionHasError ? <button className="retry-button" onClick={retryConnection}>{copy.retry}</button> : <button className="connection-trigger" onClick={() => setConnectionError(true)} aria-label={isArabic ? "اختبار الاتصال" : "Test connection"}><CircleHelp size={15} /></button>}
        </div>
        <div className="profile-row"><div className="avatar">م</div><div><p className="profile-name">{isArabic ? "مالك المساحة" : "Workspace owner"}</p><p className="profile-role">{isArabic ? "المساحة الشخصية" : "Personal workspace"}</p></div><MoreHorizontal size={18} className="mr-auto text-[#8a9895]" /></div>
      </aside>

      <main className="workspace-main">
        <header className="topbar"><div className="flex items-center gap-3"><button className="mobile-menu lg:hidden"><Menu size={20} /></button><div><p className="eyebrow">{today}</p><h1 className="page-title">{greeting}</h1></div></div><div className="topbar-actions"><div className="sync-pill"><span className="sync-dot" /> {syncLabel}</div><button className="help-button" onClick={() => updateUiSetting("theme", uiSettings.theme === "navy" ? "ink" : "navy")} aria-pressed={uiSettings.theme === "navy"} title={themeLabel} aria-label={themeLabel}><Palette size={18} /></button><button className="help-button" onClick={() => setSettingsOpen((open) => !open)} aria-label={isArabic ? "تخصيص الواجهة" : "Customize interface"}><Settings2 size={18} /></button><div className="avatar small">م</div></div></header>
        {settingsOpen && <UiSettingsPanel language={language} settings={uiSettings} update={updateUiSetting} reset={resetUiSettings} close={() => setSettingsOpen(false)} />}
        <section className="dashboard-intro"><div><p className="section-kicker">{copy.dashboard}</p><h2>{copy.intro}</h2><p>{copy.introSub}</p></div><div className="intro-actions"><button className="language-toggle" onClick={() => setLanguage(isArabic ? "en" : "ar")}>{isArabic ? "EN" : "عربي"}</button><button className="primary-button" disabled={notionCreate.isPending} onClick={() => createMeeting(blankMeeting(language))}><Plus size={18} /> {copy.newMeeting}</button></div></section>
        <section className="template-strip"><div className="template-strip-label"><Sparkles size={15} /><span>{copy.templates}</span></div><div className="template-buttons">{templates.map((template) => <button key={template.id} className="template-button" onClick={() => createFromTemplate(template)}>{isArabic ? template.ar : template.en}</button>)}</div></section>
        <section className="stats-grid"><div className="stat-card"><div className="stat-icon sage"><CalendarDays size={19} /></div><div><p>{isArabic ? "اجتماعات هذا الأسبوع" : "Meetings this week"}</p><strong>{statCount(meetingsThisWeek)}</strong></div><span className="stat-trend">{isArabic ? `من ${statCount(meetings.length)} إجمالًا` : `of ${statCount(meetings.length)} total`}</span></div><div className="stat-card"><div className="stat-icon amber"><Clock3 size={19} /></div><div><p>{isArabic ? "تحتاج تحضيرًا" : "Need preparation"}</p><strong>{statCount(meetings.filter((meeting) => meeting.status === "مسودة").length)}</strong></div><span className="stat-trend warm">{isArabic ? "بانتظارك" : "Waiting"}</span></div><div className="stat-card"><div className="stat-icon blue"><Presentation size={19} /></div><div><p>{isArabic ? "جاهزة للعرض" : "Ready to present"}</p><strong>{statCount(meetings.filter((meeting) => meeting.status === "جاهز للعرض").length)}</strong></div><span className="stat-trend">{isArabic ? `${statCount(meetings.filter((meeting) => meeting.status === "تم الاجتماع").length)} تم عقدها` : `${statCount(meetings.filter((meeting) => meeting.status === "تم الاجتماع").length)} held`}</span></div></section>

        <section className="content-grid"><div className="meetings-panel panel-card"><div className="panel-heading"><div><h3>{copy.meetings}</h3><p>{copy.meetingsHint}</p></div><div className="meeting-tools"><div className="scope-tabs">{([["upcoming", copy.scopeUpcoming], ["past", copy.scopePast], ["all", copy.scopeAll]] as const).map(([value, label]) => <button key={value} className={`scope-tab ${scope === value ? "active" : ""}`} onClick={() => setScope(value)}>{label}{value === "past" && pastCount > 0 && <span className="scope-count">{statCount(pastCount)}</span>}</button>)}</div><div className="search-field"><Search size={16} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} /></div></div></div><div className="meeting-list">{filteredMeetings.length === 0 ? <div className="empty-state"><CalendarDays size={26} /><h4>{copy.noResults}</h4><p>{copy.noResultsHint}</p></div> : filteredMeetings.map((meeting) => <button key={meeting.id} onClick={() => setActiveId(meeting.id)} className={`meeting-row ${meeting.id === activeId ? "selected" : ""}`}><div className="meeting-date"><span>{meeting.date.split("،")[0]}</span><strong>{meeting.date.split("،")[1] ?? meeting.date}</strong></div><div className="meeting-row-main"><div className="meeting-row-title"><h4>{meeting.title}</h4><Badge className={`status-badge ${statusTone[meeting.status] ?? statusTone.مسودة}`}>{translateStatus(meeting.status, language)}</Badge></div><p>{meeting.time || (isArabic ? "الوقت غير محدد" : "Time not set")} <span>·</span> {meeting.type}</p></div><ChevronLeft size={18} className="row-arrow" /></button>)}</div></div>
          <div className="selected-card panel-card"><div className="selected-card-top"><span className="selected-label"><span className="selected-dot" /> {copy.active}</span><button className="icon-button" onClick={() => setPendingDelete(activeMeeting.id)} disabled={!isActiveNotionMeeting || notionRemove.isPending} title={copy.archive} aria-label={copy.archive}><Trash2 size={17} /></button></div>{pendingDelete === activeMeeting.id && <div className="delete-confirm"><p>{copy.archiveConfirm}</p><div className="delete-confirm-actions"><button className="secondary-button" onClick={() => setPendingDelete(null)}>{copy.cancel}</button><button className="danger-button" onClick={() => { deleteMeeting(activeMeeting.id); setPendingDelete(null); }}>{copy.archive}</button></div></div>}<h3>{activeMeeting.title}</h3><p className="selected-meta"><CalendarDays size={15} /> {activeMeeting.date}</p><p className="selected-meta"><Clock3 size={15} /> {activeMeeting.time || (isArabic ? "الوقت غير محدد" : "Time not set")} · {activeMeeting.type}</p><p className="selected-meta"><Users size={15} /> {activeMeeting.attendees.length ? activeMeeting.attendees.join(isArabic ? "، " : ", ") : (isArabic ? "لم تتم إضافة الحضور" : "No attendees yet")}</p><div className="selected-divider" /><div className="selected-progress"><div className="flex items-center justify-between"><span>{isArabic ? "جاهزية الاجتماع" : "Meeting readiness"}</span><strong>{`${getMeetingReadiness(activeMeeting)}٪`}</strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${getMeetingReadiness(activeMeeting)}%` }} /></div></div><Link href="/display" className="display-cta"><Presentation size={17} /> {copy.display} <ArrowLeft size={16} /></Link></div></section>

        <section className="editor-section"><div className="mode-tabs"><button className="mode-tab active"><FileText size={17} /> {copy.edit}</button><Link href="/display" className="mode-tab"><Presentation size={17} /> {copy.display}</Link><span className="mode-note"><span className="sync-dot" /> {syncLabel}</span></div><div className="editor-header"><div><p className="section-kicker">{copy.edit}</p><h2>{activeMeeting.title}</h2><p>{isArabic ? "البيانات التي تظهر في صفحة الاجتماع." : "The data that appears on the meeting page."}</p></div><div className="editor-actions"><span className={`save-status ${saved ? "" : "unsaved"}`}>{saved ? <><Check size={15} /> {isArabic ? "محفوظ" : "Saved"}</> : (isArabic ? "تغييرات غير محفوظة" : "Unsaved changes")}</span><button className="secondary-button" onClick={saveMeeting} disabled={notionUpdate.isPending}><Save size={16} /> {notionUpdate.isPending ? (isArabic ? "جارٍ الحفظ" : "Saving") : copy.save}</button></div></div>
          <PrepareRail meeting={activeMeeting} language={language} />
          <IntakeBox language={language} />
          <div className="editor-layout"><div className="editor-column"><div className="form-card"><div className="form-card-title"><span className="number-chip">٠١</span><div><h3>{copy.basics}</h3><p>{isArabic ? "التفاصيل التي ستظهر في بداية العرض." : "The details shown at the start of the presentation."}</p></div></div><label>{copy.title}<Input value={activeMeeting.title} onChange={(event) => updateMeeting("title", event.target.value)} /></label><div className="form-two-col"><label>{copy.date}<Input type="date" value={toIsoDate(activeMeeting.date) ?? ""} onChange={(event) => updateMeeting("date", event.target.value ? fromIsoDate(event.target.value, language) : (isArabic ? "اختر التاريخ" : "Choose a date"))} /><span className="field-hint">{activeMeeting.date}</span></label><label>{copy.time}<div className="time-range"><Input type="time" value={timeRange.start} onChange={(event) => updateMeeting("time", buildTimeRange(event.target.value, timeRange.end, language))} /><span>–</span><Input type="time" value={timeRange.end} onChange={(event) => updateMeeting("time", buildTimeRange(timeRange.start, event.target.value, language))} /></div><span className="field-hint">{activeMeeting.time}</span></label></div><label>{copy.type}<select value={activeMeeting.type} onChange={(event) => updateMeeting("type", event.target.value)}><option>داخلي</option><option>مع شريك تأميني</option><option>إدارة</option><option>Internal</option><option>Partner</option><option>Leadership</option><option>أخرى</option></select></label><label>{copy.attendees}<Input value={activeMeeting.attendees.join(isArabic ? "، " : ", ")} onChange={(event) => updateMeeting("attendees", event.target.value.split(/[,،]/).map((person) => person.trim()).filter(Boolean))} /><span className="field-hint">{copy.hint}</span></label></div><div className="form-card"><div className="form-card-title"><span className="number-chip">٠٢</span><div><h3>{copy.summary}</h3><p>{isArabic ? "فكرة واحدة تساعدك على بدء الاجتماع من المكان الصحيح." : "One idea to help you start from the right place."}</p></div></div><label><Textarea value={activeMeeting.summary} onChange={(event) => updateMeeting("summary", event.target.value)} rows={4} placeholder={isArabic ? "ما الذي نحتاج أن نخرج به من هذا الاجتماع؟" : "What should we leave this meeting with?"} /></label></div><div className="form-card"><div className="form-card-title"><span className="number-chip">٠٣</span><div><h3>{copy.notes}</h3><p>{isArabic ? "أفكار سريعة تبقى معك أثناء الحديث." : "Quick thoughts to keep close during the conversation."}</p></div></div><label><Textarea value={activeMeeting.note} onChange={(event) => updateMeeting("note", event.target.value)} rows={3} placeholder={isArabic ? "أضف ملاحظة خاصة بك..." : "Add a private note..."} /></label></div></div>
            <div className="editor-column"><div className="form-card agenda-card"><div className="form-card-title"><span className="number-chip accent">٠٤</span><div><h3>{copy.agenda}</h3><p>{isArabic ? "رتّب المحاور بحسب تسلسل المحادثة." : "Order topics in the flow of the conversation."}</p></div><span className="item-count">{activeMeeting.agenda.length} {isArabic ? "مواضيع" : "topics"}</span></div><div className="agenda-items">{activeMeeting.agenda.map((item, index) => <div className="agenda-item" key={`${item.title}-${index}`}><div className="agenda-item-head"><span className="agenda-index">{formatAgendaIndex(index)}</span><Input value={item.title} onChange={(event) => updateAgenda(index, "title", event.target.value)} /><div className="reorder-controls"><button className="delete-button" onClick={() => moveAgenda(index, -1)} disabled={index === 0} aria-label={isArabic ? "تحريك الموضوع لأعلى" : "Move topic up"}><ChevronUp size={14} /></button><button className="delete-button" onClick={() => moveAgenda(index, 1)} disabled={index === activeMeeting.agenda.length - 1} aria-label={isArabic ? "تحريك الموضوع لأسفل" : "Move topic down"}><ChevronDown size={14} /></button><button className="delete-button" onClick={() => removeAgenda(index)} aria-label={isArabic ? "حذف الموضوع" : "Delete topic"}><Trash2 size={16} /></button></div></div><Input value={item.context} onChange={(event) => updateAgenda(index, "context", event.target.value)} placeholder={isArabic ? "السياق أو الخلفية" : "Context or background"} /><Input value={item.goal} onChange={(event) => updateAgenda(index, "goal", event.target.value)} placeholder={isArabic ? "الهدف من مناقشته" : "Goal for discussing it"} /></div>)}</div><button className="add-topic" onClick={addAgenda}><Plus size={17} /> {isArabic ? "إضافة موضوع" : "Add topic"}</button></div><div className="form-card"><div className="form-card-title"><span className="number-chip">٠٥</span><div><h3>{copy.external}</h3><p>{isArabic ? "أضف رابطًا يساعدك على العودة للمادة الأصلية." : "Keep a link back to the source material."}</p></div></div><label>{copy.image}<div className="link-input"><ImageIcon size={17} /><Input value={activeMeeting.image} onChange={(event) => updateMeeting("image", event.target.value)} placeholder="https://…" />{activeMeeting.image && <a href={activeMeeting.image} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}</div><span className="field-hint">{copy.imageHint}</span></label><div className="link-input"><Link2 size={17} /><Input value={activeMeeting.link} onChange={(event) => updateMeeting("link", event.target.value)} placeholder="https://notion.so/..." />{activeMeeting.link && <a href={activeMeeting.link} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}</div></div><div className="form-card action-card"><div className="form-card-title"><span className="number-chip">٠٦</span><div><h3>{copy.actions}</h3><p>{isArabic ? "أشياء تريد التأكد من حضورها في النقاش." : "Items you want to make sure the conversation covers."}</p></div></div>{activeMeeting.actions.map((action, index) => <div className="action-row" key={`${action}-${index}`}><span className="action-check"><Check size={13} /></span><Input value={action} onChange={(event) => updateMeeting("actions", activeMeeting.actions.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} /><div className="reorder-controls"><button className="delete-button" onClick={() => moveAction(index, -1)} disabled={index === 0} aria-label={isArabic ? "تحريك نقطة المتابعة لأعلى" : "Move follow-up up"}><ChevronUp size={14} /></button><button className="delete-button" onClick={() => moveAction(index, 1)} disabled={index === activeMeeting.actions.length - 1} aria-label={isArabic ? "تحريك نقطة المتابعة لأسفل" : "Move follow-up down"}><ChevronDown size={14} /></button><button className="delete-button" onClick={() => updateMeeting("actions", activeMeeting.actions.filter((_, itemIndex) => itemIndex !== index))} aria-label={isArabic ? "حذف نقطة المتابعة" : "Delete follow-up"}><X size={16} /></button></div></div>)}<button className="add-action" onClick={() => updateMeeting("actions", [...activeMeeting.actions, isArabic ? "نقطة متابعة جديدة" : "New follow-up"])}><Plus size={16} /> {isArabic ? "إضافة نقطة" : "Add follow-up"}</button></div></div></div>
        </section>
      </main>
    </div>
  );
}


function UiSettingsPanel({ language, settings, update, reset, close }: {
  language: "ar" | "en";
  settings: UiSettings;
  update: <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => void;
  reset: () => void;
  close: () => void;
}) {
  const isArabic = language === "ar";
  return <section className="ui-settings-panel" aria-label={isArabic ? "تخصيص الواجهة" : "Interface customization"}>
    <div className="ui-settings-head"><div><strong>{isArabic ? "تخصيص الواجهة" : "Customize interface"}</strong><p>{isArabic ? "كثافة المساحة وصفحة الاجتماع." : "Density of the workspace and the meeting page."}</p></div><button className="settings-close" onClick={close} aria-label={isArabic ? "إغلاق" : "Close"}><X size={16} /></button></div>
    {/* Theme is back because there is now a stylesheet behind it: `navy` is a
        real token scope in the design system, not a stored preference that
        changes nothing. Accent stays out — it is rationed by design. */}
    <SettingGroup label={isArabic ? "مظهر المساحة" : "Workspace theme"} options={[{ value: "ink", label: isArabic ? "حبري" : "Ink" }, { value: "navy", label: isArabic ? "كحلي" : "Navy" }]} selected={settings.theme} onSelect={(value) => update("theme", value as UiSettings["theme"])} />
    <SettingGroup label={isArabic ? "كثافة المحتوى" : "Density"} options={[{ value: "comfortable", label: isArabic ? "مريح" : "Comfortable" }, { value: "compact", label: isArabic ? "مضغوط" : "Compact" }]} selected={settings.density} onSelect={(value) => update("density", value as UiSettings["density"])} />
    <SettingGroup label={isArabic ? "كثافة العرض" : "Display density"} options={[{ value: "standard", label: isArabic ? "قياسي" : "Standard" }, { value: "compact", label: isArabic ? "مضغوط" : "Compact" }]} selected={settings.displayScale} onSelect={(value) => update("displayScale", value as UiSettings["displayScale"])} />
    <button className="settings-reset" onClick={reset}>{isArabic ? "إعادة الإعدادات الافتراضية" : "Reset defaults"}</button>
  </section>;
}

function SettingGroup({ label, options, selected, onSelect }: { label: string; options: Array<{ value: string; label: string }>; selected: string; onSelect: (value: string) => void }) {
  return <div className="settings-group"><span>{label}</span><div className="settings-options">{options.map((option) => <button key={option.value} className={selected === option.value ? "selected" : ""} onClick={() => onSelect(option.value)}>{option.label}</button>)}</div></div>;
}

/**
 * The preparation rail: five steps, each a question with a worked example.
 * It replaces "fill these boxes" with "here is what to answer next", and shows
 * how far along you are so the work reads as progress rather than paperwork.
 */
function PrepareRail({ meeting, language }: { meeting: MeetingRecord; language: "ar" | "en" }) {
  const isArabic = language === "ar";
  const done = completedSteps(meeting);
  const next = nextStep(meeting);
  const icons = { "calendar-clock": CalendarClock, target: Target, list: List, users: Users, check: Check } as const;

  return (
    <section className="prepare-rail">
      <div className="prepare-rail-head">
        <div>
          <p className="section-kicker">{isArabic ? "التحضير" : "PREPARATION"}</p>
          <h3>{next ? (isArabic ? next.question.ar : next.question.en) : (isArabic ? "الاجتماع جاهز." : "The meeting is ready.")}</h3>
          {next && <p className="prepare-example">{isArabic ? next.example.ar : next.example.en}</p>}
        </div>
        <span className="prepare-count">{isArabic ? `${toArabicDigits(done)} من ${toArabicDigits(PREPARE_STEPS.length)}` : `${done} of ${PREPARE_STEPS.length}`}</span>
      </div>

      <ol className="prepare-steps">
        {PREPARE_STEPS.map((step) => {
          const Icon = icons[step.icon];
          const isDone = step.done(meeting);
          const isNext = next?.id === step.id;
          return (
            <li key={step.id} className={`prepare-step ${isDone ? "done" : ""} ${isNext ? "next" : ""}`}>
              <span className="prepare-step-mark">{isDone ? <Check size={14} /> : <Icon size={14} />}</span>
              <span className="prepare-step-title">{isArabic ? step.title.ar : step.title.en}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Free-text intake.
 *
 * Built and wired to the workspace, but disabled: turning a paragraph into a
 * structured meeting needs a model, and no provider is configured. Everything
 * except that call is in place, so enabling it is one procedure away — see
 * the note in the panel.
 */
function IntakeBox({ language }: { language: "ar" | "en" }) {
  const isArabic = language === "ar";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <section className="intake-box">
      <button className="intake-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Sparkles size={16} />
        <span>{isArabic ? "الصق تفاصيل الاجتماع ودع واف ينسّقها" : "Paste the meeting details and let Waf structure them"}</span>
        <span className="intake-badge">{isArabic ? "قريبًا" : "SOON"}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="intake-body">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            placeholder={isArabic
              ? "اكتب أو الصق كل ما لديك: العنوان، الموعد، من يحضر، ما تريد مناقشته، وما يجب الخروج به. لا يهم الترتيب."
              : "Write or paste whatever you have: title, timing, who attends, what to discuss, what to leave with. Order does not matter."}
          />
          <div className="intake-actions">
            <p className="intake-note">
              {isArabic
                ? "التنسيق التلقائي يحتاج ربطًا بمزوّد ذكاء اصطناعي. الواجهة جاهزة — ينقص مفتاح المزوّد فقط."
                : "Structuring needs an AI provider. The interface is ready; only the provider key is missing."}
            </p>
            <button className="primary-button" disabled title={isArabic ? "غير مفعّل بعد" : "Not enabled yet"}>
              {isArabic ? "نسّق الاجتماع" : "Structure it"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The stage — what you read on your own screen while the meeting runs.
 *
 * Deliberately unlike the console: a light document on the `.waf-stage` scope.
 * Nothing paginates and nothing truncates, because the whole point is having
 * the context, the goal, the follow-ups and your notes in front of you at once.
 */
function DisplayMode({ meeting, onBack, onRefresh, onUpdateAgenda, copy, language }: {
  meeting: MeetingRecord;
  onBack: () => void;
  onRefresh: () => void;
  onUpdateAgenda: (index: number, field: "decision" | "owner", value: string) => void;
  copy: { back: string; refresh: string; fullScreen: string; exitFullScreen: string; pdf: string; pdfHint: string; goal: string; topics: string; actions: string; notes: string; attendees: string };
  language: "ar" | "en";
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [covered, setCovered] = useState<Set<number>>(new Set());
  const [activeTopic, setActiveTopic] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const isArabic = language === "ar";

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Ticks only while running, so a page left open overnight shows nothing odd.
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenEnabled) {
      toast.info(isArabic ? "ملء الشاشة غير متاح في هذا المتصفح" : "Full screen is not available in this browser");
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error(isArabic ? "تعذر فتح ملء الشاشة" : "Could not open full screen");
    }
  };

  /**
   * Hand the meeting over as a PDF.
   *
   * This is the browser's own print pipeline rather than a canvas exporter:
   * nothing is rasterised, so the Arabic keeps its shaping and the text in the
   * saved file stays selectable, searchable and copyable. The only lever a
   * browser gives us over the saved name is document.title, so it is swapped
   * for the length of the job and put back after.
   */
  const downloadPdf = () => {
    const original = document.title;
    document.title = meetingFileName(meeting, language);

    const restore = () => {
      document.title = original;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    // Some browsers never fire afterprint if the dialog is dismissed with Esc.
    window.setTimeout(restore, 60_000);

    toast.info(copy.pdfHint);
    // A frame, so the hint has painted before the dialog blocks the page.
    window.setTimeout(() => window.print(), 120);
  };

  const toggleCovered = (index: number) => {
    setCovered((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else {
        next.add(index);
        // Move focus to the first topic still open.
        const following = meeting.agenda.findIndex((_, i) => i !== index && !next.has(i));
        if (following !== -1) setActiveTopic(following);
      }
      return next;
    });
  };

  const clock = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    const value = `${minutes}:${seconds}`;
    return isArabic ? toArabicDigits(value) : value;
  };

  const settings = readUiSettings();
  const empty = (text: string) => <p className="stage-empty">{text}</p>;
  const progress = meeting.agenda.length ? Math.round((covered.size / meeting.agenda.length) * 100) : 0;

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className={`display-shell waf-stage display-${settings.displayScale}`}>
      <header className="display-toolbar">
        <button className="display-back" onClick={onBack}><ArrowLeft size={15} /> {copy.back}</button>
        <div className="display-brand">واف<span className="display-divider" /><span className="display-brand-sub">{isArabic ? "صفحة الاجتماع" : "Meeting page"}</span></div>
        <div className="display-toolbar-actions">
          <button className={`display-tool ${startedAt !== null ? "running" : ""}`} onClick={() => setStartedAt(startedAt === null ? Date.now() : null)}>
            {startedAt === null ? <Play size={15} /> : <Pause size={15} />}
            <span>{startedAt === null ? (isArabic ? "ابدأ" : "Start") : clock(elapsed)}</span>
          </button>
          <button className="display-tool" onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />} <span>{isFullscreen ? copy.exitFullScreen : copy.fullScreen}</span></button>
          <button className="display-tool" onClick={downloadPdf}><Download size={15} /> <span>{copy.pdf}</span></button>
          <button className="display-tool" onClick={onRefresh}><Copy size={15} /> <span>{copy.refresh}</span></button>
        </div>
      </header>

      {/* Live progress across the agenda — the sense of moving through a meeting. */}
      {meeting.agenda.length > 0 && (
        <div className="stage-progress">
          <div className="stage-progress-rail">
            {meeting.agenda.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                className={`stage-progress-seg ${covered.has(index) ? "covered" : ""} ${activeTopic === index ? "active" : ""}`}
                onClick={() => setActiveTopic(index)}
                aria-label={`${formatAgendaIndex(index)} ${item.title}`}
              />
            ))}
          </div>
          <span className="stage-progress-count">
            {isArabic
              ? `${toArabicDigits(covered.size)}/${toArabicDigits(meeting.agenda.length)} · ${toArabicDigits(progress)}٪`
              : `${covered.size}/${meeting.agenda.length} · ${progress}%`}
          </span>
        </div>
      )}

      <main className="stage-page">
        <div className="stage-eyebrow"><span className="selected-dot" />{meeting.type}</div>
        <h1 className="stage-title">{meeting.title}</h1>

        {meeting.image && (
          <figure className="stage-image">
            {/* Referenced by URL; a broken link should not break the page. */}
            <img src={meeting.image} alt="" loading="lazy" onError={(event) => { (event.currentTarget.closest("figure") as HTMLElement).style.display = "none"; }} />
          </figure>
        )}

        <div className="stage-meta">
          <span><CalendarDays size={15} />{meeting.date}</span>
          <span><Clock3 size={15} />{meeting.time || (isArabic ? "الوقت غير محدد" : "Time not set")}</span>
          <span><Users size={15} />{meeting.attendees.length ? meeting.attendees.join(isArabic ? "، " : ", ") : (isArabic ? "لم تتم إضافة الحضور" : "No attendees yet")}</span>
        </div>

        <section className="stage-purpose">
          <span className="stage-label"><Target size={14} /> {copy.goal}</span>
          {meeting.summary ? <p>{meeting.summary}</p> : empty(isArabic ? "لم يُضف ملخص بعد." : "No summary yet.")}
        </section>

        <section className="stage-section">
          <span className="stage-label"><FileText size={14} /> {copy.topics}</span>
          {meeting.agenda.length === 0
            ? empty(isArabic ? "لا محاور بعد." : "No topics yet.")
            : (
              <div className="stage-agenda">
                {meeting.agenda.map((item, index) => (
                  <article
                    className={`stage-point ${covered.has(index) ? "covered" : ""} ${activeTopic === index ? "active" : ""}`}
                    key={`${item.title}-${index}`}
                    onFocus={() => setActiveTopic(index)}
                  >
                    <span className="stage-number">{formatAgendaIndex(index)}</span>
                    <div>
                      <div className="stage-point-head">
                        <h3>{item.title}</h3>
                        <button
                          className={`stage-cover ${covered.has(index) ? "on" : ""}`}
                          onClick={() => toggleCovered(index)}
                          aria-pressed={covered.has(index)}
                        >
                          {covered.has(index) ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                          <span>{covered.has(index) ? (isArabic ? "نوقش" : "Covered") : (isArabic ? "علّم كمنجز" : "Mark covered")}</span>
                        </button>
                      </div>

                      {item.context && <p className="stage-context">{item.context}</p>}
                      {item.goal && (
                        <span className="stage-goal">
                          <b>{isArabic ? "نريد الخروج بـ" : "Leave with"}</b>
                          {item.goal}
                        </span>
                      )}

                      {/* Written while the topic is live; saved with the meeting. */}
                      <div className="stage-decision">
                        <label>
                          <span>{isArabic ? "القرار" : "Decision"}</span>
                          <Input
                            value={item.decision}
                            placeholder={isArabic ? "ما الذي اتُّفق عليه؟" : "What was agreed?"}
                            onChange={(event) => onUpdateAgenda(index, "decision", event.target.value)}
                          />
                          {/* An input prints as an empty box; this prints the value typed into it. Print only. */}
                          <p className="stage-print-value">{item.decision || "—"}</p>
                        </label>
                        <label className="stage-owner">
                          <span>{isArabic ? "المسؤول" : "Owner"}</span>
                          <Input
                            value={item.owner}
                            placeholder={isArabic ? "من ينفّذه؟" : "Who owns it?"}
                            onChange={(event) => onUpdateAgenda(index, "owner", event.target.value)}
                          />
                          <p className="stage-print-value">{item.owner || "—"}</p>
                        </label>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>

        <div className="stage-columns">
          <section className="stage-block">
            <span className="stage-label"><Check size={14} /> {copy.actions}</span>
            {meeting.actions.length === 0
              ? empty(isArabic ? "لا نقاط متابعة." : "No follow-ups.")
              : (
                <ul className="stage-actions">
                  {meeting.actions.map((action, index) => (
                    <li key={`${action}-${index}`}><span className="stage-checkbox" />{action}</li>
                  ))}
                </ul>
              )}
          </section>

          <section className="stage-block">
            <span className="stage-label"><Sparkles size={14} /> {copy.notes}</span>
            {meeting.note ? <p className="stage-note">{meeting.note}</p> : empty(isArabic ? "لا ملاحظات." : "No notes.")}
          </section>
        </div>

        <footer className="stage-footer">
          <span>واف</span>
          {meeting.link && <a href={meeting.link} target="_blank" rel="noreferrer">{isArabic ? "المرجع الخارجي" : "External reference"}</a>}
        </footer>
      </main>
    </div>
  );
}
