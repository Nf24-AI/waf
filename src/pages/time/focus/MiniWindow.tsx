// النافذة المصغّرة (Document Picture-in-Picture): الأرقام وحدها فوق كل النوافذ.
// الزرّ يظهر فقط حيث يدعمها المتصفّح.

import { useCallback, useEffect, useState } from "react";

interface DocumentPip {
  requestWindow(opts: { width: number; height: number }): Promise<Window>;
  window: Window | null;
}

function pipApi(): DocumentPip | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture ?? null;
}

export const pipSupported = () => !!pipApi() && window.isSecureContext;

/** ينسخ أنماط الصفحة ولغتها ومظهرها إلى النافذة المصغّرة */
function mirror(win: Window) {
  const doc = win.document;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
  const sync = () => {
    const root = document.documentElement;
    doc.documentElement.lang = root.lang;
    doc.documentElement.dir = root.dir;
    const th = root.getAttribute("data-theme");
    if (th) doc.documentElement.setAttribute("data-theme", th);
    else doc.documentElement.removeAttribute("data-theme");
  };
  sync();
  const obs = new MutationObserver(sync);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "dir", "data-theme"] });
  win.addEventListener("pagehide", () => obs.disconnect(), { once: true });
}

export function useMiniWindow() {
  const [win, setWin] = useState<Window | null>(null);

  const open = useCallback(async () => {
    const api = pipApi();
    if (!api) return;
    if (api.window) {
      api.window.focus();
      return;
    }
    try {
      const w = await api.requestWindow({ width: 320, height: 170 });
      mirror(w);
      w.document.title = document.title;
      w.document.body.style.margin = "0";
      w.addEventListener("pagehide", () => setWin(null), { once: true });
      setWin(w);
    } catch {
      /* رفض المتصفّح أو أُغلقت */
    }
  }, []);

  const close = useCallback(() => {
    win?.close();
    setWin(null);
  }, [win]);

  // تُغلق النافذة المصغّرة حين يغادر المستخدم الصفحة
  useEffect(() => () => win?.close(), [win]);

  return { win, open, close };
}
