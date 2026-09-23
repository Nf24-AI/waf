-- واف — الهوية والملكية وعزل البيانات.
--
-- شغّله على المشروع الذي يشير إليه SUPABASE_URL في Vercel، مرّة واحدة.
-- الملف قابل لإعادة التشغيل: كل شيء فيه `if not exists` أو `drop … create`.
--
-- ما يفعله:
--   1. جدول profiles مربوط بـauth.users
--   2. عمود user_id على المهام والجلسات، مربوط بـauth.users
--   3. RLS على auth.uid() — الحدّ في قاعدة البيانات لا في الواجهة
--
-- ولا يحذف شيئاً. الصفوف القديمة المملوكة بـowner_code تبقى كما هي، وتصير
-- غير مرئية لأنها بلا user_id — فإن كان فيها ما يهمّك فاربطه بحسابك بعد
-- التسجيل (الاستعلام في آخر الملف).

-- ============================================================
-- 1) الملفّات الشخصية
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  avatar_url  text,
  timezone    text not null default 'Asia/Riyadh',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

create policy "read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- الملفّ يُنشأ مع الحساب لا من المتصفّح: عميلٌ ينسى إنشاءه يترك مستخدماً
-- بلا ملفّ، والمُشغِّل لا ينسى.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2) الملكية على المهام والجلسات
-- ============================================================
--
-- العمود يُضاف قابلاً للفراغ: الصفوف القديمة لا user_id لها، وجعله NOT NULL
-- الآن يُفشل الترحيل عليها. الحارس هو RLS لا القيد — ولا تُقرأ ولا تُكتب
-- صفّاً بلا مالك مطابق على أي حال.

alter table public.eisenhower_tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.waf_focus_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists eisenhower_tasks_user_idx on public.eisenhower_tasks (user_id, created_at desc);
create index if not exists waf_focus_sessions_user_idx on public.waf_focus_sessions (user_id, started_at desc);

-- ============================================================
-- 3) العزل
-- ============================================================
--
-- سياسات owner_code القديمة تُحذف: بقاؤها يعني باباً ثانياً للجدول نفسه،
-- ومن يعرف الرمز يقرأ مهام الجميع. الرمز كان يكفي لمستخدم واحد، ولا يكفي
-- للحظة التي يسجّل فيها ثانٍ.

alter table public.eisenhower_tasks  enable row level security;
alter table public.waf_focus_sessions enable row level security;

drop policy if exists "code reads own tasks"      on public.eisenhower_tasks;
drop policy if exists "code inserts own tasks"    on public.eisenhower_tasks;
drop policy if exists "code updates own tasks"    on public.eisenhower_tasks;
drop policy if exists "code deletes own tasks"    on public.eisenhower_tasks;
drop policy if exists "code reads own sessions"   on public.waf_focus_sessions;
drop policy if exists "code inserts own sessions" on public.waf_focus_sessions;
drop policy if exists "code updates own sessions" on public.waf_focus_sessions;
drop policy if exists "code deletes own sessions" on public.waf_focus_sessions;

drop policy if exists "owner reads tasks"    on public.eisenhower_tasks;
drop policy if exists "owner inserts tasks"  on public.eisenhower_tasks;
drop policy if exists "owner updates tasks"  on public.eisenhower_tasks;
drop policy if exists "owner deletes tasks"  on public.eisenhower_tasks;

create policy "owner reads tasks"   on public.eisenhower_tasks for select using (auth.uid() = user_id);
create policy "owner inserts tasks" on public.eisenhower_tasks for insert with check (auth.uid() = user_id);
create policy "owner updates tasks" on public.eisenhower_tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner deletes tasks" on public.eisenhower_tasks for delete using (auth.uid() = user_id);

drop policy if exists "owner reads sessions"   on public.waf_focus_sessions;
drop policy if exists "owner inserts sessions" on public.waf_focus_sessions;
drop policy if exists "owner updates sessions" on public.waf_focus_sessions;
drop policy if exists "owner deletes sessions" on public.waf_focus_sessions;

create policy "owner reads sessions"   on public.waf_focus_sessions for select using (auth.uid() = user_id);
create policy "owner inserts sessions" on public.waf_focus_sessions for insert with check (auth.uid() = user_id);
create policy "owner updates sessions" on public.waf_focus_sessions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner deletes sessions" on public.waf_focus_sessions for delete using (auth.uid() = user_id);

-- anon لم يعد يكتب بالرمز؛ الوصول كلّه بجلسة موثّقة.
revoke all on public.eisenhower_tasks  from anon;
revoke all on public.waf_focus_sessions from anon;
grant select, insert, update, delete on public.eisenhower_tasks  to authenticated;
grant select, insert, update, delete on public.waf_focus_sessions to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- ============================================================
-- تحقّق
-- ============================================================

-- الأعمدة الجديدة موجودة؟ يجب أن يعود صفّان.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name = 'user_id'
  and table_name in ('eisenhower_tasks', 'waf_focus_sessions');

-- كم صفّاً قديماً بلا مالك؟ إن كان صفراً فلا شيء يحتاج نقلاً.
select count(*) as rows_without_owner from public.eisenhower_tasks where user_id is null;

-- لنقل صفوف قديمة إلى حسابك بعد التسجيل، استبدل البريد ثم شغّل:
--
--   update public.eisenhower_tasks
--      set user_id = (select id from auth.users where email = 'you@example.com')
--    where user_id is null;
--
--   update public.waf_focus_sessions s
--      set user_id = t.user_id
--     from public.eisenhower_tasks t
--    where s.task_id = t.id and s.user_id is null;
