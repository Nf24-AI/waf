/**
 * رابط Spotify أو YouTube كما يُلصق ← رابط المشغّل المضمَّن.
 *
 * يعود null على ما لا يُفهم: لا يُضمَّن عنوانٌ غريب في الصفحة لأن أحداً لصقه.
 * المقبول نطاقان معروفان وحسب، ومن الرابط تؤخذ المعرّفات وحدها لا بقيّته.
 */
export function embedUrl(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");

  if (host === "open.spotify.com") {
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
    return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}` : null;
  }

  const id = /^[A-Za-z0-9_-]{6,64}$/;
  if (host === "youtu.be") {
    const video = url.pathname.slice(1);
    return id.test(video) ? `https://www.youtube.com/embed/${video}?autoplay=1` : null;
  }
  if (host === "youtube.com" || host === "music.youtube.com" || host === "m.youtube.com") {
    const list = url.searchParams.get("list");
    const video = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:live|shorts|embed)\/([^/]+)/)?.[1] ?? null;
    const listPart = list && id.test(list) ? `list=${list}` : "";
    if (video && id.test(video)) {
      return `https://www.youtube.com/embed/${video}?autoplay=1${listPart ? `&${listPart}` : ""}`;
    }
    return listPart ? `https://www.youtube.com/embed/videoseries?autoplay=1&${listPart}` : null;
  }
  return null;
}
