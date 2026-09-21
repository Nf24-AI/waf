import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import Landing from "./Landing";
import { SERVICES } from "@shared/services";
import { LANDING_ROUTE, PLATFORM_ROUTE } from "@shared/routes";

/**
 * صفحة الهبوط هي المسار الوحيد الذي يُقرأ بلا كلمة مرور، فهي الصفحة الوحيدة
 * التي يراها غريب. ما يُكسر فيها بصمت: اسم المنتج يغيب عن قارئ الشاشة لأن
 * الحركة تخفي حروفه، صورة تنومة تفقد بديلها النصّي، أو وجهة خدمة تتباعد عن
 * الكتالوج لأن أحدهم كتب الرابط بيده.
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
      throw new Error(String(message));
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    cleanup();
  });

  it("tells the photograph's story as the page heading", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("من هناك بدأنا");
  });

  it("names the brand where a screen reader can reach it, not only in the animation", () => {
    renderLanding();
    // الحروف المتحرّكة كلها aria-hidden، فلولا النسخة المقروءة لكان اسم
    // المنتج غائباً عن قارئ الشاشة تماماً.
    expect(screen.getByText("واف", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("describes the photograph rather than leaving it unlabelled", () => {
    renderLanding();
    const photo = screen.getByRole("img");
    expect(photo).toHaveAccessibleName(expect.stringContaining("تنومة"));
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
    const destinations = enters.map(link => link.getAttribute("href"));
    expect(destinations).toEqual([href("meetings"), href("time")]);
  });

  it("isolates the externally hosted service from this origin", () => {
    renderLanding();
    // إدارة الوقت تعيش على أصل آخر: كلا رابطيها يفتح لساناً جديداً معزولاً.
    for (const link of screen.getAllByRole("link", { name: /إدارة الوقت/ })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    }
  });

  it("leads into the platform, where the password gate lives", () => {
    renderLanding();
    const ways = screen.getAllByRole("link", { name: "ادخل المنصّة" });
    expect(ways.length).toBeGreaterThan(0);
    for (const way of ways) expect(way).toHaveAttribute("href", PLATFORM_ROUTE);
  });
});
