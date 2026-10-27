// أسماء الفئات وألوانها، وأدوات صغيرة للنصوص. الألوان أسماء أصناف ثابتة حتى يلتقطها Tailwind.

import type { Category, Priority, RepeatRule } from "@/data/types";
import { t } from "@/lib/i18n";

export type Tone = "dusk" | "saffron" | "palm" | "plum" | "slate" | "ember";

export const TONE: Record<Tone, { dot: string; wash: string; edge: string; text: string; bar: string; ring: string }> = {
  dusk: { dot: "bg-dusk", wash: "bg-dusk-wash", edge: "border-dusk", text: "text-dusk", bar: "bg-dusk", ring: "ring-dusk/45" },
  saffron: { dot: "bg-saffron", wash: "bg-saffron-wash", edge: "border-saffron", text: "text-saffron-ink", bar: "bg-saffron", ring: "ring-saffron/55" },
  palm: { dot: "bg-palm", wash: "bg-palm-wash", edge: "border-palm", text: "text-palm", bar: "bg-palm", ring: "ring-palm/45" },
  plum: { dot: "bg-plum", wash: "bg-plum-wash", edge: "border-plum", text: "text-plum", bar: "bg-plum", ring: "ring-plum/45" },
  slate: { dot: "bg-slate", wash: "bg-slate-wash", edge: "border-slate", text: "text-slate", bar: "bg-slate", ring: "ring-slate/45" },
  ember: { dot: "bg-ember", wash: "bg-ember-wash", edge: "border-ember", text: "text-ember", bar: "bg-ember", ring: "ring-ember/45" },
};

export const CATEGORY_TONE: Record<Category, Tone> = { deep: "dusk", meeting: "saffron", personal: "palm", project: "plum", other: "slate" };

const CATEGORY_NAME: Record<Category, [string, string]> = {
  deep: ["عمل عميق", "Deep work"],
  meeting: ["اجتماعات", "Meetings"],
  personal: ["شخصي", "Personal"],
  project: ["عمل على مشروع", "Project work"],
  other: ["أخرى", "Other"],
};

export type Labels = Partial<Record<Category, string>>;

export function defaultCategoryName(c: Category): string {
  return t(...CATEGORY_NAME[c]);
}

export function categoryName(c: Category, labels: Labels = {}): string {
  return labels[c]?.trim() || defaultCategoryName(c);
}

/** يقرأ أسماء الفئات المخصّصة من بيانات الحساب ويتجاهل غير الصالح */
export function readLabels(raw: unknown): Labels {
  if (!raw || typeof raw !== "object") return {};
  const out: Labels = {};
  for (const c of Object.keys(CATEGORY_NAME) as Category[]) {
    const v = (raw as Record<string, unknown>)[c];
    if (typeof v === "string" && v.trim()) out[c] = v.trim().slice(0, 24);
  }
  return out;
}

export function priorityName(p: Priority): string {
  return p === "high" ? t("عالية", "High") : p === "low" ? t("منخفضة", "Low") : t("متوسطة", "Medium");
}

export function repeatName(r: RepeatRule): string {
  switch (r) {
    case "daily":
      return t("كل يوم", "Every day");
    case "weekdays":
      return t("أيام العمل", "Workdays");
    case "weekly":
      return t("كل أسبوع", "Every week");
    case "custom":
      return t("أيام مختارة", "Chosen days");
  }
}

/** أيام الأسبوع بدءاً من الأحد */
export function weekdayShort(i: number): string {
  return t(["ح", "ن", "ث", "ر", "خ", "ج", "س"][i], ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][i]);
}
export function weekdayLong(i: number): string {
  return t(["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][i], ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]);
}

/** عنوان قصير للرسائل، معزول الاتجاه */
export function short(title: string, max = 42): string {
  const s = title.trim().replace(/\s+/g, " ");
  const cut = s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
  // عزل اتجاه العنوان حتى لا يختلط العربي بالإنجليزي داخل الجملة
  return `\u2068${cut}\u2069`;
}

export const UNDO_MS = 6000;
