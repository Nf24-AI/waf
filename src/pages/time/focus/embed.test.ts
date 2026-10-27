import { describe, expect, it } from "vitest";
import { parseMusicUrl } from "./embed";

const SP = "4uLU6hMCjMI75M1A2tKUQC";
const YT = "dQw4w9WgXcQ";

describe("parseMusicUrl", () => {
  it.each([
    [`https://open.spotify.com/track/${SP}`, `https://open.spotify.com/embed/track/${SP}?utm_source=generator`],
    [`https://open.spotify.com/intl-ar/playlist/${SP}?si=abc`, `https://open.spotify.com/embed/playlist/${SP}?utm_source=generator`],
    [`https://open.spotify.com/embed/album/${SP}`, `https://open.spotify.com/embed/album/${SP}?utm_source=generator`],
    [`https://open.spotify.com/artist/${SP}`, `https://open.spotify.com/embed/artist/${SP}?utm_source=generator`],
    [`https://youtu.be/${YT}?t=10`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`],
    [`https://www.youtube.com/watch?v=${YT}`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`],
    [`https://m.youtube.com/watch?v=${YT}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`],
    [`https://music.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`, `https://www.youtube-nocookie.com/embed/videoseries?rel=0&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`],
    [`https://youtube.com/shorts/${YT}`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`],
    [`https://www.youtube.com/live/${YT}`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`],
    [`  https://youtu.be/${YT}  `, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`],
  ])("accepts %s", (input, src) => {
    expect(parseMusicUrl(input)?.src).toBe(src);
  });

  it.each([
    "",
    "not a url",
    `http://youtu.be/${YT}`,
    `https://youtu.be.evil.com/${YT}`,
    `https://evil.com/youtube.com/watch?v=${YT}`,
    `https://user:pw@www.youtube.com/watch?v=${YT}`,
    `https://www.youtube.com:8443/watch?v=${YT}`,
    `https://www.youtube.com/watch?v=short`,
    `https://www.youtube.com/watch?v=${YT}"onload="x`,
    `https://www.youtube.com/channel/UC123`,
    `https://www.youtube.com/watch?v=${YT}&list=<script>`,
    `https://open.spotify.com/user/${SP}`,
    `https://open.spotify.com/track/short`,
    `https://open.spotify.com.evil.com/track/${SP}`,
    `javascript:alert(1)`,
    `data:text/html,<b>x</b>`,
    `https://spotify.com/track/${SP}`,
  ])("rejects %s", (input) => {
    expect(parseMusicUrl(input)).toBeNull();
  });
});
