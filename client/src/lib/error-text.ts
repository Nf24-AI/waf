import { getLang } from "./i18n";

/**
 * نصّ الخطأ كما يُقال لصاحبه، بلغة الواجهة.
 *
 * الخادم يكتب رسائله بالعربية ولا يعرف لغة أحد. فبالعربية تُعرض رسالته كما
 * هي، وبالإنجليزية تُبنى الجملة هنا من رمز الخطأ — ومن اسم المهمة إن حملته
 * الرسالة بين «» — بدل أن يرى قارئ الإنجليزية سطراً عربياً لا يقرؤه.
 *
 * ورفضُ التحقق يصل مصفوفة JSON خاماً من zod؛ عرضها كما هي يملأ الإشعار رموزاً
 * لا يفهمها أحد. فتؤخذ رسالة أول مشكلة، وما لا يُقرأ يُستبدل بجملة عامّة.
 */

const FALLBACK = {
  ar: "تعذّر تنفيذ العملية. حاول مرة أخرى.",
  en: "Something went wrong. Try again.",
} as const;

const BY_CODE: Record<string, string> = {
  NOT_FOUND: "That item no longer exists.",
  UNAUTHORIZED: "Your session has ended. Sign in again.",
  FORBIDDEN: "You do not have access to that.",
  TOO_MANY_REQUESTS: "Too many requests. Wait a moment and try again.",
  TIMEOUT: "The request timed out. Try again.",
};

function codeOf(error: unknown): string | undefined {
  return (error as { data?: { code?: string } } | null)?.data?.code;
}

/** أول رسالة من مصفوفة zod، أو `null` إن لم تكن الرسالة مصفوفة. */
function firstIssue(message: string): string | null {
  if (!message.startsWith("[")) return null;
  try {
    return (JSON.parse(message) as { message?: string }[])[0]?.message ?? "";
  } catch {
    return "";
  }
}

export function errorText(error: unknown): string {
  const lang = getLang();
  const message = ((error as Error | null)?.message ?? "").trim();
  const issue = firstIssue(message);

  if (lang === "ar") {
    if (issue === null) return message || FALLBACK.ar;
    return /[؀-ۿ]/.test(issue) ? issue : FALLBACK.ar;
  }

  const code = codeOf(error);
  if (code === "CONFLICT") {
    const other = message.match(/«([^»]+)»/)?.[1];
    return other ? `That time overlaps “${other}”.` : "That time overlaps another block.";
  }
  if (code === "BAD_REQUEST" || issue !== null) {
    if (/الانتهاء/.test(message)) return "End time must be after the start.";
    if (/ترحيل/.test(message)) return "This repeat option is not available yet. Choose daily or weekly.";
    if (/عنوان/.test(message) || /عنوان/.test(issue ?? "")) return "The task needs a name.";
    return "That input was not accepted. Check it and try again.";
  }
  return (code && BY_CODE[code]) || FALLBACK.en;
}
