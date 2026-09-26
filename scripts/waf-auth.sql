-- واف — الهوية والملكية وعزل البيانات.
--
-- شغّله على المشروع الذي يشير إليه SUPABASE_URL، مرّة واحدة.
-- الملف قابل لإعادة التشغيل: كل شيء فيه `if not exists` أو `drop … create`.
--
-- ============================================================
-- ما وجدناه في الجدول قبل كتابة هذا (لا ما افترضناه)
-- ============================================================
--
-- جدول eisenhower_tasks مشترك مع تطبيق مصفوفة أيزنهاور المستقلّ، وذاك
-- التطبيق يستعمل Supabase Auth أصلاً: عمود user_id موجود، وسياساته
-- (`read own tasks` وأخواتها) مبنيّة على auth.uid() = user_id منذ البداية.
--
-- ثم أضافت واف فوقه طبقةً ثانية: owner_code ورمزاً واحداً في متغيّر بيئة.
-- ولم يطابق ذلك الرمز أيّاً من الرمزين في الجدول، فكانت واف تقرأ صفراً
-- بينما في الجدول ستّ مهام. لم تكن البيانات مفقودة — كانت محجوبة بطبقة
-- لا لزوم لها.
--
-- ولذلك: لا نبني ملكيةً جديدة، بل نحذف الطبقة الزائدة ونرجع إلى ما كان
-- صحيحاً. وسياسات التطبيق المستقلّ تبقى كما هي — هو حيّ ويستعمل الجدول،
-- وحذفها يكسره.

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

-- ولمن سجّل قبل وجود المُشغِّل: ملفٌّ بأثر رجعيّ.
insert into public.profiles (id, name)
select id, coalesce(raw_user_meta_data->>'name', '')
from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 2) الملكية
-- ============================================================
--
-- المهام لها user_id أصلاً. الجلسات لا، فتُعطاه.

alter table public.waf_focus_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- owner_code كان إلزامياً في الجلسات، والكود لم يعد يكتبه: بلا هذا يفشل كل
-- إدراج جلسة. ولا يُحذف العمود — الصفوف القديمة تُعرَف به.
alter table public.waf_focus_sessions alter column owner_code drop not null;

-- المهمة الجديدة لا تُرسل is_archived. لو كان العمود بلا قيمة افتراضية
-- لوُلدت كل مهمة بـNULL، ولأسقطها فلتر `is_archived=eq.false` من القائمة:
-- تُحفظ ولا تُرى، وهو أسوأ من ألّا تُحفظ.
alter table public.eisenhower_tasks alter column is_archived set default false;
update public.eisenhower_tasks set is_archived = false where is_archived is null;

create index if not exists waf_focus_sessions_user_idx
  on public.waf_focus_sessions (user_id, started_at desc);

-- ============================================================
-- 3) حذف الطبقة الزائدة
-- ============================================================
--
-- سياسات owner_code تُحذف: من يعرف الرمز الواحد يقرأ مهام الجميع، وهو باب
-- ثانٍ إلى نفس الجدول لا يعرف به تسجيل الخروج. وسياسات التطبيق المستقلّ
-- (auth.uid() = user_id) تبقى: هي الصحيحة، وهي ما ستقرأ به واف بعد الدمج.

drop policy if exists "code reads own tasks"      on public.eisenhower_tasks;
drop policy if exists "code inserts own tasks"    on public.eisenhower_tasks;
drop policy if exists "code updates own tasks"    on public.eisenhower_tasks;
drop policy if exists "code deletes own tasks"    on public.eisenhower_tasks;

alter table public.waf_focus_sessions enable row level security;

drop policy if exists "code reads own sessions"   on public.waf_focus_sessions;
drop policy if exists "code inserts own sessions" on public.waf_focus_sessions;
drop policy if exists "code updates own sessions" on public.waf_focus_sessions;
drop policy if exists "code deletes own sessions" on public.waf_focus_sessions;

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
revoke all on public.waf_focus_sessions from anon;
grant select, insert, update, delete on public.waf_focus_sessions to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- ============================================================
-- 4) المهمة اليتيمة
-- ============================================================
--
-- صفّ واحد بلا user_id لن يراه أحد بعد اليوم. يُنسَب إلى صاحب بقيّة المهام
-- حين يكون في الجدول صاحبٌ واحد — وإن تعدّد الملّاك تُرك كما هو، فنسبة
-- مهمةٍ إلى الشخص الخطأ أسوأ من تركها مخفيّة.

update public.eisenhower_tasks
   set user_id = (
     select t.user_id
     from public.eisenhower_tasks t
     where t.user_id is not null
     group by t.user_id
     having count(*) = (select count(*) from public.eisenhower_tasks where user_id is not null)
   )
 where user_id is null;

-- ============================================================
-- تحقّق — يجب أن يكون كل شيء أدناه صحيحاً
-- ============================================================

select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='profiles')                                as profiles_table,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='waf_focus_sessions' and column_name='user_id') as sessions_user_id,
  (select is_nullable from information_schema.columns
    where table_schema='public' and table_name='waf_focus_sessions' and column_name='owner_code') as sessions_owner_nullable,
  (select count(*) from pg_policies
    where tablename='eisenhower_tasks' and policyname like 'code %')                      as leftover_code_policies,
  (select count(*) from public.eisenhower_tasks where user_id is null)                    as tasks_without_owner,
  (select count(*) from public.eisenhower_tasks)                                          as total_tasks;
