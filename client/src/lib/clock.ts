/**
 * حساب الوقت في إدارة الوقت — بتوقيت الجهاز، والخادم يخزّن UTC.
 *
 * المستخدم يكتب «العاشرة» ويقصد عاشرته هو. فتُبنى اللحظة من يومه ووقته
 * المحليَّين ثم تُحوَّل ISO عند الإرسال، وتُقرأ محليةً عند العرض. أي حساب
 * يمرّ على سلسلة UTC في الطريق يزيح الموعد ثلاث ساعات في الرياض.
 */

/** «10:00» — الصيغة التي تفهمها خانة <input type="time">. */
export function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** «2026-09-22» — الصيغة التي تفهمها خانة <input type="date">. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** يبني لحظة من يوم ووقت محليَّين، ثم يحوّلها ISO للخادم. */
export function toIso(day: string, time: string): string {
  return new Date(`${day}T${time}`).toISOString();
}

/** أقرب نصف ساعة قادمة: بداية مقترحة لا تبدأ في الدقيقة السابعة والأربعين. */
export function nextHalfHour(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() > 30 ? 60 : 30);
  return start;
}

/**
 * وقت الانتهاء المعروض تحت البطاقة.
 *
 * يعود فارغاً على مدخل ناقص أو مشوّه بدل أن يعرض «Invalid Date»: الخانة
 * تُقرأ وهي تُملأ، وثانيةٌ من الهراء أسوأ من فراغ.
 */
export function endTime(day: string, start: string, minutes: number): string {
  if (!day || !start) return "";
  const end = new Date(`${day}T${start}`);
  if (Number.isNaN(end.getTime())) return "";
  end.setMinutes(end.getMinutes() + minutes);
  return toTimeInput(end);
}

/** «24:59» من ثوانٍ — عدّاد جلسة التركيز. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * خمسة أيام تبدأ بيومين قبل اليوم.
 *
 * المرجع يعرض شريطاً لا خانة تاريخ: الحجز يقع في هذا الأسبوع غالباً، واختيار
 * يوم بلمسة أسرع من فتح تقويم. وما بعدها يبقى لخانة التاريخ لمن يحتاجها.
 */
export function dayStrip(now: Date = new Date(), back = 2, forward = 2): Date[] {
  const days: Date[] = [];
  for (let offset = -back; offset <= forward; offset += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    days.push(day);
  }
  return days;
}

/** «السبت» — اسم اليوم وحده، لشريط الأيام. */
export function dayName(date: Date): string {
  return date.toLocaleDateString("ar-SA", { weekday: "long" });
}
