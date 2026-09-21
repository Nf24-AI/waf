import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import Landing from "./Landing";
import { SERVICES } from "@shared/services";
import { LANDING_ROUTE, PLATFORM_ROUTE } from "@shared/routes";

/**
 * صفحة الهبوط هي المسار الوحيد الذي يُقرأ بلا كلمة مرور، فهي الصفحة الوحيدة
 * التي يراها غريب. ما يُكسر فيها بصمت: الاسم يختفي لأن الحركة لم تكتمل،
 * بطاقة «قريباً» تصير قابلة للضغط، أو خدمة خارجية تُفتح بلا عزل عن الأصل.
 *
 * jsdom لا يعطي سياق 2d، فاللوحة ترجع خاملة — وهذا مقصود: الاختبار يفحص
 * الصفحة لا الرسم.
 */

function renderLanding() {
  const { hook } = memoryLocation({ path: LANDING_ROUTE });
  return render(
    <Router hook={hook}>
      <Landing />
    </Router>,
  );
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

  it("names the brand where a screen reader can reach it, not only in the animation", () => {
    renderLanding();
    // الحروف المتحرّكة كلها aria-hidden، فلولا النسخة المقروءة لكان اسم
    // المنتج غائباً عن قارئ الشاشة تماماً.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("وَاف");
  });

  it("states what the name means", () => {
    renderLanding();
    expect(screen.getByText(/من وَفَى/)).toBeInTheDocument();
  });

  it("offers every live service, and none of the reserved ones, as a link", () => {
    renderLanding();
    for (const service of SERVICES) {
      const heading = screen.getByRole("heading", { name: service.name });
      const card = heading.closest("a, article");
      expect(card).not.toBeNull();
      if (service.status === "live") {
        expect(card!.tagName).toBe("A");
        expect(card).toHaveAttribute("href", service.href);
      } else {
        expect(card!.tagName).toBe("ARTICLE");
        expect(card).toHaveAttribute("aria-disabled", "true");
      }
    }
  });

  it("isolates external services from this origin", () => {
    renderLanding();
    for (const service of SERVICES.filter(item => item.external)) {
      const card = screen.getByRole("heading", { name: service.name }).closest("a")!;
      expect(card).toHaveAttribute("target", "_blank");
      expect(card).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    }
  });

  it("leads into the platform, where the password gate lives", () => {
    renderLanding();
    const ways = screen.getAllByRole("link", { name: "ادخل المنصّة" });
    expect(ways.length).toBeGreaterThan(0);
    for (const way of ways) expect(way).toHaveAttribute("href", PLATFORM_ROUTE);
  });

  it("marks exactly one render mode as the current one", () => {
    renderLanding();
    const group = screen.getByRole("group", { name: "نمط الرسم" });
    const pressed = within(group)
      .getAllByRole("button")
      .filter(button => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("characters");
  });
});
