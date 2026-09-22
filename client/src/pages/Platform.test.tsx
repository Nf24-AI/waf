import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import Platform from "./Platform";
import { SERVICES } from "@shared/services";
import { MEETING_ROUTES, PLATFORM_ROUTE } from "@shared/routes";

/**
 * الصفحة خلف بوابة كلمة مرور، فلا تُفحص بالعين بسهولة. هذه الاختبارات
 * ترسمها فعلاً وتتحقق من الأشياء التي تُكسر بصمت: رابط ميت، بطاقة «قريباً»
 * صارت قابلة للضغط، أو خدمة خارجية فُتحت بلا عزل عن الأصل.
 */

function renderPlatform() {
  const { hook } = memoryLocation({ path: PLATFORM_ROUTE });
  return render(
    <Router hook={hook}>
      <Platform />
    </Router>,
  );
}

describe("platform front door", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // أي تحذير من React أثناء الرسم يفشل الاختبار بدل أن يمرّ في السجلّ.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    cleanup();
  });

  it("renders without crashing and names the platform, not the meetings tool", () => {
    renderPlatform();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("واف");
    expect(screen.getByText("منصّة أدوات مدير المشروع ومالك المنتج")).toBeInTheDocument();
  });

  it("shows every service in the catalogue", () => {
    renderPlatform();
    for (const service of SERVICES) {
      expect(screen.getByRole("heading", { name: service.name })).toBeInTheDocument();
      expect(screen.getByText(service.eyebrow)).toBeInTheDocument();
    }
  });

  it("sends the meetings card to the meetings route, not to the root", () => {
    renderPlatform();
    const card = screen.getByRole("heading", { name: "خدمة الاجتماعات" }).closest("a");
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute("href", MEETING_ROUTES.prepare);
    expect(card).not.toHaveAttribute("href", PLATFORM_ROUTE);
  });

  it("opens an off-origin service isolated, and an in-app one in this tab", () => {
    renderPlatform();
    // القاعدة تُحرس من الجهتين: خدمة خارج الأصل تُعزل، وخدمة داخل واف لا
    // تُقذف في لسان جديد بلا سبب. إدارة الوقت صارت داخلية.
    for (const service of SERVICES.filter(item => item.status === "live")) {
      const card = screen.getByRole("heading", { name: service.name }).closest("a");
      expect(card).not.toBeNull();
      if (service.external) {
        expect(card).toHaveAttribute("target", "_blank");
        // بدونها يحصل الأصل الآخر على window.opener ومرجعنا.
        expect(card?.getAttribute("rel")).toContain("noopener");
        expect(card?.getAttribute("rel")).toContain("noreferrer");
        expect(within(card as HTMLElement).getByText("افتح في لسان جديد")).toBeInTheDocument();
      } else {
        expect(card).not.toHaveAttribute("target");
        expect(within(card as HTMLElement).getByText("ادخل الخدمة")).toBeInTheDocument();
      }
    }
  });

  it("leaves a coming service unclickable rather than linking nowhere", () => {
    renderPlatform();
    for (const service of SERVICES.filter((entry) => entry.status === "soon")) {
      const card = screen.getByRole("heading", { name: service.name }).closest("article, a");
      expect(card?.tagName).toBe("ARTICLE");
      expect(card).toHaveAttribute("aria-disabled", "true");
      expect(card?.querySelector("a, button")).toBeNull();
    }
  });

  it("counts each group as the catalogue does", () => {
    renderPlatform();
    const live = SERVICES.filter((entry) => entry.status === "live");
    const soon = SERVICES.filter((entry) => entry.status === "soon");
    expect(live.length).toBeGreaterThan(0);
    expect(soon.length).toBeGreaterThan(0);
    expect(live.length + soon.length).toBe(SERVICES.length);
    expect(screen.getByRole("heading", { name: "الخدمات المتاحة" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "قريباً" })).toBeInTheDocument();
  });
});

describe("service catalogue", () => {
  it("keeps ids unique, so React keys and lookups stay stable", () => {
    const ids = SERVICES.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every live service a destination and every coming one none", () => {
    for (const service of SERVICES) {
      if (service.status === "live") expect(service.href, service.id).toBeTruthy();
      else expect(service.href, service.id).toBeUndefined();
    }
  });

  it("marks an off-origin destination as external, and never an internal one", () => {
    for (const service of SERVICES) {
      const absolute = /^https?:\/\//.test(service.href ?? "");
      expect(Boolean(service.external), service.id).toBe(absolute);
    }
  });

  it("writes every label in Arabic and every eyebrow in uppercase Latin", () => {
    for (const service of SERVICES) {
      expect(service.name, service.id).toMatch(/[؀-ۿ]/);
      expect(service.eyebrow, service.id).toBe(service.eyebrow.toUpperCase());
      expect(service.eyebrow, service.id).not.toMatch(/[؀-ۿ]/);
      expect(service.summary.length, service.id).toBeGreaterThan(20);
    }
  });
});
