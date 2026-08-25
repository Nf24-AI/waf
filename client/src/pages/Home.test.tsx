import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  meQuery: vi.fn(() => ({ data: null as unknown, isLoading: false, error: null as unknown })),
  notionListQuery: vi.fn(() => ({ data: undefined as unknown, isLoading: false, isError: false, isSuccess: false, refetch: vi.fn() })),
  notionUpdateMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  notionCreateMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  notionRemoveMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  setData: vi.fn(),
  invalidate: vi.fn(),
  listInvalidate: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: mocks.toastInfo, error: vi.fn() } }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      auth: { me: { setData: mocks.setData, invalidate: mocks.invalidate } },
      meetings: { list: { invalidate: mocks.listInvalidate } },
    }),
    auth: {
      me: { useQuery: mocks.meQuery },
      unlock: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) },
      logout: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) },
    },
    meetings: {
      status: { useQuery: () => ({ data: undefined, isLoading: false }) },
      list: { useQuery: mocks.notionListQuery },
      update: { useMutation: mocks.notionUpdateMutation },
      create: { useMutation: mocks.notionCreateMutation },
      remove: { useMutation: mocks.notionRemoveMutation },
    },
  },
}));

import Home from "./Home";

// Notion is the source of truth, so the workspace renders nothing until the
// query resolves. Every interaction test needs meetings to come back from it.
const notionMeetings = [
  {
    id: "notion-q3",
    title: "مراجعة شراكة الربع الثالث",
    date: "الخميس، ٢٧ أغسطس ٢٠٢٦",
    time: "١٠:٠٠ ص – ١١:٠٠ ص",
    type: "مع شريك تأميني",
    status: "جاهز للعرض",
    attendees: ["سارة العتيبي"],
    summary: "جلسة مركزة لمراجعة أداء الشراكة.",
    agenda: [
      { title: "افتتاح سريع وهدف الجلسة", context: "توحيد التوقعات.", goal: "صورة مشتركة." },
      { title: "أداء الربع الثالث", context: "أهم المؤشرات.", goal: "تحديد ما يحتاج تدخلًا." },
    ],
    actions: ["إحضار ملخص المؤشرات"],
    note: "",
    link: "",
  },
];

const notionSuccess = (meetings: unknown = notionMeetings) => ({
  data: { source: "notion", meetings } as unknown,
  isLoading: false,
  isError: false,
  isSuccess: true,
  refetch: vi.fn(),
});

