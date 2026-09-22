-- واف — توسيع جدول المهام ليحمل الطرق الثلاث
--
-- نفّذه في: Supabase Dashboard ← SQL Editor ← New query ← Run
-- آمن للتكرار: تشغيله مرّة أخرى لا يكسر شيئاً ولا يحذف بياناً.
--
-- يبني على الجدول القائم `eisenhower_tasks` ولا ينشئ جدولاً جديداً للمهام،
-- لأن مهامك الحالية فيه — ولأن البند ٢١ يشترط مصدر حقيقة واحداً. التطبيق
-- القديم يظلّ يعمل بعد هذا الترحيل: أعمدته كلها باقية كما هي.

-- ═══════════════════════════════════════════════════════════════════
-- 1) الحقول التي تحتاجها الطرق الثلاث
-- ═══════════════════════════════════════════════════════════════════

-- الوصف والأرشفة موجودان من قبل. الجديد هو الجدولة والتقدير والإنجاز.

-- الجدولة: الاثنان معاً أو لا شيء. قيد أدناه يمنع نصف موعد.
alter table public.eisenhower_tasks add column if not exists scheduled_start timestamptz;
alter table public.eisenhower_tasks add column if not exists scheduled_end   timestamptz;

-- المدة كما قدّرها صاحب المهمة، لا كما حسبناها من الجدولة.
alter table public.eisenhower_tasks add column if not exists estimated_minutes int;

-- لحظة الإنجاز. وجودها هو ما يجعل المهمة مكتملة — لا عمود حالة منفصل
-- يتباعد عمّا يصفه.
alter table public.eisenhower_tasks add column if not exists completed_at timestamptz;

-- ═══════════════════════════════════════════════════════════════════
-- 2) قيود تمنع الحالات المستحيلة عند المصدر
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_schedule_is_whole') then
    alter table public.eisenhower_tasks add constraint tasks_schedule_is_whole
      check ((scheduled_start is null) = (scheduled_end is null));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_schedule_ends_after_start') then
    alter table public.eisenhower_tasks add constraint tasks_schedule_ends_after_start
      check (scheduled_end is null or scheduled_end > scheduled_start);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_estimate_is_positive') then
    alter table public.eisenhower_tasks add constraint tasks_estimate_is_positive
      check (estimated_minutes is null or estimated_minutes > 0);
  end if;
end $$;

-- المهام المفتوحة هي أكثر ما يُقرأ، وهي قليلة بطبعها: فهرس جزئيّ عليها.
create index if not exists tasks_owner_open_idx
  on public.eisenhower_tasks (owner_code, created_at desc)
  where completed_at is null and is_archived = false;

create index if not exists tasks_owner_scheduled_idx
  on public.eisenhower_tasks (owner_code, scheduled_start)
  where scheduled_start is not null;

-- ═══════════════════════════════════════════════════════════════════
-- 3) جلسات التركيز
-- ═══════════════════════════════════════════════════════════════════
--
-- تُسجَّل الجلسة ولو لم تُنجَز المهمة: الوقت أُنفق فعلاً، والإحصائيات تقيس
-- الوقت لا النجاح. و`completed` تفرّق بين جلسة اكتملت وأخرى قُطعت.

create table if not exists public.waf_focus_sessions (
  id              uuid primary key,
  owner_code      uuid not null,
  task_id         uuid not null references public.eisenhower_tasks(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  planned_minutes int not null check (planned_minutes > 0),
  completed       boolean not null default false
);

create index if not exists focus_sessions_owner_started_idx
  on public.waf_focus_sessions (owner_code, started_at desc);

create index if not exists focus_sessions_task_idx
  on public.waf_focus_sessions (task_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4) أمن الصفوف — نفس نموذج الجدول القائم
-- ═══════════════════════════════════════════════════════════════════
--
-- المعرّف يُرسَل في ترويسة x-owner-code والسياسة تقابله بالعمود. الدالة
-- request_owner_code معرّفة في الإعداد الأول للمهام، ونعيد استعمالها.

alter table public.waf_focus_sessions enable row level security;

grant select, insert, update, delete on public.waf_focus_sessions to anon, authenticated;

drop policy if exists "code reads own sessions"   on public.waf_focus_sessions;
drop policy if exists "code inserts own sessions" on public.waf_focus_sessions;
drop policy if exists "code updates own sessions" on public.waf_focus_sessions;
drop policy if exists "code deletes own sessions" on public.waf_focus_sessions;

create policy "code reads own sessions" on public.waf_focus_sessions for select
  using (owner_code is not null and owner_code = public.request_owner_code());
create policy "code inserts own sessions" on public.waf_focus_sessions for insert
  with check (owner_code is not null and owner_code = public.request_owner_code());
create policy "code updates own sessions" on public.waf_focus_sessions for update
  using      (owner_code is not null and owner_code = public.request_owner_code())
  with check (owner_code is not null and owner_code = public.request_owner_code());
create policy "code deletes own sessions" on public.waf_focus_sessions for delete
  using (owner_code is not null and owner_code = public.request_owner_code());
