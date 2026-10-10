import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequireAuth from "./components/RequireAuth";
import { useAuthSession } from "./contexts/AuthContext";
import { getLang, useLang } from "./lib/i18n";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Login from "./pages/auth/Login";
import ResetPassword from "./pages/auth/ResetPassword";
import Signup from "./pages/auth/Signup";
import VerifyEmail from "./pages/auth/VerifyEmail";
import {
  FORGOT_PASSWORD_ROUTE,
  LOGIN_ROUTE,
  RESET_PASSWORD_ROUTE,
  SIGNUP_ROUTE,
  VERIFY_EMAIL_ROUTE,
  ABOUT_ROUTE,
  SERVICES_ROUTE,
} from "./lib/auth-routes";
import IdleWarning from "./components/IdleWarning";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Shared from "./pages/Shared";
import Decisions from "./pages/Decisions";
import StatusReport from "./pages/StatusReport";
import Eisenhower from "./pages/Eisenhower";
import Focus from "./pages/Focus";
import TimeBlocking from "./pages/TimeBlocking";
import TimeManagement from "./pages/TimeManagement";
import { useIdleLock } from "./hooks/useIdleLock";
import {
  DECISIONS_ROUTE,
  LANDING_ROUTE,
  LEGACY_LANDING_ROUTE,
  MEETING_ROUTES,
  LEGACY_PLATFORM_ROUTE,
  STATUS_REPORT_ROUTE,
  RETIRED_TIME_ROUTES,
  TIME_MANAGEMENT_ROUTE,
  TIME_METHOD_ROUTES,
} from "@shared/routes";

function Router() {
  return (
    <Switch>
      <Route path={DECISIONS_ROUTE} component={Decisions} />
      <Route path={STATUS_REPORT_ROUTE} component={StatusReport} />
      <Route path={TIME_MANAGEMENT_ROUTE} component={TimeManagement} />
      {/*
        صفحات المنتج المشتركة ذهبت مع فصل الإطارات. ومن حفظ رابط إحداها يصل
        إلى صفحة الإطارات، لا إلى «الصفحة غير موجودة».
      */}
      {RETIRED_TIME_ROUTES.map(path => (
        <Route key={path} path={path}>
          <Redirect to={TIME_MANAGEMENT_ROUTE} replace />
        </Route>
      ))}
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
 * مساحة العمل خلف حساب.
 *
 * كانت خلف كلمة مرور واحدة في متغيّر بيئة — بوّابة مقاس مستخدم واحد. وقد
 * حلّت محلّها المصادقة الحقيقية، وبوّابتان تعنيان تسجيل دخول مرّتين، فذهبت
 * الأولى.
 *
 * وقفل الخمول بقي: يسأل قبل الدقيقة الأخيرة ثم يُنهي الجلسة. الفرق أنّه
 * صار ينهيها عند Supabase لا عند كعكة محليّة، فيُقفل في كل الألسنة معاً.
 */
function Gate() {
  const { user, signOut } = useAuthSession();

  const idle = useIdleLock(Boolean(user), signOut, () => {});

  return (
    <RequireAuth>
      <Router />
      {idle.warning && (
        <IdleWarning
          secondsLeft={idle.secondsLeft}
          onStay={idle.stay}
          onLockNow={signOut}
          language={getLang()}
        />
      )}
    </RequireAuth>
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
  // المفتاح يُعيد بناء الشجرة عند تبديل اللغة: كل نصٍّ يُقرأ من جديد، ولا يبقى
  // مكوّنٌ على لغته القديمة لأنه لم يُعَد رسمه.
  const lang = useLang();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster position="bottom-left" />
          <Switch key={lang}>
            <Route path={LANDING_ROUTE} component={Landing} />
            {/* من حفظ العنوان القديم يصل إلى الوجه نفسه، فلا ينكسر رابط. */}
            <Route path={LEGACY_LANDING_ROUTE} component={Landing} />
            {/*
              «الخدمات» و«عن واف» قسمان في صفحة الهبوط لا صفحتان. تسجيلهما
              مسارين يحفظ الروابط التي يطلبها البريد، ونسخهما صفحتين يعني
              نصّين لنفس الشيء يتباعدان.
            */}
            <Route path={SERVICES_ROUTE} component={Landing} />
            {/* صفحة الخدمات القديمة حُذفت: الخدمات تُختار من الرئيسية نفسها. */}
            <Route path={LEGACY_PLATFORM_ROUTE}>
              <Redirect to={SERVICES_ROUTE} replace />
            </Route>
            <Route path={ABOUT_ROUTE} component={Landing} />

            {/*
              المصادقة عامّة: من يصلها لم يدخل بعد — ومن دخل يُعاد من فوقها
              إلى وجهته. عرضُ نموذج الدخول لمن هو داخل يطلب منه ما فعله.
              وتُستثنى «كلمة مرور جديدة»: يُفتح رابطها وصاحبه مسجَّل بالفعل،
              فإعادتُه منها تمنعه من تغيير كلمته.
            */}
            <Route path={LOGIN_ROUTE}>
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            </Route>
            <Route path={SIGNUP_ROUTE}>
              <RedirectIfAuthed>
                <Signup />
              </RedirectIfAuthed>
            </Route>
            <Route path={FORGOT_PASSWORD_ROUTE}>
              <RedirectIfAuthed>
                <ForgotPassword />
              </RedirectIfAuthed>
            </Route>
            <Route path={RESET_PASSWORD_ROUTE} component={ResetPassword} />
            <Route path={VERIFY_EMAIL_ROUTE} component={VerifyEmail} />
            {/*
              رابط المشاركة يقرؤه من لا حساب له، فيُلتقط قبل البوّابة: الرمز في
              العنوان هو الإذن، ولا يفتح إلا اجتماعاً واحداً للقراءة.
            */}
            <Route path={MEETING_ROUTES.shared} component={Shared} />
            <Route>
              <Gate />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
