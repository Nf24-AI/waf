import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { MeetingAgendaItem, MeetingRecord } from "@shared/meeting-store";
import { DECISIONS_ROUTE } from "@shared/routes";

const mocks = vi.hoisted(() => ({
  listQuery: vi.fn(() => ({
    data: undefined as unknown,
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { meetings: { list: { useQuery: mocks.listQuery } } },
}));

import Decisions from "./Decisions";

function agenda(partial: Partial<MeetingAgendaItem>): MeetingAgendaItem {
  return { title: "", context: "", goal: "", decision: "", owner: "", ...partial };
}

function meeting(partial: Partial<MeetingRecord>): MeetingRecord {
  return {
    id: "m1", title: "اجتماع", date: "2026-09-01", time: "", type: "داخلي",
    status: "تم الاجتماع", attendees: [], summary: "", agenda: [], actions: [],
    note: "", link: "", image: "", ...partial,
  };
}

function withMeetings(meetings: MeetingRecord[]) {
  mocks.listQuery.mockReturnValue({ data: { meetings }, isLoading: false, isError: false });
}

function renderPage() {
  const { hook } = memoryLocation({ path: DECISIONS_ROUTE });
  return render(
    <Router hook={hook}>
      <Decisions />
    </Router>,
  );
}

const SAMPLE = [
  meeting({
    id: "m1", title: "مراجعة التأمين", date: "2026-09-10", attendees: ["نواف", "سارة"],
    agenda: [
      agenda({ title: "المزوّد", context: "تأخّر التسليم", decision: "ننتقل إلى سلامة", owner: "نواف" }),
      agenda({ title: "التسعير", decision: "نثبّت السعر", owner: "سارة" }),
      agenda({ title: "لم يُقرَّر" }),
    ],
  }),
  meeting({
    id: "m2", title: "اجتماع الشركاء", date: "2026-08-02",
    agenda: [agenda({ title: "التكامل", decision: "نبدأ بالمرحلة الأولى", owner: "" })],
  }),
];

describe("decision log page", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listQuery.mockReset();
    withMeetings([]);
  });

  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    cleanup();
  });

  it("renders without crashing", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("سجلّ القرارات");
  });

  it("lists every decision and leaves out an item that decided nothing", () => {
    withMeetings(SAMPLE);
    renderPage();
    expect(screen.getByText("ننتقل إلى سلامة")).toBeInTheDocument();
    expect(screen.getByText("نثبّت السعر")).toBeInTheDocument();
    expect(screen.getByText("نبدأ بالمرحلة الأولى")).toBeInTheDocument();
    expect(screen.queryByText("لم يُقرَّر")).not.toBeInTheDocument();
  });

  it("flags a decision nobody owns instead of hiding it", () => {
    withMeetings(SAMPLE);
    renderPage();
    // على البطاقة نفسها، بدل اسم مالك فارغ
    const onCard = document.querySelector(".decision-unowned");
    expect(onCard).not.toBeNull();
    expect(onCard).toHaveTextContent("بلا مالك");
    // وفي العدّاد أعلى الصفحة: رقم يستحق أن يُرى قبل فتح أي بطاقة
    const inCount = document.querySelector(".decision-warn");
    expect(inCount).not.toBeNull();
    expect(inCount).toHaveTextContent("1 بلا مالك");
  });

  it("narrows the list as you type, across the meeting name too", () => {
    withMeetings(SAMPLE);
    renderPage();
    const search = screen.getByRole("searchbox", { name: "بحث في القرارات" });

    fireEvent.change(search, { target: { value: "سلامة" } });
    expect(screen.getByText("ننتقل إلى سلامة")).toBeInTheDocument();
    expect(screen.queryByText("نثبّت السعر")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "الشركاء" } });
    expect(screen.getByText("نبدأ بالمرحلة الأولى")).toBeInTheDocument();
    expect(screen.queryByText("ننتقل إلى سلامة")).not.toBeInTheDocument();
  });

  it("filters by owner, listing each owner once", () => {
    withMeetings(SAMPLE);
    renderPage();
    const select = screen.getByRole("combobox", { name: "تصفية بالمالك" });
    expect(screen.getAllByRole("option", { name: "نواف" })).toHaveLength(1);

    fireEvent.change(select, { target: { value: "سارة" } });
    expect(screen.getByText("نثبّت السعر")).toBeInTheDocument();
    expect(screen.queryByText("ننتقل إلى سلامة")).not.toBeInTheDocument();
  });

  it("says nothing matched rather than showing an empty page", () => {
    withMeetings(SAMPLE);
    renderPage();
    fireEvent.change(screen.getByRole("searchbox", { name: "بحث في القرارات" }), {
      target: { value: "نص لا وجود له" },
    });
    expect(screen.getByText("لا قرارات مطابقة")).toBeInTheDocument();
  });

  it("points a first-time user at where a decision is written", () => {
    withMeetings([meeting({ agenda: [agenda({ title: "بند", decision: "" })] })]);
    renderPage();
    expect(screen.getByText("لا قرارات بعد")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /خدمة الاجتماعات/ })).toHaveAttribute("href", "/meetings");
  });

  it("explains a failed read instead of showing an empty log", () => {
    mocks.listQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByText("تعذّر قراءة الاجتماعات")).toBeInTheDocument();
    expect(screen.queryByText("لا قرارات بعد")).not.toBeInTheDocument();
  });

  it("shows neither empty state nor list while still loading", () => {
    mocks.listQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.queryByText("لا قرارات بعد")).not.toBeInTheDocument();
    expect(screen.queryByText("تعذّر قراءة الاجتماعات")).not.toBeInTheDocument();
  });

  it("leads back to the platform", () => {
    withMeetings(SAMPLE);
    renderPage();
    expect(screen.getByRole("link", { name: /خدمات واف/ })).toHaveAttribute("href", "/");
  });

  it("sends each card to the meeting the decision was taken in, not to the list", () => {
    withMeetings(SAMPLE);
    renderPage();

    // بطاقتان من m1 وواحدة من m2 — والرابط يفرّق بينها
    const cards = Array.from(document.querySelectorAll(".decision-card"));
    const hrefs = cards.map((card) => card.querySelector(".decision-source")?.getAttribute("href"));

    expect(hrefs).toContain("/meetings?meeting=m1");
    expect(hrefs).toContain("/meetings?meeting=m2");
    // رابط إلى القائمة وحدها يكسر الوعد: «ارجع وصحّحه حيث اتُّخذ»
    expect(hrefs).not.toContain("/meetings");
  });
});
