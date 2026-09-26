import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { publicProcedure } from "./_core/trpc";

/**
 * الهويّة على الخادم — من رمز Supabase، لا من شيء يرسله العميل عن نفسه.
 *
 * الرمز يُقرأ ويُمرَّر كما هو إلى PostgREST، فتتحقّق قاعدة البيانات من توقيعه
 * وتطبّق `auth.uid()`. ولذلك لا نتحقّق منه هنا بنداء ثانٍ إلى Supabase: رمزٌ
 * مزوّر يُرفض عند المصدر، والنداء الإضافي يضيف رحلة شبكة لكل طلب ولا يضيف
 * أماناً.
 *
 * ونقرأ `sub` من حمولته لأن الإدراج يحتاج `user_id` صراحةً. وهي قراءة بلا
 * تحقّق عن قصد: لو زُوِّرت لسقط الطلب كلّه عند PostgREST قبل أن يُكتب شيء.
 */

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** حمولة الرمز بلا تحقّق — للحصول على المعرّف وحده. */
export function userIdFromToken(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { sub?: string; exp?: number };
    if (!claims.sub) return null;
    // رمز منتهٍ يُرفض هنا برسالة مفهومة بدل 401 غامضة من PostgREST.
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

export interface Identity {
  userId: string;
  token: string;
}

export function identityOf(req: Request): Identity | null {
  const token = bearerToken(req);
  if (!token) return null;
  const userId = userIdFromToken(token);
  return userId ? { userId, token } : null;
}

/**
 * إجراء يتطلّب حساباً.
 *
 * الرسالة عربية ومفهومة، والواجهة تحوّل UNAUTHORIZED إلى صفحة الدخول مع
 * الوجهة المقصودة — فلا يرى المستخدم رمز خطأ ولا يفقد مكانه.
 */
export const authedProcedure = publicProcedure.use(({ ctx, next }) => {
  const identity = identityOf(ctx.req);
  if (!identity) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "يلزم تسجيل الدخول." });
  }
  return next({ ctx: { ...ctx, identity } });
});
