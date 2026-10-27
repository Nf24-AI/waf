-- واف ٢ — مخطّط قاعدة البيانات.
-- جداول جديدة كلها بالبادئة waf2_ فلا تمسّ جداول النسخة الحالية
-- (eisenhower_tasks و waf_focus_sessions و profiles) التي ما زال الموقع الحالي يقرأ منها.
-- آمن لإعادة التشغيل.

-- ───────────────────────── الاجتماعات ─────────────────────────

create table if not exists public.waf2_meetings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 200),
  -- اليوم والساعة منفصلان: اجتماع بلا ساعة له يوم فقط
  day         date,
  start_time  time,
  end_time    time,
  kind        text not null default 'other' check (kind in ('internal', 'partner', 'leadership', 'other')),
  status      text not null default 'draft' check (status in ('draft', 'ready', 'done')),
  attendees   text[] not null default '{}',
  goal        text not null default '',
  note        text not null default '',
  link        text not null default '',
  image       text not null default '',
  share_token text unique,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint waf2_meetings_time_order check (end_time is null or start_time is null or end_time > start_time)
);

create index if not exists waf2_meetings_user_day on public.waf2_meetings (user_id, day) where archived_at is null;

create table if not exists public.waf2_agenda_items (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.waf2_meetings (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position   int not null default 0,
  title      text not null default '',
  context    text not null default '',
  goal       text not null default '',
  decision   text not null default '',
  owner      text not null default '',
  covered    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists waf2_agenda_meeting on public.waf2_agenda_items (meeting_id, position);

create table if not exists public.waf2_followups (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.waf2_meetings (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position   int not null default 0,
  text       text not null default '',
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists waf2_followups_meeting on public.waf2_followups (meeting_id, position);

-- ───────────────────────── المهام ─────────────────────────

create table if not exists public.waf2_tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  notes             text not null default '',
  -- أين كُتبت المهمة: كل إطار يرى مهامه وحده، و«نظام واف» يرى مهامه هو
  origin            text not null check (origin in ('matrix', 'blocks', 'focus', 'waf')),
  quadrant          text check (quadrant in ('do', 'plan', 'delegate', 'drop')),
  starts_at         timestamptz,
  ends_at           timestamptz,
  estimate_minutes  int check (estimate_minutes between 1 and 1440),
  category          text not null default 'deep' check (category in ('deep', 'meeting', 'personal', 'project', 'other')),
  priority          text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  repeat_rule       text check (repeat_rule in ('daily', 'weekdays', 'weekly', 'custom')),
  repeat_days       smallint[] not null default '{}',
  -- مهمة وُلدت من نقطة متابعة في اجتماع
  source_meeting_id uuid references public.waf2_meetings (id) on delete set null,
  completed_at      timestamptz,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint waf2_tasks_schedule_whole check ((starts_at is null) = (ends_at is null)),
  constraint waf2_tasks_schedule_order check (ends_at is null or ends_at > starts_at)
);

create index if not exists waf2_tasks_open on public.waf2_tasks (user_id, origin) where archived_at is null;

create table if not exists public.waf2_focus_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id         uuid references public.waf2_tasks (id) on delete set null,
  origin          text not null check (origin in ('matrix', 'blocks', 'focus', 'waf')),
  mode            text not null check (mode in ('pomodoro', 'timer', 'stopwatch')),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  planned_minutes int check (planned_minutes between 1 and 1440),
  worked_seconds  int not null default 0 check (worked_seconds >= 0),
  completed       boolean not null default false
);

create index if not exists waf2_focus_user_day on public.waf2_focus_sessions (user_id, started_at desc);

-- ───────────────────────── الصلاحيات ─────────────────────────
-- كل صف لصاحبه وحده. لا مفتاح خدمة في التطبيق: RLS هي الحارس.

do $$
declare t text;
begin
  foreach t in array array['waf2_meetings', 'waf2_agenda_items', 'waf2_followups', 'waf2_tasks', 'waf2_focus_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- البند ونقطة المتابعة لا يُضافان إلا لاجتماع يملكه صاحبهما
drop policy if exists "owner all" on public.waf2_agenda_items;
create policy "owner all" on public.waf2_agenda_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.waf2_meetings m where m.id = meeting_id and m.user_id = auth.uid()));

drop policy if exists "owner all" on public.waf2_followups;
create policy "owner all" on public.waf2_followups for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.waf2_meetings m where m.id = meeting_id and m.user_id = auth.uid()));

create or replace function public.waf2_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists waf2_meetings_touch on public.waf2_meetings;
create trigger waf2_meetings_touch before update on public.waf2_meetings
  for each row execute function public.waf2_touch();

-- ───────────────────────── رابط القراءة فقط ─────────────────────────
-- يفتح اجتماعاً واحداً لمن لا حساب له. يعمل حتى نهاية اليوم التالي للاجتماع
-- بتوقيت الرياض، واجتماع بلا تاريخ لا يُشارَك. لا تخرج الملاحظات التحضيرية أبداً.

create or replace function public.waf2_shared_meeting(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare m public.waf2_meetings;
begin
  if p_token is null or char_length(p_token) < 24 then
    return jsonb_build_object('error', 'invalid');
  end if;
  select * into m from public.waf2_meetings where share_token = p_token and archived_at is null;
  if not found then
    return jsonb_build_object('error', 'invalid');
  end if;
  if m.day is null or (now() at time zone 'Asia/Riyadh')::date > m.day + 1 then
    return jsonb_build_object('error', 'expired');
  end if;
  return jsonb_build_object('meeting', jsonb_build_object(
    'id', m.id, 'title', m.title, 'day', m.day, 'start_time', m.start_time, 'end_time', m.end_time,
    'kind', m.kind, 'status', m.status, 'attendees', to_jsonb(m.attendees), 'goal', m.goal,
    'link', m.link, 'image', m.image,
    'agenda', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'context', a.context, 'goal', a.goal,
        'decision', a.decision, 'owner', a.owner, 'covered', a.covered) order by a.position)
      from public.waf2_agenda_items a where a.meeting_id = m.id), '[]'::jsonb),
    'followups', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'text', f.text, 'done', f.done) order by f.position)
      from public.waf2_followups f where f.meeting_id = m.id), '[]'::jsonb)
  ));
end $$;

revoke all on function public.waf2_shared_meeting(text) from public;
grant execute on function public.waf2_shared_meeting(text) to anon, authenticated;
