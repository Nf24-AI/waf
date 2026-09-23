-- خيارات المهمة: التكرار والتذكير — عمودان، وقابل لإعادة التشغيل.
--
-- يجمع هذا الملف ما كان في waf-repeat.sql ويزيد عليه، فيُشغَّل مرّة واحدة.
-- شغّله على المشروع الذي يشير إليه SUPABASE_URL في Vercel — لا على أي مشروع
-- آخر: الكود يقرأ من ذاك وحده، وترحيلٌ في غيره لا يُرى منه شيء.
--
-- التكرار ليس علَماً يُخزَّن ولا يفعل شيئاً: حين تُنجَز مهمة متكرّرة يُنشئ
-- الخادم نسختها التالية بموعدها مزاحاً. والمكتمل يبقى مكتملاً في الأرشيف.

alter table public.eisenhower_tasks
  add column if not exists repeat_rule text;

alter table public.eisenhower_tasks
  add column if not exists reminder_minutes int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eisenhower_tasks_repeat_rule_check'
  ) then
    alter table public.eisenhower_tasks
      add constraint eisenhower_tasks_repeat_rule_check
      check (repeat_rule is null or repeat_rule in ('daily', 'weekly'));
  end if;

  -- التذكير بالدقائق قبل الموعد: صفر يعني «عند الموعد». واليوم كاملاً حدّ
  -- كافٍ — من يريد تذكيراً قبل أسبوع يريد مهمّة أخرى لا تذكيراً.
  if not exists (
    select 1 from pg_constraint where conname = 'eisenhower_tasks_reminder_check'
  ) then
    alter table public.eisenhower_tasks
      add constraint eisenhower_tasks_reminder_check
      check (reminder_minutes is null or (reminder_minutes >= 0 and reminder_minutes <= 1440));
  end if;
end $$;

-- المتكرّر المفتوح وحده يُبحث عنه، فالفهرس جزئيّ.
create index if not exists eisenhower_tasks_repeat_idx
  on public.eisenhower_tasks (owner_code)
  where repeat_rule is not null and completed_at is null;

-- تحقّق: يجب أن يعود صفّان.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'eisenhower_tasks'
  and column_name in ('repeat_rule', 'reminder_minutes');
