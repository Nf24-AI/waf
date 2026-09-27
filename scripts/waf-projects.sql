-- المشاريع — حاويات للمهام، مملوكة لكل حساب.
--
-- شغّله على مشروع Supabase الذي يشير إليه SUPABASE_URL (مؤسّسة
-- «Eisenhower Matrix»، لا أي حساب آخر).
--
-- الكود يعمل قبل تشغيل هذا: غياب الجدول يُقرأ «لا مشاريع» فتعرض اللوحة
-- توزيع الأرباع بدلها، ولا ينكسر شيء. وبعد تشغيله تظهر بطاقات المشاريع
-- من تلقائها.
--
-- ولا عمود `progress`: التقدّم يُحسب من المهام عند القراءة. عمودٌ يُحدَّث
-- عند كل تغيير يتباعد أوّل ما تُحذف مهمة، ولا يُكتشف انحرافه لأن لا شيء
-- يقارنه بشيء.

create table if not exists public.waf_projects (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  color       text not null default 'accent'
              check (color in ('accent', 'go', 'warn', 'purple', 'danger')),
  created_at  timestamptz not null default now()
);

create index if not exists waf_projects_user_idx
  on public.waf_projects (user_id, created_at);

alter table public.waf_projects enable row level security;

drop policy if exists "owner reads projects"   on public.waf_projects;
drop policy if exists "owner inserts projects" on public.waf_projects;
drop policy if exists "owner updates projects" on public.waf_projects;
drop policy if exists "owner deletes projects" on public.waf_projects;

create policy "owner reads projects"   on public.waf_projects for select using (auth.uid() = user_id);
create policy "owner inserts projects" on public.waf_projects for insert with check (auth.uid() = user_id);
create policy "owner updates projects" on public.waf_projects for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner deletes projects" on public.waf_projects for delete using (auth.uid() = user_id);

revoke all on public.waf_projects from anon;
grant select, insert, update, delete on public.waf_projects to authenticated;

-- ربط المهمة بمشروعها. اختياريّ: مهمة بلا مشروع سليمة تماماً.
-- و`on delete set null`: حذف المشروع لا يحذف مهامه — تبقى بلا مشروع.
alter table public.eisenhower_tasks
  add column if not exists project_id uuid references public.waf_projects(id) on delete set null;

create index if not exists eisenhower_tasks_project_idx
  on public.eisenhower_tasks (project_id)
  where project_id is not null;

-- تحقّق: الجدول والعمود والسياسات.
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'waf_projects')                 as projects_table,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'eisenhower_tasks'
      and column_name = 'project_id')                                              as task_link,
  (select count(*) from pg_policies where tablename = 'waf_projects')              as policies,
  (select count(*) from public.waf_projects)                                       as rows_now;
