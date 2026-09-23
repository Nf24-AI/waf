import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import IdleWarning from "./components/IdleWarning";
import ScheduleReminder from "./components/time/ScheduleReminder";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Lock from "./pages/Lock";
import Decisions from "./pages/Decisions";
import Platform from "./pages/Platform";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";
import TimeHome from "./pages/TimeHome";
import StatusReport from "./pages/StatusReport";
import AddTask from "./pages/AddTask";
import Archive from "./pages/Archive";
import Eisenhower from "./pages/Eisenhower";
import Focus from "./pages/Focus";
import TimeBlocking from "./pages/TimeBlocking";
import Tasks from "./pages/Tasks";
import TimeManagement from "./pages/TimeManagement";
import { useAuth } from "./_core/hooks/useAuth";
import { useIdleLock } from "./hooks/useIdleLock";
import {
  DECISIONS_ROUTE,
  LANDING_ROUTE,
  LEGACY_LANDING_ROUTE,
  MEETING_ROUTES,
  PLATFORM_ROUTE,
  STATUS_REPORT_ROUTE,
  ADD_TASK_ROUTE,
  ARCHIVE_ROUTE,
  SETTINGS_ROUTE,
  TIME_HOME_ROUTE,
  STATISTICS_ROUTE,
  TASKS_ROUTE,
  TIME_MANAGEMENT_ROUTE,
  TIME_METHOD_ROUTES,
} from "@shared/routes";

function Router() {
  return (
    <Switch>
      <Route path={PLATFORM_ROUTE} component={Platform} />
      <Route path={DECISIONS_ROUTE} component={Decisions} />
      <Route path={STATUS_REPORT_ROUTE} component={StatusReport} />
      <Route path={TIME_HOME_ROUTE} component={TimeHome} />
      <Route path={SETTINGS_ROUTE} component={Settings} />
      <Route path={TIME_MANAGEMENT_ROUTE} component={TimeManagement} />
      <Route path={ADD_TASK_ROUTE} component={AddTask} />
      <Route path={TASKS_ROUTE} component={Tasks} />
      <Route path={STATISTICS_ROUTE} component={Statistics} />
      <Route path={ARCHIVE_ROUTE} component={Archive} />
      <Route path={TIME_METHOD_ROUTES.eisenhower} component={Eisenhower} />
      <Route path={TIME_METHOD_ROUTES.timeBlocking} component={TimeBlocking} />
      <Route path={TIME_METHOD_ROUTES.focus} component={Focus} />
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
 *
 * Once past the gate, the workspace locks itself again after IDLE_MINUTES of
 * nothing happening, asking first for the last minute of that. Only when a
 * gate exists: with APP_PASSWORD unset there is nothing to lock back to, and
 * locking would just blank the page.
 */
function Gate() {
  const { locked, unlocked, loading, unlock, logout, keepAlive } = useAuth();

  const idle = useIdleLock(locked && unlocked, logout, keepAlive);

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

  return (
    <>
      <Router />
      <ScheduleReminder />
      {idle.warning && (
        <IdleWarning
          secondsLeft={idle.secondsLeft}
          onStay={idle.stay}
          onLockNow={logout}
          language="ar"
        />
      )}
    </>
  );
}

/**
 * صفحة الهبوط تسبق البوّابة عمداً.
 *
 * البوّابة تحمي بيانات الاجتماعات، لا تعريف المنتج. وصفحة هبوط خلف كلمة مرور
 * تشرح واف لمن يعرفه أصلاً — فتُقرأ صفراً من المرات. لذلك يحتلّ الوجه العام
 * الجذر ويُلتقط هنا قبل Gate: يُقرأ بلا كلمة مرور، وكل رابط فيه يقود إلى
 * البوّابة فتطلبها.
 *
 * البوّابة نفسها على tRPC (server/access.ts)، فخروج هذا المسار من Gate لا
 * يكشف شيئاً: الصفحة لا تطلب أي إجراء محميّ.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="bottom-left" />
          <Switch>
            <Route path={LANDING_ROUTE} component={Landing} />
            {/* من حفظ العنوان القديم يصل إلى الوجه نفسه، فلا ينكسر رابط. */}
            <Route path={LEGACY_LANDING_ROUTE} component={Landing} />
            <Route>
              <Gate />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
