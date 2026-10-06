import { describe, expect, it } from "vitest";
import { embedUrl } from "./stream";

describe("embedUrl", () => {
  it("turns a Spotify link into its player", () => {
    expect(embedUrl("https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6?si=abc")).toBe(
      "https://open.spotify.com/embed/playlist/37i9dQZF1DX8NTLI2TtZa6",
    );
    expect(embedUrl("https://open.spotify.com/intl-ar/track/4uLU6hMCjMI75M1A2tKUQC")).toBe(
      "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
    );
  });

  it("turns YouTube links into their player", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=jfKfPfyJRdk")).toBe(
      "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1",
    );
    expect(embedUrl("https://youtu.be/jfKfPfyJRdk?t=10")).toBe("https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1");
    expect(embedUrl("https://music.youtube.com/playlist?list=PLabc_123-xyz")).toBe(
      "https://www.youtube.com/embed/videoseries?autoplay=1&list=PLabc_123-xyz",
    );
  });

  it("refuses anything it does not recognise", () => {
    expect(embedUrl("https://example.com/watch?v=jfKfPfyJRdk")).toBeNull();
    expect(embedUrl("http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
    expect(embedUrl("https://www.youtube.com/watch?v=\"><script>")).toBeNull();
    expect(embedUrl("not a link")).toBeNull();
  });
});
