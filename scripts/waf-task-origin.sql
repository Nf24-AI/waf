-- فصل الإطارات: كل مهمة تحمل اسم الإطار الذي وُلدت فيه — وقابل لإعادة التشغيل.
--
-- شغّله على المشروع الذي يشير إليه SUPABASE_URL في Vercel. والكود لا ينتظره:
-- قبل تشغيله يرى كل إطار المهام كلّها (كما كان)، وبعده يرى مهامه وحدها.
--
-- ما سبق هذا الملف يبقى بلا إطار (NULL) ولا يظهر في أي إطار: لا صفّ يُمسّ
-- ولا يُحذف. ولإعادة القديم إلى المصفوفة:
--   update public.eisenhower_tasks set origin = 'eisenhower' where origin is null;

alter table public.eisenhower_tasks
  add column if not exists origin text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eisenhower_tasks_origin_check'
  ) then
    alter table public.eisenhower_tasks
      add constraint eisenhower_tasks_origin_check
      check (origin is null or origin in ('eisenhower', 'timeblock', 'focus'));
  end if;
end $$;

-- المفتوح من إطارٍ بعينه هو ما يُسأل عنه في كل فتحة صفحة.
create index if not exists eisenhower_tasks_origin_idx
  on public.eisenhower_tasks (user_id, origin)
  where completed_at is null;

-- تحقّق: يجب أن يعود صفّ واحد.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'eisenhower_tasks'
  and column_name = 'origin';
