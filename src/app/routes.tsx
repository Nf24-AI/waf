// المسارات. الصفحات العامة: الواجهة والدخول ورابط المشاركة. الباقي خلف الحساب.

import { lazy, Suspense, type ReactNode } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { Loading } from "@/ui/States";
import { AppShell } from "./AppShell";

const Landing = lazy(() => import("@/pages/landing/Landing"));
const Auth = lazy(() => import("@/pages/auth/AuthPages"));
const Shared = lazy(() => import("@/pages/meetings/SharedMeeting"));
const Today = lazy(() => import("@/pages/today/Today"));
const Meetings = lazy(() => import("@/pages/meetings/MeetingsPage"));
const Present = lazy(() => import("@/pages/meetings/Present"));
const Decisions = lazy(() => import("@/pages/meetings/Decisions"));
const Status = lazy(() => import("@/pages/meetings/StatusReport"));
const TimeHub = lazy(() => import("@/pages/time/TimeHub"));
const Matrix = lazy(() => import("@/pages/time/matrix/Matrix"));
const Blocks = lazy(() => import("@/pages/time/blocks/Blocks"));
const Focus = lazy(() => import("@/pages/time/focus/Focus"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function Fallback() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Loading />
    </div>
  );
}

/** يحرس الصفحات الخاصة: الزائر يذهب إلى الدخول ومعه وجهته */
function Gate({ children }: { children: ReactNode }) {
  const { account, loading } = useAuth();
  const [path] = useLocation();
  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-2" role="status">
        {t("لحظة…", "One moment…")}
      </div>
    );
  if (!account) return <Redirect to={`/login?redirect=${encodeURIComponent(path + window.location.search)}`} replace />;
  return <>{children}</>;
}

/** صفحة خاصة داخل إطار التطبيق، أو بلا إطار لصفحات ملء الشاشة */
function Private({ children, wide, bare }: { children: ReactNode; wide?: boolean; bare?: boolean }) {
  return <Gate>{bare ? children : <AppShell wide={wide}>{children}</AppShell>}</Gate>;
}

export function Routes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login">{() => <Auth mode="login" />}</Route>
        <Route path="/signup">{() => <Auth mode="signup" />}</Route>
        <Route path="/forgot-password">{() => <Auth mode="forgot" />}</Route>
        <Route path="/reset-password">{() => <Auth mode="reset" />}</Route>
        <Route path="/verify-email">{() => <Auth mode="verify" />}</Route>
        <Route path="/s/:token">{(p) => <Shared token={p.token} />}</Route>

        <Route path="/today">{() => <Private><Today /></Private>}</Route>
        <Route path="/meetings">{() => <Private wide><Meetings /></Private>}</Route>
        <Route path="/meetings/:id/present">{(p) => <Private bare><Present id={p.id} /></Private>}</Route>
        <Route path="/meetings/:id">{(p) => <Private wide><Meetings id={p.id} /></Private>}</Route>
        <Route path="/decisions">{() => <Private><Decisions /></Private>}</Route>
        <Route path="/status">{() => <Private><Status /></Private>}</Route>
        <Route path="/time">{() => <Private><TimeHub /></Private>}</Route>
        <Route path="/time/matrix">{() => <Private><Matrix origin="matrix" /></Private>}</Route>
        <Route path="/time/blocks">{() => <Private wide><Blocks origin="blocks" /></Private>}</Route>
        <Route path="/time/focus">{() => <Private bare><Focus origin="focus" /></Private>}</Route>
        <Route path="/waf">{() => <Redirect to="/waf/matrix" replace />}</Route>
        <Route path="/waf/matrix">{() => <Private><Matrix origin="waf" /></Private>}</Route>
        <Route path="/waf/blocks">{() => <Private wide><Blocks origin="waf" /></Private>}</Route>
        <Route path="/waf/focus">{() => <Private bare><Focus origin="waf" /></Private>}</Route>

        {/* مسارات النسخة السابقة */}
        <Route path="/services">{() => <Redirect to="/today" replace />}</Route>
        <Route path="/time-management">{() => <Redirect to="/time" replace />}</Route>
        <Route path="/time-management/eisenhower">{() => <Redirect to="/time/matrix" replace />}</Route>
        <Route path="/time-management/time-blocking">{() => <Redirect to="/time/blocks" replace />}</Route>
        <Route path="/time-management/focus">{() => <Redirect to="/time/focus" replace />}</Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
