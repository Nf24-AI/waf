-- حجز الوقت الجديد: الفئة والأولوية ويوم الاستحقاق وأيام التكرار — وقابل لإعادة التشغيل.
--
-- شغّله على المشروع الذي يشير إليه SUPABASE_URL في Vercel، بعد waf-task-options.sql.
-- والكود لا ينتظره: ما دام عمودٌ غائباً أسقطه الخادم من الطلب وأكمل، فتعمل
-- الصفحة وتُفقد الخانة وحدها حتى يُشغَّل هذا الملف.

alter table public.eisenhower_tasks
  add column if not exists category text,
  add column if not exists priority text,
  add column if not exists due_date date,
  add column if not exists repeat_days smallint[];

-- القيد القديم يعرف «يومي» و«أسبوعي» وحدهما؛ يُستبدل بما يعرف الأربعة.
alter table public.eisenhower_tasks
  drop constraint if exists eisenhower_tasks_repeat_rule_check;

alter table public.eisenhower_tasks
  add constraint eisenhower_tasks_repeat_rule_check
  check (repeat_rule is null or repeat_rule in ('daily', 'weekdays', 'weekly', 'custom'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eisenhower_tasks_category_check'
  ) then
    alter table public.eisenhower_tasks
      add constraint eisenhower_tasks_category_check
      check (category is null or category in ('deep', 'meeting', 'personal', 'project', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'eisenhower_tasks_priority_check'
  ) then
    alter table public.eisenhower_tasks
      add constraint eisenhower_tasks_priority_check
      check (priority is null or priority in ('low', 'medium', 'high'));
  end if;
end $$;

-- تحقّق: يجب أن تعود أربعة صفوف.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'eisenhower_tasks'
  and column_name in ('category', 'priority', 'due_date', 'repeat_days');
