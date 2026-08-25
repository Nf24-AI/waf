import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Lock from "./pages/Lock";
import { useAuth } from "./_core/hooks/useAuth";
import { MEETING_ROUTES } from "@shared/routes";

function Router() {
  return (
    <Switch>
      <Route path={MEETING_ROUTES.prepare} component={Home} />
      <Route path={MEETING_ROUTES.display} component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * The workspace is gated only when the server says it is. With APP_PASSWORD
 * unset the gate never appears, which is right for localhost and wrong for a
 * public URL — see server/access.ts.
 */
function Gate() {
  const { locked, unlocked, loading, unlock } = useAuth();

  if (loading) {
    return (
      <div className="state-screen">
        <div className="state-card">
          <div className="loading-orb" />
        </div>
      </div>
    );
  }

  if (locked && !unlocked) {
    return <Lock onUnlock={unlock} language="ar" />;
  }

  return <Router />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="bottom-left" />
          <Gate />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