describe("meeting workspace interactions", () => {
  beforeEach(() => {
    mocks.meQuery.mockReturnValue({ data: null as unknown, isLoading: false, error: null as unknown });
    mocks.notionListQuery.mockReturnValue(notionSuccess());
    mocks.notionUpdateMutation.mockReturnValue({ isPending: false, mutate: vi.fn() });
    mocks.notionCreateMutation.mockReturnValue({ isPending: false, mutate: vi.fn() });
    mocks.notionRemoveMutation.mockReturnValue({ isPending: false, mutate: vi.fn() });
    mocks.toastInfo.mockClear();
  });

  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
    localStorage.clear();
  });

  it("opens and persists the UI customization panel", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "القائمة" })).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("تخصيص الواجهة"));
    expect(screen.getByText("تخصيص الواجهة")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ليلي" }));
    fireEvent.click(screen.getByLabelText("blue"));
    const compactButtons = screen.getAllByRole("button", { name: "مضغوط" });
    fireEvent.click(compactButtons[0]);
    fireEvent.click(compactButtons[1]);
    expect(document.querySelector(".workspace-shell.theme-night.density-compact")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("meeting-prep-ui") ?? "{}")).toMatchObject({ theme: "night", accent: "blue", density: "compact", displayScale: "compact" });
    fireEvent.click(screen.getByRole("button", { name: "إعادة الإعدادات الافتراضية" }));
    expect(JSON.parse(localStorage.getItem("meeting-prep-ui") ?? "{}")).toMatchObject({ theme: "light", accent: "sage", density: "comfortable", displayScale: "standard" });
  });

  it("opens the presentation mode from preparation", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "القائمة" })).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("وضع العرض")[0]);
    expect(await screen.findByText("محاور النقاش")).toBeInTheDocument();
    expect(screen.queryByText("حفظ التغييرات")).not.toBeInTheDocument();
  });

  it("exposes a retryable Notion connection error", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByLabelText("اختبار الاتصال")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("اختبار الاتصال"));
    // Both the status pill and the connection card report the failure.
    expect(screen.getAllByText("تعذر الاتصال بـ Notion").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("إعادة المحاولة"));
    expect(screen.getAllByText("Notion متصل").length).toBeGreaterThan(0);
  });

  it("moves an agenda item using the visible reorder control", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "مواضيع النقاش" })).toBeInTheDocument());
    const moveDownButtons = screen.getAllByLabelText("تحريك الموضوع لأسفل");
    fireEvent.click(moveDownButtons[0]);
    expect(screen.getByDisplayValue("افتتاح سريع وهدف الجلسة")).toBeInTheDocument();
  });

  it("creates a prepared meeting from a template", async () => {
    // A template must persist to Notion, not just appear locally, otherwise the
    // draft disappears on the next refresh.
    const mutate = vi.fn();
    mocks.notionCreateMutation.mockReturnValue({ isPending: false, mutate });

    render(<Home />);
    await waitFor(() => expect(screen.getByText("ابدأ بقالب")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "اجتماع داخلي" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ title: "اجتماع داخلي جديد", type: "داخلي", status: "مسودة" });

    // The workspace shows it once Notion returns the created page.
    const created = { ...mutate.mock.calls[0][0], id: "notion-created" };
    mutate.mock.calls[0][1].onSuccess(created);
    expect(await screen.findByDisplayValue("اجتماع داخلي جديد")).toBeInTheDocument();
  });

  it("offers full-screen presentation and handles unsupported browsers safely", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "القائمة" })).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("وضع العرض")[0]);
    const fullscreenButton = await screen.findByRole("button", { name: /ملء الشاشة/ });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    fireEvent.click(fullscreenButton);
    await waitFor(() => expect(document.documentElement.requestFullscreen).toHaveBeenCalled());
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    fireEvent.click(fullscreenButton);
    expect(mocks.toastInfo).toHaveBeenCalledWith("ملء الشاشة غير متاح في هذا المتصفح");
  });

  it("keeps the workspace visible while Notion is syncing", async () => {
    // A refetch keeps existing meetings on screen; only the very first load
    // (no data yet) is allowed to block with the loading screen.
    mocks.meQuery.mockReturnValue({ data: { id: 1, name: "N", role: "user" } as unknown, isLoading: false, error: null as unknown });
    mocks.notionListQuery.mockReturnValue({ ...notionSuccess(), isLoading: false, isSuccess: false });
    render(<Home />);
    expect(await screen.findByRole("heading", { name: "القائمة" })).toBeInTheDocument();
    expect(screen.getAllByText("جاري المزامنة...").length).toBeGreaterThan(0);
  });

  it("blocks with a loading screen on the very first Notion load", async () => {
    mocks.notionListQuery.mockReturnValue({ data: undefined as unknown, isLoading: true, isError: false, isSuccess: false, refetch: vi.fn() });
    render(<Home />);
    expect(await screen.findByText("جارٍ التحميل")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "القائمة" })).not.toBeInTheDocument();
  });

  it("shows today's real date, not a hard-coded one", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "القائمة" })).toBeInTheDocument());
    // The header used to always read "الثلاثاء، ٢٧ أغسطس ٢٠٢٦".
    expect(screen.queryByText("الثلاثاء، ٢٧ أغسطس ٢٠٢٦")).not.toBeInTheDocument();
    expect(document.querySelector(".eyebrow")?.textContent).toMatch(/٠|١|٢|٣|٤|٥|٦|٧|٨|٩/);
  });

  it("renders counts in one numeral system", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "القائمة" })).toBeInTheDocument());
    // padStart(2, "٠") produced "٠3" — an Arabic zero next to a Western digit.
    const counts = Array.from(document.querySelectorAll(".stat-card strong")).map((n) => n.textContent ?? "");
    expect(counts.length).toBeGreaterThan(0);
    counts.forEach((count) => expect(count).not.toMatch(/[٠-٩].*[0-9]|[0-9].*[٠-٩]/));
  });

  it("creates a genuinely blank meeting, not a copy of a sample", async () => {
    const mutate = vi.fn();
    mocks.notionCreateMutation.mockReturnValue({ isPending: false, mutate });

    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "القائمة" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /اجتماع جديد/ }));

    expect(mutate).toHaveBeenCalledTimes(1);
    // It used to spread a sample record, dragging its attendees and agenda into Notion.
    expect(mutate.mock.calls[0][0]).toMatchObject({
      title: "اجتماع جديد",
      attendees: [],
      agenda: [],
      actions: [],
      summary: "",
      note: "",
      link: "",
    });
  });

  it("never presents a sample meeting when the database is empty", async () => {
    mocks.notionListQuery.mockReturnValue(notionSuccess([]));
    window.history.pushState({}, "", "/display");
    render(<Home />);
    // Display mode is a shared screen — the worst place for fake data.
    expect(await screen.findByText("لا اجتماعات")).toBeInTheDocument();
    expect(screen.queryByText("مراجعة شراكة الربع الثالث")).not.toBeInTheDocument();
  });

  it("shows an empty state instead of samples when the database has no meetings", async () => {
    mocks.notionListQuery.mockReturnValue(notionSuccess([]));
    render(<Home />);
    expect(await screen.findByText("لا اجتماعات")).toBeInTheDocument();
    // The old sample data must never appear as if it were the user's own.
    expect(screen.queryByText("مراجعة شراكة الربع الثالث")).not.toBeInTheDocument();
  });

  it("renders connected Notion meetings when the protected query succeeds", async () => {
    mocks.meQuery.mockReturnValue({ data: { id: 1, name: "N", role: "user" } as unknown, isLoading: false, error: null as unknown });
    mocks.notionListQuery.mockReturnValue({ data: { source: "notion", meetings: [{ id: "notion-1", title: "مراجعة من Notion", date: "2026-08-27", time: "", type: "داخلي", status: "مسودة", attendees: [], summary: "ملخص", agenda: [], actions: [], note: "", link: "" }] } as unknown, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() });
    render(<Home />);
    expect((await screen.findAllByText("مراجعة من Notion")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notion متصل").length).toBeGreaterThan(0);
  });
});
