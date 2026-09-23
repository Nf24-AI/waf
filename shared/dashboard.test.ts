import { describe, expect, it } from "vitest";
import { attentionList, completionRate, kpisOf, needsAttention, weekBars } from "./dashboard";
import { stateOf, type Quadrant, type Task } from "./tasks";

/**
 * أرقام الشاشة الأولى: أوّل ما يُقرأ في اليوم، وآخر ما يُراجَع. الخطأ فيها
 * لا يُكتشف بالنظر — يُكتشف بعد أسبوع حين يقول العدّاد «صفر متأخّر» وصاحبه
 * يعرف غير ذلك. فتُثبَّت الحدود هنا: منتصف الليل، وحافّة الأسبوع، والصفر.
 */

let counter = 0;
function task(fields: Partial<Task> = {}): Task {
  counter += 1;
  const core = {
    id: `00000000-0000-0000-0000-00000000000${counter}`,
    title: `مهمة ${counter}`,
    completedSessions: 0,
    createdAt: "2026-09-01T06:00:00.000Z",
    ...fields,
  };
  return { ...core, state: stateOf(core) } as Task;
}

const NOW = new Date(2026, 8, 22, 14, 0, 0); // الثلاثاء ٢٢ سبتمبر، الثانية ظهراً
const local = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m, d, h, min).toISOString();

describe("ما يستحقّ الانتباه", () => {
  it("المهمّ والعاجل يستحقّه ولو لم يُجدوَل", () => {
    expect(needsAttention(task({ quadrant: "important_urgent" }), NOW.getTime())).toBe(true);
  });

  it("ما فات وقته يستحقّه أياً كان ربعه", () => {
    const late = task({
      quadrant: "not_important_not_urgent" as Quadrant,
      scheduledStart: local(2026, 8, 22, 8),
      scheduledEnd: local(2026, 8, 22, 9),
    });
    expect(needsAttention(late, NOW.getTime())).toBe(true);
  });

  it("ما لم يحن وقته بعد لا يستحقّه", () => {
    const later = task({ scheduledStart: local(2026, 8, 22, 16), scheduledEnd: local(2026, 8, 22, 17) });
    expect(needsAttention(later, NOW.getTime())).toBe(false);
  });

  it("المنجَز لا يستحقّه ولو كان متأخّراً", () => {
    const done = task({
      quadrant: "important_urgent",
      scheduledEnd: local(2026, 8, 21, 9),
      completedAt: local(2026, 8, 21, 10),
    });
    expect(needsAttention(done, NOW.getTime())).toBe(false);
  });
});

describe("بطاقات الرئيسية", () => {
  it("تعدّ المفتوح والمجدول والمتأخّر ومنجَز اليوم", () => {
    const open = [
      task({ quadrant: "important_urgent" }),
      task({ scheduledStart: local(2026, 8, 22, 16), scheduledEnd: local(2026, 8, 22, 17) }),
      task({ scheduledStart: local(2026, 8, 22, 8), scheduledEnd: local(2026, 8, 22, 9) }),
    ];
    const completed = [
      task({ completedAt: local(2026, 8, 22, 10) }),
      task({ completedAt: local(2026, 8, 21, 23, 59) }),
    ];

    const kpis = kpisOf(open, completed, NOW);
    expect(kpis.open).toBe(3);
    // المجدول هو ما لم يمضِ وقته: المتأخّرة ليست مجدولة بعد.
    expect(kpis.scheduled).toBe(1);
    expect(kpis.attention).toBe(2);
    // أمس الحادية عشرة وتسع وخمسون ليست اليوم، ولو فصلت بينهما دقيقة.
    expect(kpis.completedToday).toBe(1);
  });

  it("تقرأ صفراً بلا انهيار حين لا شيء", () => {
    expect(kpisOf([], [], NOW)).toEqual({ open: 0, scheduled: 0, attention: 0, completedToday: 0 });
  });
});

describe("معدّل الإنجاز", () => {
  it("يقيس المنجَز إلى ما كان على الطاولة", () => {
    expect(completionRate(2, 8)).toBe(80);
    expect(completionRate(8, 2)).toBe(20);
  });

  it("لا يعطي مئةً لمن لم يفتح شيئاً", () => {
    // بلا مقام لا نسبة. الصفر هنا «لا بيانات»، لا «فشل».
    expect(completionRate(0, 0)).toBe(0);
  });

  it("يعطي مئةً لمن أنهى كل ما فتحه", () => {
    expect(completionRate(0, 5)).toBe(100);
  });
});

describe("أعمدة الأسبوع", () => {
  it("سبعة أعمدة تنتهي باليوم", () => {
    const bars = weekBars([], NOW);
    expect(bars).toHaveLength(7);
    expect(bars[6].isToday).toBe(true);
    expect(bars[6].day).toBe("2026-09-22");
    expect(bars[0].day).toBe("2026-09-16");
  });

  it("يعدّ كل يوم على حدة ويتجاهل ما قبل الأسبوع", () => {
    const bars = weekBars(
      [
        task({ completedAt: local(2026, 8, 22, 9) }),
        task({ completedAt: local(2026, 8, 22, 17) }),
        task({ completedAt: local(2026, 8, 20, 12) }),
        task({ completedAt: local(2026, 8, 1, 12) }),
      ],
      NOW,
    );
    expect(bars[6].count).toBe(2);
    expect(bars[4].count).toBe(1);
    expect(bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(3);
  });
});

describe("قائمة الانتباه", () => {
  it("ترتّب الأعجل أولاً وتقصّ عند الحدّ", () => {
    const list = attentionList(
      [
        task({ quadrant: "important_urgent" }),
        task({ quadrant: "important_urgent", scheduledEnd: local(2026, 8, 22, 9) }),
        task({ quadrant: "important_urgent", scheduledEnd: local(2026, 8, 22, 8) }),
        task({ quadrant: "important_urgent", scheduledEnd: local(2026, 8, 22, 10) }),
      ],
      NOW,
      3,
    );
    expect(list).toHaveLength(3);
    expect(list.map(item => item.scheduledEnd)).toEqual([
      local(2026, 8, 22, 8),
      local(2026, 8, 22, 9),
      local(2026, 8, 22, 10),
    ]);
  });
});
