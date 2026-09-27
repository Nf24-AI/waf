-- الاجتماعات: مساحة عمل واحدة، لا بيانات لكل مستخدم.
--
-- شُغِّل بالفعل على مشروع SUPABASE_URL. محفوظ هنا للسجلّ ولإعادة التشغيل.
--
-- الاجتماعات تعيش في Notion خلف توكن واحد وقاعدة واحدة بلا عمود مالك، فكل
-- من يسجّل حساباً كان يقرأ اجتماعات صاحب المساحة. نقلها إلى Supabase بملكية
-- لكل صفّ هو الحلّ الصحيح وهو عمل كبير؛ وحتى ذلك الحين لا يصحّ ترك الباب
-- مفتوحاً، فتُقيَّد الخدمة بمالكها.
--
-- والعَلَم في profiles لا في متغيّر بيئة: منحه لشخص ثانٍ سطرٌ في قاعدة
-- البيانات لا إعادة نشر.

alter table public.profiles
  add column if not exists can_access_meetings boolean not null default false;

-- مالك المهام القائمة هو مالك المساحة. ولو تعدّد أصحاب المهام يوماً فهذا
-- السطر يمنحهم جميعاً — راجعه قبل تشغيله على قاعدة فيها أكثر من فريق.
update public.profiles p
   set can_access_meetings = true
 where exists (select 1 from public.eisenhower_tasks t where t.user_id = p.id);

-- تحقّق: العمود موجود، ومن يملك المساحة معدود.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'can_access_meetings')            as column_added,
  (select count(*) from public.profiles where can_access_meetings)     as owners,
  (select count(*) from public.profiles where not can_access_meetings) as others;

-- لمنح الوصول لحساب آخر لاحقاً:
--   update public.profiles set can_access_meetings = true
--    where id = (select id from auth.users where email = 'them@example.com');
