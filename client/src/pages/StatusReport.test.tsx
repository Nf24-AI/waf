import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { MeetingAgendaItem, MeetingRecord } from "@shared/meeting-store";
import { STATUS_REPORT_ROUTE } from "@shared/routes";

const mocks = vi.hoisted(() => ({
  listQuery: vi.fn(() => ({ data: undefined as unknown, isLoading: false, isError: false })),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { meetings: { list: { useQuery: mocks.listQuery } } },
}));

import StatusReport from "./StatusReport";

function agenda(partial: Partial<MeetingAgendaItem>): MeetingAgendaItem {
  return { title: "", context: "", goal: "", decision: "", owner: "", ...partial };
}

function meeting(partial: Partial<MeetingRecord>): MeetingRecord {
  return {
    id: "m1", title: "اجتماع", date: "2026-09-16", time: "", type: "داخلي",
    status: "تم الاجتماع", attendees: [], summary: "", agenda: [], actions: [],
    note: "", link: "", image: "", ...partial,
  };
}

function withMeetings(meetings: MeetingRecord[]) {
  mocks.listQuery.mockReturnValue({ data: { meetings }, isLoading: false, isError: false });
}

function renderPage() {
  const { hook } = memoryLocation({ path: STATUS_REPORT_ROUTE });
  return render(
    <Router hook={hook}>
      <StatusReport />
    </Router>,
  );
}

describe("status report page", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // النافذة الافتراضية تعتمد على اليوم، فيُثبَّت حتى لا يصير الاختبار متقلّباً بالتاريخ.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T09:00:00Z"));
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listQuery.mockReset();
    withMeetings([]);
  });

  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    vi.useRealTimers();
    cleanup();
  });

  it("renders without crashing, on the last seven days", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("تقرير الحالة");
    expect(screen.getByText(/2026-09-14/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-20/)).toBeInTheDocument();
  });

  it("calls an empty week quiet rather than broken", () => {
    renderPage();
    expect(screen.getByText("أسبوع هادئ")).toBeInTheDocument();
    expect(screen.queryByText("تعذّر قراءة الاجتماعات")).not.toBeInTheDocument();
  });

  it("explains a failed read instead of reporting an empty week", () => {
    mocks.listQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByText("تعذّر قراءة الاجتماعات")).toBeInTheDocument();
    expect(screen.queryByText("أسبوع هادئ")).not.toBeInTheDocument();
  });

  it("shows neither state while still loading", () => {
    mocks.listQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.queryByText("أسبوع هادئ")).not.toBeInTheDocument();
    expect(screen.queryByText("تعذّر قراءة الاجتماعات")).not.toBeInTheDocument();
  });

  it("counts what the week held", () => {
    withMeetings([
      meeting({
        id: "a", date: "2026-09-16", attendees: ["نواف", "سارة"],
        agenda: [agenda({ decision: "قرار أول", owner: "نواف" })],
        actions: ["ترسل العقد"],
      }),
    ]);
    renderPage();

    const stats = document.querySelectorAll(".report-stat");
    const read = (label: string) =>
      Array.from(stats)
        .find((stat) => stat.textContent?.includes(label))
        ?.querySelector(".report-stat-value")?.textContent;

    expect(read("اجتماع")).toBe("1");
    expect(read("قرار")).toBe("1");
    expect(read("مهمة")).toBe("1");
    expect(read("مشارك")).toBe("2");
  });

  it("puts what needs attention before what merely happened", () => {
    withMeetings([
      meeting({ id: "a", title: "مراجعة", agenda: [agenda({ decision: "نغيّر المزوّد", owner: "" })] }),
    ]);
    renderPage();

    const headings = Array.from(document.querySelectorAll(".report-section-title")).map(
      (node) => node.textContent,
    );
    expect(headings[0]).toBe("يحتاج انتباهاً");

    // القرار نفسه يظهر في التنبيهات وفي «ما تقرّر» — مقصود. نتحقق من التنبيه وحده.
    const alert = document.querySelector(".report-alert");
    expect(alert).not.toBeNull();
    expect(within(alert as HTMLElement).getByText("نغيّر المزوّد")).toBeInTheDocument();
    expect(within(alert as HTMLElement).getByText("بلا مالك")).toBeInTheDocument();
  });

  it("hides a section that has nothing in it, rather than showing an empty heading", () => {
    withMeetings([
      meeting({ id: "a", agenda: [agenda({ decision: "قرار", owner: "نواف" })] }),
    ]);
    renderPage();

    const headings = Array.from(document.querySelectorAll(".report-section-title")).map(
      (node) => node.textContent,
    );
    expect(headings).toContain("ما تقرّر");
    expect(headings).not.toContain("يحتاج انتباهاً"); // القرار له مالك
    expect(headings).not.toContain("المهام");
  });

  it("links every line back to the meeting it came from", () => {
    withMeetings([
      meeting({
        id: "abc", title: "مراجعة التأمين",
        agenda: [agenda({ decision: "نغيّر المزوّد", owner: "" })],
        actions: ["ترسل العقد"],
      }),
    ]);
    renderPage();

    const links = Array.from(document.querySelectorAll("a.report-row, a.report-alert")).map((node) =>
      node.getAttribute("href"),
    );
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href === "/meetings?meeting=abc")).toBe(true);
  });

  it("moves the window a week back and forward, and returns to this week", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "الأسبوع السابق" }));
    expect(screen.getByText(/2026-09-07/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-13/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "الأسبوع التالي" }));
    expect(screen.getByText(/2026-09-14/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "الأسبوع السابق" }));
    fireEvent.click(screen.getByRole("button", { name: "هذا الأسبوع" }));
    expect(screen.getByText(/2026-09-14/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-20/)).toBeInTheDocument();
  });

  it("re-reads the report when the window moves", () => {
    withMeetings([
      meeting({ id: "old", date: "2026-09-09", title: "اجتماع الأسبوع الماضي" }),
    ]);
    renderPage();

    expect(screen.getByText("أسبوع هادئ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "الأسبوع السابق" }));

    // انعقد ولم يُقرَّر فيه شيء، فيظهر في «ما انعقد» وفي التنبيهات معاً.
    const held = Array.from(document.querySelectorAll(".report-section")).find(
      (node) => node.querySelector(".report-section-title")?.textContent === "ما انعقد",
    ) as HTMLElement;
    expect(within(held).getByText("اجتماع الأسبوع الماضي")).toBeInTheDocument();
    expect(screen.queryByText("أسبوع هادئ")).not.toBeInTheDocument();
  });

  it("separates what is coming from what was held", () => {
    withMeetings([
      meeting({ id: "held", date: "2026-09-16", title: "منعقد" }),
      meeting({ id: "next", date: "2026-09-28", title: "قادم", status: "مسودة" }),
    ]);
    renderPage();

    const sectionOf = (title: string) =>
      Array.from(document.querySelectorAll(".report-section")).find((node) =>
        node.querySelector(".report-section-title")?.textContent === title,
      ) as HTMLElement;

    expect(within(sectionOf("ما انعقد")).getByText("منعقد")).toBeInTheDocument();
    expect(within(sectionOf("القادم")).getByText("قادم")).toBeInTheDocument();
  });

  it("leads back to the platform", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /خدمات واف/ })).toHaveAttribute("href", "/");
  });
});
