-- تكرار المهمة — عمود واحد، وقابل لإعادة التشغيل.
--
-- التكرار هنا ليس علَماً يُخزَّن ولا يفعل شيئاً: حين تُنجَز مهمة متكرّرة
-- يُنشئ الخادم نسختها التالية بموعدها مزاحاً يوماً أو أسبوعاً. فالمكتمل
-- يبقى مكتملاً في الأرشيف، والقادم صفٌّ جديد له معرّفه الخاص — لا صفّ
-- واحد يُعاد فتحه فيمحو تاريخه كلما تكرّر.

alter table public.eisenhower_tasks
  add column if not exists repeat_rule text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eisenhower_tasks_repeat_rule_check'
  ) then
    alter table public.eisenhower_tasks
      add constraint eisenhower_tasks_repeat_rule_check
      check (repeat_rule is null or repeat_rule in ('daily', 'weekly'));
  end if;
end $$;

-- المتكرّر المفتوح وحده يُبحث عنه، فالفهرس جزئيّ.
create index if not exists eisenhower_tasks_repeat_idx
  on public.eisenhower_tasks (owner_code)
  where repeat_rule is not null and completed_at is null;
