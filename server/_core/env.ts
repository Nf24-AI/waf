export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  notionApiToken: process.env.NOTION_API_TOKEN ?? "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID ?? "",
  // Single-user gate. Empty means open, which is only safe on localhost.
  appPassword: process.env.APP_PASSWORD ?? "",

  // المهام في Supabase. المفاتيح هنا لا في حزمة المتصفح: الريبو عام، وأي
  // VITE_* يصير مكشوفاً — فيقرأ الغريب مهامك ويكتب فيها. الخادم خلف بوّابة
  // كلمة المرور، فيمرّ الطلب من عنده.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  tasksOwnerCode: process.env.TASKS_OWNER_CODE ?? "",
};
