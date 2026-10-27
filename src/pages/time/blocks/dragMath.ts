// سرعة التمرير التلقائي أثناء السحب: تزيد كلما اقترب المؤشّر من الحافّة.

export const EDGE = 56;
export const MAX_SPEED = 18;

/** بكسلات التمرير في الإطار: سالبة للأعلى، موجبة للأسفل، صفر بعيداً عن الحافّتين */
export function dragSpeed(y: number, top: number, bottom: number, edge = EDGE, max = MAX_SPEED): number {
  if (bottom - top < edge * 3) return 0;
  if (y < top + edge) return -Math.ceil(max * Math.min(1, (top + edge - y) / edge));
  if (y > bottom - edge) return Math.ceil(max * Math.min(1, (y - (bottom - edge)) / edge));
  return 0;
}
