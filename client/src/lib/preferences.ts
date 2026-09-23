/**
 * تفضيلات محليّة — في المتصفّح لا في الخادم.
 *
 * الاسم والمدّة الافتراضية لا يستحقّان جدولاً ولا طلب شبكة: لا يُقرآن إلا
 * على هذا الجهاز ولا يضرّ ضياعهما. وكل قراءة محاطة بـtry: التصفّح الخاص
 * يرمي عند اللمس، ولا يصحّ أن تنكسر الصفحة من أجل تفضيل.
 */

const NAME_KEY = "waf:name";
const FOCUS_KEY = "waf:focus-minutes";

export const DEFAULT_FOCUS_MINUTES = 25;

export function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeName(name: string): void {
  try {
    const clean = name.trim();
    if (clean) localStorage.setItem(NAME_KEY, clean.slice(0, 40));
    else localStorage.removeItem(NAME_KEY);
  } catch {
    /* لا شيء يُفعل: التحيّة تبقى بلا اسم. */
  }
}

export function readFocusMinutes(): number {
  try {
    const raw = Number(localStorage.getItem(FOCUS_KEY));
    return Number.isInteger(raw) && raw >= 1 && raw <= 240 ? raw : DEFAULT_FOCUS_MINUTES;
  } catch {
    return DEFAULT_FOCUS_MINUTES;
  }
}

export function writeFocusMinutes(minutes: number): void {
  try {
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 240) {
      localStorage.setItem(FOCUS_KEY, String(minutes));
    }
  } catch {
    /* لا شيء يُفعل: تبقى المدّة الافتراضية. */
  }
}
