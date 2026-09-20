import { describe, expect, it } from "vitest";
import {
  collectDecisions,
  decisionOwners,
  filterDecisions,
  unownedCount,
  type DecisionEntry,
} from "./decisions";
import type { MeetingAgendaItem, MeetingRecord } from "./meeting-store";

function agenda(partial: Partial<MeetingAgendaItem>): MeetingAgendaItem {
  return { title: "", context: "", goal: "", decision: "", owner: "", ...partial };
}

function meeting(partial: Partial<MeetingRecord>): MeetingRecord {
  return {
    id: "m1",
    title: "اجتماع",
    date: "2026-09-01",
    time: "",
    type: "داخلي",
    status: "تم الاجتماع",
    attendees: [],
    summary: "",
    agenda: [],
    actions: [],
    note: "",
    link: "",
    image: "",
    ...partial,
  };
}

describe("collecting decisions from meetings", () => {
  it("takes an agenda item that was decided, and leaves one that was not", () => {
    const entries = collectDecisions([
      meeting({
        agenda: [
          agenda({ title: "التسعير", decision: "نثبّت السعر حتى الربع القادم" }),
          agenda({ title: "التوظيف" }), // نُوقش ولم يُقرَّر فيه شيء
          agenda({ title: "الفراغ", decision: "   " }), // مسافات ليست قراراً
        ],
      }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].decision).toBe("نثبّت السعر حتى الربع القادم");
    expect(entries[0].topic).toBe("التسعير");
  });

  it("carries the meeting with the decision, so 'when' and 'who was there' survive", () => {
    const [entry] = collectDecisions([
      meeting({
        id: "abc",
        title: "مراجعة الربع",
        type: "قيادة",
        date: "2026-09-10",
        attendees: ["نواف", "سارة"],
        agenda: [agenda({ title: "الميزانية", decision: "نؤجّل البند", owner: "نواف" })],
      }),
    ]);

    expect(entry.meetingId).toBe("abc");
    expect(entry.meetingTitle).toBe("مراجعة الربع");
    expect(entry.meetingType).toBe("قيادة");
    expect(entry.date).toBe("2026-09-10");
    expect(entry.owner).toBe("نواف");
    expect(entry.attendees).toEqual(["نواف", "سارة"]);
  });

  it("keeps ids unique across meetings and across items in one meeting", () => {
    const entries = collectDecisions([
      meeting({ id: "a", agenda: [agenda({ decision: "س" }), agenda({ decision: "ص" })] }),
      meeting({ id: "b", agenda: [agenda({ decision: "ع" })] }),
    ]);

    expect(entries).toHaveLength(3);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(3);
  });

  it("puts the newest decision first", () => {
    const entries = collectDecisions([
      meeting({ id: "old", date: "2026-01-05", agenda: [agenda({ decision: "قديم" })] }),
      meeting({ id: "new", date: "2026-09-18", agenda: [agenda({ decision: "جديد" })] }),
      meeting({ id: "mid", date: "2026-05-02", agenda: [agenda({ decision: "وسط" })] }),
    ]);

    expect(entries.map((entry) => entry.decision)).toEqual(["جديد", "وسط", "قديم"]);
  });

  it("shows a decision whose date cannot be read rather than dropping it", () => {
    const entries = collectDecisions([
      meeting({ id: "ok", date: "2026-09-18", agenda: [agenda({ decision: "مؤرَّخ" })] }),
      meeting({ id: "bad", date: "قريباً", agenda: [agenda({ decision: "بلا تاريخ" })] }),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0].decision).toBe("مؤرَّخ");
    expect(entries[1].decision).toBe("بلا تاريخ");
    expect(entries[1].isoDate).toBeNull();
  });

  it("keeps an unowned decision, because a decision nobody owns is the point", () => {
    const entries = collectDecisions([
      meeting({ agenda: [agenda({ decision: "نغيّر المزوّد", owner: "" })] }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].owner).toBe("");
    expect(unownedCount(entries)).toBe(1);
  });

  it("returns nothing for meetings that decided nothing", () => {
    expect(collectDecisions([])).toEqual([]);
    expect(collectDecisions([meeting({ agenda: [] })])).toEqual([]);
  });
});

describe("filtering the log", () => {
  const entries: DecisionEntry[] = collectDecisions([
    meeting({
      id: "m1",
      title: "مراجعة التأمين",
      date: "2026-09-10",
      agenda: [
        agenda({ title: "المزوّد", context: "تأخّر التسليم", decision: "ننتقل إلى سلامة", owner: "نواف" }),
        agenda({ title: "التسعير", decision: "نثبّت السعر", owner: "سارة" }),
      ],
    }),
    meeting({
      id: "m2",
      title: "اجتماع الشركاء",
      date: "2026-08-02",
      agenda: [agenda({ title: "التكامل", decision: "نبدأ بالمرحلة الأولى", owner: "نواف" })],
    }),
  ]);

  it("returns everything when nothing is asked", () => {
    expect(filterDecisions(entries)).toHaveLength(3);
    expect(filterDecisions(entries, { query: "  ", owner: "" })).toHaveLength(3);
  });

  it("narrows to one owner", () => {
    const mine = filterDecisions(entries, { owner: "نواف" });
    expect(mine).toHaveLength(2);
    expect(mine.every((entry) => entry.owner === "نواف")).toBe(true);
  });

  it("searches the decision text", () => {
    expect(filterDecisions(entries, { query: "سلامة" })).toHaveLength(1);
  });

  it("also searches the meeting, the topic and the owner, not just the decision", () => {
    // من يفتح السجلّ يتذكّر أين قيل الشيء أو من قاله أكثر من صيغته الحرفية
    expect(filterDecisions(entries, { query: "الشركاء" })).toHaveLength(1);
    expect(filterDecisions(entries, { query: "التسعير" })).toHaveLength(1);
    expect(filterDecisions(entries, { query: "سارة" })).toHaveLength(1);
    expect(filterDecisions(entries, { query: "تأخّر التسليم" })).toHaveLength(1);
  });

  it("combines the owner and the search", () => {
    expect(filterDecisions(entries, { owner: "نواف", query: "التكامل" })).toHaveLength(1);
    expect(filterDecisions(entries, { owner: "سارة", query: "التكامل" })).toHaveLength(0);
  });

  it("ignores case for Latin text", () => {
    const latin = collectDecisions([
      meeting({ agenda: [agenda({ decision: "Move to Salama", owner: "Nawaf" })] }),
    ]);
    expect(filterDecisions(latin, { query: "salama" })).toHaveLength(1);
    expect(filterDecisions(latin, { query: "SALAMA" })).toHaveLength(1);
  });

  it("returns nothing rather than everything when nothing matches", () => {
    expect(filterDecisions(entries, { query: "لا يوجد هذا النص" })).toEqual([]);
  });
});

describe("owners list", () => {
  it("lists each owner once, sorted, without the unowned blank", () => {
    const entries = collectDecisions([
      meeting({ id: "a", agenda: [agenda({ decision: "١", owner: "نواف" }), agenda({ decision: "٢", owner: "" })] }),
      meeting({ id: "b", agenda: [agenda({ decision: "٣", owner: "نواف" }), agenda({ decision: "٤", owner: "سارة" })] }),
    ]);

    const owners = decisionOwners(entries);
    expect(owners).toHaveLength(2);
    expect(new Set(owners)).toEqual(new Set(["نواف", "سارة"]));
    expect(owners).not.toContain("");
  });
});
