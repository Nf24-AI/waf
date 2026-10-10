export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  notionApiToken: process.env.NOTION_API_TOKEN ?? "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID ?? "",

  // Supabase: الحسابات والمهام. الخادم يخاطبه برمز المستخدم نفسه، فسياسات
  // الصفوف (RLS) هي التي تحدّد ما يراه كل حساب — لا مفتاح خدمة هنا.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
};
