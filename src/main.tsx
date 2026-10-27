import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { Routes } from "@/app/routes";
import { AuthProvider } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { applyStoredTheme } from "@/ui/Chrome";
import "@/styles/index.css";

applyStoredTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

function Root() {
  const lang = useLang();
  return (
    // تغيير اللغة يعيد بناء الشجرة كلها فتُقرأ النصوص من جديد
    <div key={lang} className="contents">
      <Routes />
      <Toaster
        position="bottom-center"
        dir={lang === "ar" ? "rtl" : "ltr"}
        offset={88}
        mobileOffset={88}
        toastOptions={{
          className: "!font-[var(--font-ui)] !rounded-md !border-line !bg-sheet !text-ink !shadow-[var(--shadow-float)]",
        }}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
