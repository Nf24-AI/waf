import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { type Identity } from "./auth";
import { PROJECT_COLORS, type Project, type ProjectColor } from "@shared/projects";

/**
 * المشاريع في Supabase، بملكية كل صفّ لصاحبه.
 *
 * والجدول قد لا يكون رُحِّل بعد: النشر لا ينتظر الترحيل في هذا المشروع، وقد
 * كلّفنا ذلك عطلاً كاملاً مرّة. فغيابُ الجدول هنا يعني «لا مشاريع» لا انهيار
 * الصفحة — تُفقد الميزة وحدها، وتبقى اللوحة تعمل.
 */

const TABLE = "waf_projects";

function credentials() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المشاريع غير مضبوطة." });
  }
  return { url: ENV.supabaseUrl.replace(/\/$/, ""), key: ENV.supabaseAnonKey };
}

/** رمز PostgREST حين يُطلب جدول لا وجود له. */
function tableMissing(detail: string): boolean {
  return /42P01/.test(detail) || /relation .* does not exist/i.test(detail);
}

async function rest<T>(who: Identity, path: string, init: RequestInit = {}): Promise<T | null> {
  const { url, key } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${who.token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    console.error("[projects]", response.status, detail);
    // الجدول غائب: تُعاد قيمة فارغة لا خطأ، فلا تسقط اللوحة معه.
    if (tableMissing(detail)) return null;
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر تنفيذ العملية. حاول مرة أخرى." });
  }

  // POST بلا «Prefer: return=representation» يردّ 201 بجسم فارغ، لا 204:
  // فالحكم للجسم لا للرمز، وإلا انكسر json() على لا شيء.
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

interface Row {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

function toProject(row: Row): Project {
  const color = PROJECT_COLORS.includes(row.color as ProjectColor) ? (row.color as ProjectColor) : "accent";
  return { id: row.id, name: row.name, color, createdAt: row.created_at };
}

export async function listProjects(who: Identity): Promise<Project[]> {
  const rows = await rest<Row[]>(who, `${TABLE}?select=id,name,color,created_at&order=created_at.asc`);
  return (rows ?? []).map(toProject);
}

export async function createProject(
  who: Identity,
  input: { name: string; color?: ProjectColor },
): Promise<Project | null> {
  const [row] =
    (await rest<Row[]>(who, `${TABLE}?select=id,name,color,created_at`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: who.userId,
        name: input.name.trim(),
        color: input.color ?? "accent",
      }),
    })) ?? [];

  return row ? toProject(row) : null;
}
