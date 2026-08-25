import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Link2,
  Maximize2,
  Menu,
  Minimize2,
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
import type { MeetingRecord } from "@shared/meeting-store";


type UiSettings = { theme: "light" | "sand" | "night"; accent: "sage" | "blue" | "plum"; density: "comfortable" | "compact"; displayScale: "standard" | "compact" };
const DEFAULT_UI_SETTINGS: UiSettings = { theme: "light", accent: "sage", density: "comfortable", displayScale: "standard" };
const accentColors: Record<UiSettings["accent"], string> = { sage: "#2e7563", blue: "#356f91", plum: "#79536d" };
function readUiSettings(): UiSettings {
  try { const stored = { ...DEFAULT_UI_SETTINGS, ...JSON.parse(localStorage.getItem("meeting-prep-ui") ?? "{}") } as UiSettings; const params = new URLSearchParams(window.location.search); return params.get("displayDensity") === "compact" ? { ...stored, displayScale: "compact" } : stored; } catch { return DEFAULT_UI_SETTINGS; }
}

const statusTone: Record<string, string> = {
  "جاهز للعرض": "bg-[#e9f5ef] text-[#2b7254] border-[#cbe6d7]",
  مسودة: "bg-[#f5f1e8] text-[#917544] border-[#e8ddc9]",
  "تم الاجتماع": "bg-[#eff1f4] text-[#6b7280] border-[#dfe3e8]",
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
  };
}

