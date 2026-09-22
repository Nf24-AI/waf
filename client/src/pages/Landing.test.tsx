import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import Landing from "./Landing";
import { SERVICES } from "@shared/services";
import { LANDING_ROUTE } from "@shared/routes";

/**
 * صفحة الهبوط هي المسار الوحيد الذي يُقرأ بلا كلمة مرور، فهي الصفحة الوحيدة
 * التي يراها غريب. ما يُكسر فيها بصمت: اسم المنتج يغيب عن قارئ الشاشة لأن
 * الحركة تخفي حروفه، «عن واف» يصعد فوق الخدمات فيصير افتتاحاً ثانياً، أو
 * وجهة خدمة تتباعد عن الكتالوج لأن أحدهم كتب الرابط بيده.
 */

function renderLanding() {
  const { hook } = memoryLocation({ path: LANDING_ROUTE });
  return render(
    <Router hook={hook}>
      <Landing />
    </Router>,
  );
}

function href(id: string) {
  return SERVICES.find(service => service.id === id)!.href!;
}

describe("landing page", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(message => {
      // jsdom يعلن أن getContext غير منفّذ عبر console.error لا برمي. المحرّك
      // يتعامل مع السياق الغائب ويرجع خاملاً، فهذه الرسالة متوقَّعة — والحارس
      // هنا لتحذيرات React، فيبقى صارماً مع كل ما عداها.
      if (String(message).includes("getContext")) return;
      throw new Error(String(message));
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    cleanup();
  });

  it("opens on the brand, not on the story", () => {
    renderLanding();
    // العنوان الأول للصفحة هو الاسم فوق اللوحة. لو صعد «عن واف» إلى الأعلى
    // لصار عنوان الحكاية هو h1، وهذا بالضبط الترتيب الذي أُعيد ضبطه.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("وَاف");
  });

  it("keeps About Waf as the last section, after the services", () => {
    const { container } = renderLanding();
    const sections = Array.from(container.querySelectorAll("main > *[id], main > section"));
    expect(sections.at(-1)).toHaveAttribute("id", "about-waf");
    const services = container.querySelector("#services")!;
    const about = container.querySelector("#about-waf")!;
    expect(services.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reaches About Waf by anchor on this page, not by a route", () => {
    renderLanding();
    const link = screen.getByRole("link", { name: "عن واف" });
    expect(link).toHaveAttribute("href", "#about-waf");
  });

  it("names the brand where a screen reader can reach it, not only in the animation", () => {
    renderLanding();
    // الحروف المتحرّكة كلها aria-hidden، فلولا النسخة المقروءة لكان اسم
    // المنتج غائباً عن قارئ الشاشة تماماً.
    expect(screen.getAllByText("وَاف", { selector: ".sr-only" }).length).toBeGreaterThan(0);
  });

  it("describes the photograph rather than leaving it unlabelled", () => {
    renderLanding();
    expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("تنومة"));
  });

  it("credits where and when the photograph was taken", () => {
    renderLanding();
    expect(screen.getByText("2020 . 07 . 14")).toBeInTheDocument();
    expect(screen.getByText("18.9881° N")).toBeInTheDocument();
    expect(screen.getByText("TANOMAH")).toBeInTheDocument();
  });

  it("shows exactly the two services it claims, and invents none", () => {
    renderLanding();
    const titles = screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent);
    expect(titles).toEqual(["خدمة الاجتماعات", "إدارة الوقت"]);
    expect(screen.queryByText("قريباً")).not.toBeInTheDocument();
  });

  it("takes both services' destinations from the catalogue", () => {
    renderLanding();
    const enters = screen.getAllByRole("link", { name: /^ادخل (خدمة الاجتماعات|إدارة الوقت)$/ });
    expect(enters.map(link => link.getAttribute("href"))).toEqual([href("meetings"), href("time")]);
  });

  it("isolates any off-origin service, and keeps the rest in this tab", () => {
    renderLanding();
    // القاعدة لا الحالة: كل خدمة على أصل آخر تُفتح معزولة، وما عاد داخل واف
    // يبقى في اللسان نفسه. إدارة الوقت انتقلت إلى الداخل، فتُحرس بالقاعدة
    // نفسها من الجهة الأخرى.
    for (const service of SERVICES.filter(item => item.status === "live")) {
      const card = screen.queryByRole("heading", { name: new RegExp(service.name.replace("خدمة ", "")) });
      if (!card) continue;
      const link = card.closest("a");
      if (!link) continue;
      if (service.external) {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link.getAttribute("rel")).toContain("noreferrer");
      } else {
        expect(link).not.toHaveAttribute("target");
        expect(link.getAttribute("href")?.startsWith("/")).toBe(true);
      }
    }
  });

  it("offers no vague way in, only the services themselves", () => {
    renderLanding();
    // «ادخل المنصّة» كانت تَعِد بمكان وراء الخدمات لا وجود له: الزائر يراها
    // أمامه، والباب إلى كل واحدة بطاقتها. ثلاث دعوات صارت صفراً.
    expect(screen.queryByRole("link", { name: "ادخل المنصّة" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: /^ادخل (خدمة الاجتماعات|إدارة الوقت)$/ })).toHaveLength(2);
  });
});
