import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { accessToken } from "@/lib/supabase";
import "./index.css";

const queryClient = new QueryClient();

// Errors used to redirect to the Manus OAuth portal, which does not exist
// outside the Manus platform. Access is now the APP_PASSWORD gate, and an
// UNAUTHORIZED response is surfaced by the workspace instead of navigating away.
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      /**
       * رمز الجلسة يُرفق بكل نداء.
       *
       * الخادم يمرّره إلى PostgREST فتُطبَّق سياسات RLS على auth.uid().
       * ويُقرأ عند كل نداء لا مرّة واحدة: العميل يجدّد الرمز في الخلفية،
       * ورمزٌ محفوظ عند الإقلاع يصير منتهياً بعد ساعة.
       */
      async fetch(input, init) {
        const token = await accessToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set("authorization", `Bearer ${token}`);
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
