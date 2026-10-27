// رابط الموسيقى: Spotify أو YouTube فقط، بـ https فقط. يُحلَّل الرابط تحليلاً صارماً
// ويُبنى رابط المشغّل المضمَّن من المعرّف وحده، فلا يمرّ شيء من الرابط الأصلي كما هو.

export interface Embed {
  kind: "spotify" | "youtube";
  src: string;
  /** ارتفاع المشغّل المناسب بالبكسل */
  height: number;
}

const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "episode", "show", "artist"]);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST = /^[A-Za-z0-9_-]{10,64}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

export function parseMusicUrl(input: string): Embed | null {
  const raw = input.trim();
  if (!raw || raw.length > 500 || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "open.spotify.com") {
    // /intl-ar/track/ID أو /embed/track/ID أو /track/ID
    const p = parts[0]?.startsWith("intl-") || parts[0] === "embed" ? parts.slice(1) : parts;
    if (p.length !== 2 || !SPOTIFY_TYPES.has(p[0]) || !SPOTIFY_ID.test(p[1])) return null;
    const compact = p[0] === "track" || p[0] === "episode";
    return { kind: "spotify", src: `https://open.spotify.com/embed/${p[0]}/${p[1]}?utm_source=generator`, height: compact ? 152 : 352 };
  }

  let video: string | null = null;
  const listRaw = url.searchParams.get("list");
  const list = listRaw && YT_LIST.test(listRaw) ? listRaw : null;
  if (listRaw && !list) return null;

  if (host === "youtu.be") {
    if (parts.length !== 1) return null;
    video = parts[0];
  } else if (YT_HOSTS.has(host)) {
    if (parts[0] === "watch" && parts.length === 1) video = url.searchParams.get("v");
    else if (parts[0] === "playlist" && parts.length === 1) video = null;
    else if (["shorts", "live", "embed"].includes(parts[0]) && parts.length === 2) video = parts[1];
    else return null;
  } else {
    return null;
  }

  if (video != null && !YT_ID.test(video)) return null;
  if (!video && !list) return null;
  const q = new URLSearchParams({ rel: "0" });
  if (list) q.set("list", list);
  const path = video ? video : "videoseries";
  return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${path}?${q}`, height: 200 };
}
