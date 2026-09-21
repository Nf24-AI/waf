/**
 * ما ينقص jsdom من واجهات المتصفح.
 *
 * framer-motion يسأل عن matchMedia ليقرأ prefers-reduced-motion، وعن
 * IntersectionObserver ليعرف متى دخل العنصر إطار العرض. الاثنتان موجودتان
 * في كل متصفح تعمل فيه الصفحة، وغيابهما خاصّيةُ بيئة الاختبار لا نقصٌ في
 * الكود — فمكان تعويضهما هنا، لا حارسٌ في كل مكوّن.
 *
 * المراقب هنا لا يراقب شيئاً: jsdom بلا تخطيط، فلا شيء «يدخل» إطار العرض
 * أصلاً. الاختبارات تفحص ما تُخرجه الصفحة لا متى يظهر.
 */
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  if (typeof window.IntersectionObserver === "undefined") {
    class NoopIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    window.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
    globalThis.IntersectionObserver = window.IntersectionObserver;
  }

  // Lenis يقيس المستند عبر ResizeObserver عند الإنشاء.
  if (typeof window.ResizeObserver === "undefined") {
    class NoopResizeObserver implements ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
    globalThis.ResizeObserver = window.ResizeObserver;
  }
}
