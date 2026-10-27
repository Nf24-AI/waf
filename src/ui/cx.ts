/** يجمع أسماء الأصناف ويتجاهل الفارغ */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