const templates = [
  {
    id: "internal",
    ar: "اجتماع داخلي",
    en: "Internal sync",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "اجتماع داخلي جديد", date: "اختر التاريخ", time: "اختر الوقت", type: "داخلي", status: "مسودة", attendees: [], summary: "ما النتيجة التي نحتاج إلى الخروج بها؟", agenda: [{ title: "المستجدات", context: "ما الذي تغيّر منذ آخر اجتماع؟", goal: "تحديد الأولوية التالية." }], actions: ["تحديد الخطوة التالية"], note: "", link: "" }
      : { title: "New internal sync", date: "Choose a date", time: "Choose a time", type: "Internal", status: "مسودة", attendees: [], summary: "What outcome do we need from this meeting?", agenda: [{ title: "Updates", context: "What changed since the last meeting?", goal: "Choose the next priority." }], actions: ["Confirm the next step"], note: "", link: "" },
  },
  {
    id: "partner",
    ar: "اجتماع شريك",
    en: "Partner review",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "مراجعة مع شريك", date: "اختر التاريخ", time: "اختر الوقت", type: "مع شريك تأميني", status: "مسودة", attendees: [], summary: "ما القرار أو الالتزام المطلوب من الطرفين؟", agenda: [{ title: "الهدف المشترك", context: "تأكيد ما نريد تحقيقه معًا.", goal: "الاتفاق على نتيجة قابلة للقياس." }, { title: "الخطوات التالية", context: "المواعيد والمالكون المقترحون.", goal: "تثبيت المسؤوليات والموعد." }], actions: ["تأكيد المالك والموعد"], note: "", link: "" }
      : { title: "Partner review", date: "Choose a date", time: "Choose a time", type: "Partner", status: "مسودة", attendees: [], summary: "What decision or commitment is needed from both sides?", agenda: [{ title: "Shared objective", context: "Confirm what we want to achieve together.", goal: "Agree on a measurable outcome." }, { title: "Next steps", context: "Suggested owners and dates.", goal: "Confirm ownership and timing." }], actions: ["Confirm owner and date"], note: "", link: "" },
  },
  {
    id: "leadership",
    ar: "اجتماع قيادة",
    en: "Leadership review",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "مراجعة فريق القيادة", date: "اختر التاريخ", time: "اختر الوقت", type: "إدارة", status: "مسودة", attendees: [], summary: "ما القرارات التي يجب حسمها اليوم؟", agenda: [{ title: "صورة سريعة", context: "أهم المؤشرات والمخاطر.", goal: "تمييز ما يحتاج إلى قرار." }, { title: "قرارات مفتوحة", context: "المفاضلات والخيارات المتاحة.", goal: "الخروج بقرار ومالك واضح." }], actions: ["تجهيز ملخص القرار"], note: "", link: "" }
      : { title: "Leadership review", date: "Choose a date", time: "Choose a time", type: "Leadership", status: "مسودة", attendees: [], summary: "Which decisions must be made today?", agenda: [{ title: "Quick picture", context: "Key signals and risks.", goal: "Identify what needs a decision." }, { title: "Open decisions", context: "Trade-offs and available options.", goal: "Leave with a clear decision and owner." }], actions: ["Prepare decision brief"], note: "", link: "" },
  },
  {
    id: "general",
    ar: "اجتماع عام",
    en: "General meeting",
    build: (language: "ar" | "en"): Omit<MeetingRecord, "id"> => language === "ar"
      ? { title: "اجتماع جديد", date: "اختر التاريخ", time: "اختر الوقت", type: "أخرى", status: "مسودة", attendees: [], summary: "ما الغرض الأساسي من هذا الاجتماع؟", agenda: [{ title: "تحديد الهدف", context: "اكتب الخلفية التي يحتاجها الحضور.", goal: "الاتفاق على النتيجة المطلوبة." }], actions: ["تأكيد الخطوة التالية"], note: "", link: "" }
      : { title: "New meeting", date: "Choose a date", time: "Choose a time", type: "Other", status: "مسودة", attendees: [], summary: "What is the main purpose of this meeting?", agenda: [{ title: "Set the goal", context: "Add the context attendees need.", goal: "Agree on the desired outcome." }], actions: ["Confirm the next step"], note: "", link: "" },
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
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).get("customize") === "1");
  const [location] = useLocation();
  const copy = language === "ar"
    ? { dashboard: "مركز التحكم", intro: "اجتماعاتك، بوضوح.", introSub: "حضّر الفكرة، رتّب النقاش، ثم اعرضه بثقة.", newMeeting: "اجتماع جديد", edit: "وضع التحرير", display: "وضع العرض", basics: "المعلومات الأساسية", summary: "الملخص التنفيذي", notes: "ملاحظاتك التحضيرية", agenda: "مواضيع النقاش", external: "مرجع خارجي", actions: "نقاط متابعة", save: "حفظ التغييرات", back: "العودة للتحرير", refresh: "تحديث العرض", fullScreen: "ملء الشاشة", exitFullScreen: "الخروج من ملء الشاشة", goal: "الهدف من الجلسة", topics: "محاور النقاش", title: "عنوان الاجتماع", date: "التاريخ", time: "الوقت", type: "نوع الاجتماع", attendees: "الحضور", hint: "افصل بين الأسماء بفاصلة", search: "ابحث...", noResults: "لا توجد نتائج", noResultsHint: "جرّب كلمة بحث مختلفة.", loading: "نجهّز مساحتك...", loadingHint: "لحظات ونعود إلى اجتماعاتك.", connected: "Notion متصل", syncing: "جاري المزامنة...", retry: "إعادة المحاولة", templates: "ابدأ بقالب", meetings: "الاجتماعات", meetingsHint: "اختر اجتماعًا للمتابعة أو التحضير.", active: "الاجتماع النشط", archive: "أرشفة الاجتماع", archiveConfirm: "سيُنقل هذا الاجتماع إلى أرشيف Notion. يمكنك استعادته من سلة المحذوفات هناك.", cancel: "إلغاء", emptyTitle: "لا توجد اجتماعات بعد", emptyHint: "قاعدة Notion متصلة لكنها فارغة. ابدأ بقالب وسيُنشأ الاجتماع مباشرة في Notion." }
    : { dashboard: "Dashboard", intro: "Your meetings, clearly.", introSub: "Prepare the idea, structure the discussion, and present with confidence.", newMeeting: "New meeting", edit: "Edit mode", display: "Display mode", basics: "Meeting basics", summary: "Executive summary", notes: "Preparation notes", agenda: "Discussion topics", external: "External reference", actions: "Follow-ups", save: "Save changes", back: "Back to edit", refresh: "Refresh view", fullScreen: "Full screen", exitFullScreen: "Exit full screen", goal: "Meeting goal", topics: "Discussion topics", title: "Meeting title", date: "Date", time: "Time", type: "Meeting type", attendees: "Attendees", hint: "Separate names with commas", search: "Search...", noResults: "No results", noResultsHint: "Try a different search.", loading: "Preparing your workspace...", loadingHint: "We’ll be right back.", connected: "Notion connected", syncing: "Syncing from Notion...", retry: "Retry", templates: "Start from a template", meetings: "Meetings", meetingsHint: "Select a meeting to review or prepare.", active: "Active meeting", archive: "Archive meeting", archiveConfirm: "This meeting moves to the Notion archive. You can restore it from the trash there.", cancel: "Cancel", emptyTitle: "No meetings yet", emptyHint: "Notion is connected but empty. Start from a template and the meeting is created directly in Notion." };
  const isDisplay = location === "/display";
  const isArabic = language === "ar";
  const utils = trpc.useUtils();
  // Notion is the source of truth, so this query always runs.
  const notionQuery = trpc.meetings.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const notionUpdate = trpc.meetings.update.useMutation();
  const notionCreate = trpc.meetings.create.useMutation();
  const notionRemove = trpc.meetings.remove.useMutation();
  // No sample fallback: when there is nothing in Notion there is nothing to show.
  const activeMeeting: MeetingRecord | undefined = meetings.find((meeting) => meeting.id === activeId) ?? meetings[0];
  const notionMeetings = notionQuery.data?.meetings ?? [];
  const isActiveNotionMeeting = Boolean(activeMeeting) && notionMeetings.some((meeting) => meeting.id === activeMeeting?.id);
  const notionHasError = connectionError || notionQuery.isError;
  const workspaceLoading = isLoading || notionQuery.isLoading;
  // There is no prototype mode any more — Notion is the only source, so the
  // pill reports the real connection state instead of a third fake one.
  const syncLabel = notionHasError
    ? (isArabic ? "تعذر الاتصال بـ Notion" : "Notion connection error")
    : notionQuery.isSuccess
      ? copy.connected
      : copy.syncing;

  useEffect(() => {
    localStorage.setItem("meeting-prep-ui", JSON.stringify(uiSettings));
  }, [uiSettings]);

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

  const filteredMeetings = useMemo(() => meetings.filter((meeting) => meeting.title.toLowerCase().includes(query.toLowerCase()) || meeting.type.toLowerCase().includes(query.toLowerCase())), [meetings, query]);

  const updateMeeting = (field: keyof MeetingRecord, value: unknown) => {
    setSaved(false);
    setMeetings((current) => current.map((meeting) => meeting.id === activeId ? { ...meeting, [field]: value } : meeting));
  };
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
  if (isDisplay && activeMeeting) return <DisplayMode meeting={activeMeeting} onBack={() => window.history.back()} onRefresh={() => toast.success(copy.refresh)} copy={copy} language={language} />;
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
  const resetUiSettings = () => setUiSettings(DEFAULT_UI_SETTINGS);
  const uiStyle = { "--ui-accent": accentColors[uiSettings.accent] } as React.CSSProperties;

  return (
    <div dir={isArabic ? "rtl" : "ltr"} style={uiStyle} className={`workspace-shell density-${uiSettings.density} theme-${uiSettings.theme} min-h-screen bg-[#f7f8f8] text-[#243438]`}>
      <aside className="workspace-sidebar hidden lg:flex">
        <div className="brand-lockup"><div className="brand-mark"><Sparkles size={17} /></div><div><p className="brand-title">جلسة</p><p className="brand-subtitle">مساحة تحضير الاجتماعات</p></div></div>
        <div className="sidebar-section-label">{isArabic ? "مساحة العمل" : "Workspace"}</div>
        <nav className="sidebar-nav"><button className="sidebar-item active"><LayoutDashboard size={18} /><span>{copy.meetings}</span><span className="nav-count">{meetings.length}</span></button><button className="sidebar-item"><FileText size={18} /><span>{isArabic ? "الملاحظات المحفوظة" : "Saved notes"}</span></button></nav>
        <div className="sidebar-spacer" />
        <div className={`notion-card ${notionHasError ? "connection-error" : ""}`}>
          <div className="notion-icon">N</div><div><p className="notion-title">{notionHasError ? (isArabic ? "تعذر الاتصال بـ Notion" : "Notion connection error") : syncLabel}</p><p className="notion-caption">{notionHasError ? (isArabic ? "تحقق من الاتصال ثم أعد المحاولة" : "Check the connection and retry") : (isArabic ? "تقرأ من قاعدة Meeting Prep وتكتب فيها" : "Reading from and writing to Meeting Prep")}</p></div>
          {notionHasError ? <button className="retry-button" onClick={retryConnection}>{copy.retry}</button> : <button className="connection-trigger" onClick={() => setConnectionError(true)} aria-label={isArabic ? "اختبار الاتصال" : "Test connection"}><CircleHelp size={15} /></button>}
        </div>
        <div className="profile-row"><div className="avatar">م</div><div><p className="profile-name">{isArabic ? "مالك المساحة" : "Workspace owner"}</p><p className="profile-role">{isArabic ? "المساحة الشخصية" : "Personal workspace"}</p></div><MoreHorizontal size={18} className="mr-auto text-[#8a9895]" /></div>
      </aside>

      <main className="workspace-main">
        <header className="topbar"><div className="flex items-center gap-3"><button className="mobile-menu lg:hidden"><Menu size={20} /></button><div><p className="eyebrow">{isArabic ? "الثلاثاء، ٢٧ أغسطس ٢٠٢٦" : "Tuesday, August 27, 2026"}</p><h1 className="page-title">{isArabic ? "صباح الخير، مالك" : "Good morning, owner"}</h1></div></div><div className="topbar-actions"><div className="sync-pill"><span className="sync-dot" /> {syncLabel}</div><button className="help-button" onClick={() => setSettingsOpen((open) => !open)} aria-label={isArabic ? "تخصيص الواجهة" : "Customize interface"}><Settings2 size={18} /></button><div className="avatar small">م</div></div></header>
        {settingsOpen && <UiSettingsPanel language={language} settings={uiSettings} update={updateUiSetting} reset={resetUiSettings} close={() => setSettingsOpen(false)} />}
        <section className="dashboard-intro"><div><p className="section-kicker">{copy.dashboard}</p><h2>{copy.intro}</h2><p>{copy.introSub}</p></div><div className="intro-actions"><button className="language-toggle" onClick={() => setLanguage(isArabic ? "en" : "ar")}>{isArabic ? "EN" : "عربي"}</button><button className="primary-button" disabled={notionCreate.isPending} onClick={() => createMeeting(blankMeeting(language))}><Plus size={18} /> {copy.newMeeting}</button></div></section>
        <section className="template-strip"><div className="template-strip-label"><Sparkles size={15} /><span>{copy.templates}</span></div><div className="template-buttons">{templates.map((template) => <button key={template.id} className="template-button" onClick={() => createFromTemplate(template)}>{isArabic ? template.ar : template.en}</button>)}</div></section>
        <section className="stats-grid"><div className="stat-card"><div className="stat-icon sage"><CalendarDays size={19} /></div><div><p>{isArabic ? "الاجتماعات القادمة" : "Upcoming meetings"}</p><strong>{String(meetings.length).padStart(2, "٠")}</strong></div><span className="stat-trend">{isArabic ? "هذا الأسبوع" : "This week"}</span></div><div className="stat-card"><div className="stat-icon amber"><Clock3 size={19} /></div><div><p>{isArabic ? "تحتاج تحضيرًا" : "Need preparation"}</p><strong>{String(meetings.filter((meeting) => meeting.status === "مسودة").length).padStart(2, "٠")}</strong></div><span className="stat-trend warm">{isArabic ? "بانتظارك" : "Waiting"}</span></div><div className="stat-card"><div className="stat-icon blue"><Presentation size={19} /></div><div><p>{isArabic ? "جاهزة للعرض" : "Ready to present"}</p><strong>{String(meetings.filter((meeting) => meeting.status === "جاهز للعرض").length).padStart(2, "٠")}</strong></div><span className="stat-trend">{isArabic ? "مكتملة" : "Complete"}</span></div></section>

        <section className="content-grid"><div className="meetings-panel panel-card"><div className="panel-heading"><div><h3>{copy.meetings}</h3><p>{copy.meetingsHint}</p></div><div className="meeting-tools"><div className="search-field"><Search size={16} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} /></div><button className="icon-button"><MoreHorizontal size={18} /></button></div></div><div className="meeting-list">{filteredMeetings.length === 0 ? <div className="empty-state"><CalendarDays size={26} /><h4>{copy.noResults}</h4><p>{copy.noResultsHint}</p></div> : filteredMeetings.map((meeting) => <button key={meeting.id} onClick={() => setActiveId(meeting.id)} className={`meeting-row ${meeting.id === activeId ? "selected" : ""}`}><div className="meeting-date"><span>{meeting.date.split("،")[0]}</span><strong>{meeting.date.split("،")[1] ?? meeting.date}</strong></div><div className="meeting-row-main"><div className="meeting-row-title"><h4>{meeting.title}</h4><Badge className={`status-badge ${statusTone[meeting.status] ?? statusTone.مسودة}`}>{translateStatus(meeting.status, language)}</Badge></div><p>{meeting.time || (isArabic ? "الوقت غير محدد" : "Time not set")} <span>·</span> {meeting.type}</p></div><ChevronLeft size={18} className="row-arrow" /></button>)}</div></div>
          <div className="selected-card panel-card"><div className="selected-card-top"><span className="selected-label"><span className="selected-dot" /> {copy.active}</span><button className="icon-button" onClick={() => setPendingDelete(activeMeeting.id)} disabled={!isActiveNotionMeeting || notionRemove.isPending} title={copy.archive} aria-label={copy.archive}><Trash2 size={17} /></button></div>{pendingDelete === activeMeeting.id && <div className="delete-confirm"><p>{copy.archiveConfirm}</p><div className="delete-confirm-actions"><button className="secondary-button" onClick={() => setPendingDelete(null)}>{copy.cancel}</button><button className="danger-button" onClick={() => { deleteMeeting(activeMeeting.id); setPendingDelete(null); }}>{copy.archive}</button></div></div>}<h3>{activeMeeting.title}</h3><p className="selected-meta"><CalendarDays size={15} /> {activeMeeting.date}</p><p className="selected-meta"><Clock3 size={15} /> {activeMeeting.time || (isArabic ? "الوقت غير محدد" : "Time not set")} · {activeMeeting.type}</p><p className="selected-meta"><Users size={15} /> {activeMeeting.attendees.length ? activeMeeting.attendees.join(isArabic ? "، " : ", ") : (isArabic ? "لم تتم إضافة الحضور" : "No attendees yet")}</p><div className="selected-divider" /><div className="selected-progress"><div className="flex items-center justify-between"><span>{isArabic ? "جاهزية الاجتماع" : "Meeting readiness"}</span><strong>{`${getMeetingReadiness(activeMeeting.status)}٪`}</strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${getMeetingReadiness(activeMeeting.status)}%` }} /></div></div><Link href="/display" className="display-cta"><Presentation size={17} /> {copy.display} <ArrowLeft size={16} /></Link></div></section>

        <section className="editor-section"><div className="mode-tabs"><button className="mode-tab active"><FileText size={17} /> {copy.edit}</button><Link href="/display" className="mode-tab"><Presentation size={17} /> {copy.display}</Link><span className="mode-note"><span className="sync-dot" /> {syncLabel}</span></div><div className="editor-header"><div><p className="section-kicker">{copy.edit}</p><h2>{activeMeeting.title}</h2><p>{isArabic ? "رتّب أفكارك قبل أن تبدأ المحادثة." : "Structure your thinking before the conversation starts."}</p></div><div className="editor-actions"><span className={`save-status ${saved ? "" : "unsaved"}`}>{saved ? <><Check size={15} /> {isArabic ? "محفوظ" : "Saved"}</> : (isArabic ? "تغييرات غير محفوظة" : "Unsaved changes")}</span><button className="secondary-button" onClick={saveMeeting} disabled={notionUpdate.isPending}><Save size={16} /> {notionUpdate.isPending ? (isArabic ? "جارٍ الحفظ" : "Saving") : copy.save}</button></div></div>
          <div className="editor-layout"><div className="editor-column"><div className="form-card"><div className="form-card-title"><span className="number-chip">٠١</span><div><h3>{copy.basics}</h3><p>{isArabic ? "التفاصيل التي ستظهر في بداية العرض." : "The details shown at the start of the presentation."}</p></div></div><label>{copy.title}<Input value={activeMeeting.title} onChange={(event) => updateMeeting("title", event.target.value)} /></label><div className="form-two-col"><label>{copy.date}<Input value={activeMeeting.date} onChange={(event) => updateMeeting("date", event.target.value)} /></label><label>{copy.time}<Input value={activeMeeting.time} onChange={(event) => updateMeeting("time", event.target.value)} /></label></div><label>{copy.type}<select value={activeMeeting.type} onChange={(event) => updateMeeting("type", event.target.value)}><option>داخلي</option><option>مع شريك تأميني</option><option>إدارة</option><option>Internal</option><option>Partner</option><option>Leadership</option><option>أخرى</option></select></label><label>{copy.attendees}<Input value={activeMeeting.attendees.join(isArabic ? "، " : ", ")} onChange={(event) => updateMeeting("attendees", event.target.value.split(/[,،]/).map((person) => person.trim()).filter(Boolean))} /><span className="field-hint">{copy.hint}</span></label></div><div className="form-card"><div className="form-card-title"><span className="number-chip">٠٢</span><div><h3>{copy.summary}</h3><p>{isArabic ? "فكرة واحدة تساعدك على بدء الاجتماع من المكان الصحيح." : "One idea to help you start from the right place."}</p></div></div><label><Textarea value={activeMeeting.summary} onChange={(event) => updateMeeting("summary", event.target.value)} rows={4} placeholder={isArabic ? "ما الذي نحتاج أن نخرج به من هذا الاجتماع؟" : "What should we leave this meeting with?"} /></label></div><div className="form-card"><div className="form-card-title"><span className="number-chip">٠٣</span><div><h3>{copy.notes}</h3><p>{isArabic ? "أفكار سريعة تبقى معك أثناء الحديث." : "Quick thoughts to keep close during the conversation."}</p></div></div><label><Textarea value={activeMeeting.note} onChange={(event) => updateMeeting("note", event.target.value)} rows={3} placeholder={isArabic ? "أضف ملاحظة خاصة بك..." : "Add a private note..."} /></label></div></div>
            <div className="editor-column"><div className="form-card agenda-card"><div className="form-card-title"><span className="number-chip accent">٠٤</span><div><h3>{copy.agenda}</h3><p>{isArabic ? "رتّب المحاور بحسب تسلسل المحادثة." : "Order topics in the flow of the conversation."}</p></div><span className="item-count">{activeMeeting.agenda.length} {isArabic ? "مواضيع" : "topics"}</span></div><div className="agenda-items">{activeMeeting.agenda.map((item, index) => <div className="agenda-item" key={`${item.title}-${index}`}><div className="agenda-item-head"><span className="agenda-index">{formatAgendaIndex(index)}</span><Input value={item.title} onChange={(event) => updateAgenda(index, "title", event.target.value)} /><div className="reorder-controls"><button className="delete-button" onClick={() => moveAgenda(index, -1)} disabled={index === 0} aria-label={isArabic ? "تحريك الموضوع لأعلى" : "Move topic up"}><ChevronUp size={14} /></button><button className="delete-button" onClick={() => moveAgenda(index, 1)} disabled={index === activeMeeting.agenda.length - 1} aria-label={isArabic ? "تحريك الموضوع لأسفل" : "Move topic down"}><ChevronDown size={14} /></button><button className="delete-button" onClick={() => removeAgenda(index)} aria-label={isArabic ? "حذف الموضوع" : "Delete topic"}><Trash2 size={16} /></button></div></div><Input value={item.context} onChange={(event) => updateAgenda(index, "context", event.target.value)} placeholder={isArabic ? "السياق أو الخلفية" : "Context or background"} /><Input value={item.goal} onChange={(event) => updateAgenda(index, "goal", event.target.value)} placeholder={isArabic ? "الهدف من مناقشته" : "Goal for discussing it"} /></div>)}</div><button className="add-topic" onClick={addAgenda}><Plus size={17} /> {isArabic ? "إضافة موضوع" : "Add topic"}</button></div><div className="form-card"><div className="form-card-title"><span className="number-chip">٠٥</span><div><h3>{copy.external}</h3><p>{isArabic ? "أضف رابطًا يساعدك على العودة للمادة الأصلية." : "Keep a link back to the source material."}</p></div></div><div className="link-input"><Link2 size={17} /><Input value={activeMeeting.link} onChange={(event) => updateMeeting("link", event.target.value)} placeholder="https://notion.so/..." />{activeMeeting.link && <a href={activeMeeting.link} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}</div></div><div className="form-card action-card"><div className="form-card-title"><span className="number-chip">٠٦</span><div><h3>{copy.actions}</h3><p>{isArabic ? "أشياء تريد التأكد من حضورها في النقاش." : "Items you want to make sure the conversation covers."}</p></div></div>{activeMeeting.actions.map((action, index) => <div className="action-row" key={`${action}-${index}`}><span className="action-check"><Check size={13} /></span><Input value={action} onChange={(event) => updateMeeting("actions", activeMeeting.actions.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} /><div className="reorder-controls"><button className="delete-button" onClick={() => moveAction(index, -1)} disabled={index === 0} aria-label={isArabic ? "تحريك نقطة المتابعة لأعلى" : "Move follow-up up"}><ChevronUp size={14} /></button><button className="delete-button" onClick={() => moveAction(index, 1)} disabled={index === activeMeeting.actions.length - 1} aria-label={isArabic ? "تحريك نقطة المتابعة لأسفل" : "Move follow-up down"}><ChevronDown size={14} /></button><button className="delete-button" onClick={() => updateMeeting("actions", activeMeeting.actions.filter((_, itemIndex) => itemIndex !== index))} aria-label={isArabic ? "حذف نقطة المتابعة" : "Delete follow-up"}><X size={16} /></button></div></div>)}<button className="add-action" onClick={() => updateMeeting("actions", [...activeMeeting.actions, isArabic ? "نقطة متابعة جديدة" : "New follow-up"])}><Plus size={16} /> {isArabic ? "إضافة نقطة" : "Add follow-up"}</button></div></div></div>
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
    <div className="ui-settings-head"><div><strong>{isArabic ? "تخصيص الواجهة" : "Customize interface"}</strong><p>{isArabic ? "غيّر المظهر كما يناسب طريقتك." : "Adjust the workspace to your style."}</p></div><button className="settings-close" onClick={close} aria-label={isArabic ? "إغلاق" : "Close"}><X size={16} /></button></div>
    <SettingGroup label={isArabic ? "المظهر" : "Theme"} options={[{ value: "light", label: isArabic ? "فاتح" : "Light" }, { value: "sand", label: isArabic ? "رملي" : "Sand" }, { value: "night", label: isArabic ? "ليلي" : "Night" }]} selected={settings.theme} onSelect={(value) => update("theme", value as UiSettings["theme"])} />
    <div className="settings-group"><span>{isArabic ? "اللون الرئيسي" : "Accent"}</span><div className="settings-options">{(["sage", "blue", "plum"] as UiSettings["accent"][]).map((accent) => <button key={accent} aria-label={accent} className={`accent-option ${settings.accent === accent ? "selected" : ""}`} style={{ "--option-accent": accentColors[accent] } as React.CSSProperties} onClick={() => update("accent", accent)}><span /></button>)}</div></div>
    <SettingGroup label={isArabic ? "كثافة المحتوى" : "Density"} options={[{ value: "comfortable", label: isArabic ? "مريح" : "Comfortable" }, { value: "compact", label: isArabic ? "مضغوط" : "Compact" }]} selected={settings.density} onSelect={(value) => update("density", value as UiSettings["density"])} />
    <SettingGroup label={isArabic ? "كثافة العرض" : "Display density"} options={[{ value: "standard", label: isArabic ? "قياسي" : "Standard" }, { value: "compact", label: isArabic ? "مضغوط" : "Compact" }]} selected={settings.displayScale} onSelect={(value) => update("displayScale", value as UiSettings["displayScale"])} />
    <button className="settings-reset" onClick={reset}>{isArabic ? "إعادة الإعدادات الافتراضية" : "Reset defaults"}</button>
  </section>;
}

function SettingGroup({ label, options, selected, onSelect }: { label: string; options: Array<{ value: string; label: string }>; selected: string; onSelect: (value: string) => void }) {
  return <div className="settings-group"><span>{label}</span><div className="settings-options">{options.map((option) => <button key={option.value} className={selected === option.value ? "selected" : ""} onClick={() => onSelect(option.value)}>{option.label}</button>)}</div></div>;
}

function DisplayMode({ meeting, onBack, onRefresh, copy, language }: { meeting: MeetingRecord; onBack: () => void; onRefresh: () => void; copy: { back: string; refresh: string; fullScreen: string; exitFullScreen: string; goal: string; topics: string }; language: "ar" | "en" }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => { const sync = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", sync); return () => document.removeEventListener("fullscreenchange", sync); }, []);
  const toggleFullscreen = async () => {
    if (!document.fullscreenEnabled) { toast.info(language === "ar" ? "ملء الشاشة غير متاح في هذا المتصفح" : "Full screen is not available in this browser"); return; }
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast.error(language === "ar" ? "تعذر فتح ملء الشاشة" : "Could not open full screen"); }
  };
  const displayedAgenda = meeting.agenda.slice(0, 4);
  const hiddenAgendaCount = Math.max(0, meeting.agenda.length - displayedAgenda.length);
  return     <div dir={language === "ar" ? "rtl" : "ltr"} style={{ "--ui-accent": accentColors[readUiSettings().accent] } as React.CSSProperties} className={`display-shell theme-${readUiSettings().theme} display-${readUiSettings().displayScale}`}>
<header className="display-toolbar"><button className="display-back" onClick={onBack}><ArrowLeft size={17} /> {copy.back}</button><div className="display-brand"><span className="brand-mark"><Sparkles size={15} /></span> جلسة <span className="display-divider" /> {language === "ar" ? "وضع العرض" : "Display mode"}</div><div className="display-toolbar-actions"><button className="display-tool" onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} <span>{isFullscreen ? copy.exitFullScreen : copy.fullScreen}</span></button><button className="display-tool" onClick={onRefresh}><Copy size={16} /> <span>{copy.refresh}</span></button><button className="display-tool muted"><MoreHorizontal size={17} /></button></div></header><main className="presentation-page"><div className="presentation-kicker"><span className="selected-dot" /> {meeting.type} <span>·</span> {meeting.date}</div><h1>{meeting.title}</h1><div className="presentation-line" /><section className="presentation-summary"><div className="summary-label"><Target size={18} /> {copy.goal}</div><p>{meeting.summary || (language === "ar" ? "لم تتم إضافة ملخص بعد." : "No summary added yet.")}</p></section><section className="presentation-agenda"><div className="summary-label"><FileText size={18} /> {copy.topics}</div><div className="presentation-items">{displayedAgenda.map((item, index) => <article className="presentation-item" key={`${item.title}-${index}`}><span className="presentation-number">{formatAgendaIndex(index)}</span><div><h2>{item.title}</h2><p>{item.context}</p><div className="goal-line"><span>{language === "ar" ? "نريد الخروج بـ" : "Leave with"}</span>{item.goal}</div></div></article>)}{hiddenAgendaCount > 0 && <div className="display-overflow-note">+ {hiddenAgendaCount} {language === "ar" ? "مواضيع أخرى في وضع التحرير" : "more topics in edit mode"}</div>}</div></section><footer className="presentation-footer"><span><Users size={15} /> {meeting.attendees.length ? meeting.attendees.join(language === "ar" ? "، " : ", ") : (language === "ar" ? "لم تتم إضافة الحضور" : "No attendees yet")}</span><span>جلسة · {language === "ar" ? "تحضير الاجتماع" : "Meeting prep"}</span></footer></main></div>;
}
