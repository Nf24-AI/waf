import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل Supabase في المتصفّح — للهويّة وحدها.
 *
 * المفتاح هنا عامّ عن قصد، وهذا صحيح بعد تفعيل RLS لا قبله: قبلها كان المفتاح
 * مع رمز المالك يفتح الجدول كلّه، فبقي في الخادم. وبعدها لا يفتح المفتاح شيئاً
 * بذاته — القرار في `auth.uid()` داخل قاعدة البيانات، والمفتاح مجرّد عنوان.
 *
 * والبيانات لا تُقرأ من هنا: الصفحات تنادي tRPC كما كانت، ويمرّر الخادم رمز
 * الجلسة إلى PostgREST فتُطبَّق السياسات. فلا يُعاد بناء طبقة البيانات كلّها
 * من أجل تسجيل الدخول.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** هل ضُبطت المصادقة أصلاً؟ بدونها تبقى الصفحات العامّة تعمل. */
export const authConfigured = Boolean(url && anonKey);

/**
 * عميل واحد لكل الصفحة.
 *
 * إنشاء عميل ثانٍ يعني مستمعَين لتغيّر الجلسة ومخزنَين لها، فتتضارب
 * الحالتان بعد تحديث الرمز.
 */
export const supabase: SupabaseClient | null = authConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // الجلسة تُلتقط من رابط التحقّق ثم يُنظَّف الرابط، فلا يبقى الرمز
        // في شريط العنوان ولا في سجلّ التصفّح.
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

/** رمز الوصول الحالي، أو `null` لزائر. يُستعمل في ترويسة كل نداء. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
