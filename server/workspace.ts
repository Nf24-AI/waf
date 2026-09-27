import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { authedProcedure } from "./auth";
import { type Identity } from "./auth";

/**
 * الاجتماعات مساحة عمل واحدة، لا بيانات لكل مستخدم.
 *
 * تعيش في Notion خلف توكن واحد وقاعدة واحدة، ولا يوجد فيها عمود مالك. فكل
 * من يسجّل حساباً ويفتح ‎/meetings يقرأ اجتماعات صاحب المساحة — وهذا تسريب
 * لا نقص ميزة.
 *
 * نقلها إلى Supabase بملكية لكل صفّ هو الحلّ الصحيح، وهو عمل كبير يعيد بناء
 * التحضير وصفحة العرض وسجلّ القرارات وتقرير الحالة. وحتى ذلك الحين لا يصحّ
 * أن يبقى الباب مفتوحاً: تُقيَّد الخدمة بمن يملك المساحة، ويُقال لغيره لماذا
 * لا يراها — لا «غير مسموح» ولا صفحة خطأ.
 *
 * العَلَم في `profiles` لا في متغيّر بيئة: منحه لشخصٍ ثانٍ يصير سطراً في
 * قاعدة البيانات لا إعادة نشر.
 */

async function ownsWorkspace(who: Identity): Promise<boolean> {
  const url = ENV.supabaseUrl.replace(/\/$/, "");
  if (!url || !ENV.supabaseAnonKey) return false;

  const response = await fetch(
    `${url}/rest/v1/profiles?id=eq.${who.userId}&select=can_access_meetings`,
    {
      headers: {
        apikey: ENV.supabaseAnonKey,
        // برمز المستخدم: RLS تسمح له بقراءة ملفّه وحده، فلا يُقرأ ملفّ غيره.
        Authorization: `Bearer ${who.token}`,
      },
    },
  );

  if (!response.ok) {
    console.error("[workspace] profile read failed", response.status);
    return false;
  }

  const rows = (await response.json()) as { can_access_meetings?: boolean }[];
  return rows[0]?.can_access_meetings === true;
}

/** يجيب بلا رمي: الشريط والصفحات تسأل قبل أن تعرض، لا بعد أن تفشل. */
export const workspaceAccess = authedProcedure.query(({ ctx }) => ownsWorkspace(ctx.identity).then(owner => ({ owner })));

/**
 * إجراء يتطلّب ملكية المساحة.
 *
 * الرسالة نفسها تُعرض للمستخدم، فهي بالعربية وتقول السبب لا الحكم.
 */
export const workspaceProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (!(await ownsWorkspace(ctx.identity))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "خدمة الاجتماعات مرتبطة بمساحة عمل واحدة، وحسابك ليس مالكها بعد.",
    });
  }
  return next({ ctx });
});
