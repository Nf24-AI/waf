/**
 * Naming the saved file.
 *
 * "Save as PDF" is the browser's own print destination, and the only hook it
 * gives us for the file name is document.title. So the export swaps the title
 * for the length of the print job and puts it back afterwards — this builds
 * the name it swaps in.
 *
 * Windows, macOS and Linux each reject a different subset of the characters
 * below, and Windows also drops a trailing dot, so those are removed rather
 * than substituted: a name with the gap closed reads better than one wearing
 * underscores. Arabic itself needs no escaping — every file system in play
 * stores UTF-8 names.
 */

const UNSAFE = /[\\/:*?"<>|]/g;

/** Longer than this and the save dialog truncates it anyway. */
const MAX_LENGTH = 120;

/**
 * The file name for one meeting, without extension — the browser appends .pdf.
 *
 * "واف — مراجعة الربع الثالث — ١٥ سبتمبر ٢٠٢٥"
 */
export function meetingFileName(
  meeting: { title: string; date: string },
  language: "ar" | "en" = "ar"
): string {
  const clean = (part: string) =>
    (part ?? "")
      .replace(UNSAFE, " ")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "");

  const untitled = language === "ar" ? "اجتماع" : "Meeting";
  const parts = [
    language === "ar" ? "واف" : "Waf",
    clean(meeting.title) || untitled,
    clean(meeting.date),
  ].filter(Boolean);

  return parts.join(" — ").slice(0, MAX_LENGTH).trimEnd();
}
