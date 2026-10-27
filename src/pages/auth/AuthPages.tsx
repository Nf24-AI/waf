// صفحات الحساب: دخول، إنشاء حساب، نسيت كلمة المرور، كلمة مرور جديدة، تفعيل البريد.
// لوح الغسق من الواجهة العامة في جهة، والنموذج في الأخرى. على الجوّال يصير اللوح شريطاً رفيعاً.

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { isDemo, supabase } from "@/data/client";
import { safeRedirect, useAuth } from "@/lib/auth";
import { formatClock, t, useLang } from "@/lib/i18n";
import { Button, ButtonLink } from "@/ui/Button";
import { LangToggle, ThemeToggle } from "@/ui/Chrome";
import { cx } from "@/ui/cx";
import { dayFraction, useNow } from "@/ui/DayLine";
import { Field, Input } from "@/ui/Field";

type Mode = "login" | "signup" | "forgot" | "reset" | "verify";

const NAME_MAX = 40;
const PASSWORD_MIN = 8;
const RECOVERY_WAIT_MS = 4000;

// ───────── الأخطاء بالعربية ─────────

/** يترجم خطأ Supabase إلى جملة تقول ما حدث وكيف يُصلَح، دون كشف وجود البريد */
function authErrorText(e: unknown): string {
  const err = e as { message?: string; status?: number; code?: string } | null;
  const msg = (err?.message ?? "").toLowerCase();
  const code = err?.code ?? "";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials") || msg.includes("user not found"))
    return t("البريد أو كلمة المرور غير صحيحة.", "The email or password is incorrect.");
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return t("لم يُفعَّل بريدك بعد. افتح رابط التحقّق في بريدك.", "Your email isn’t confirmed yet. Open the confirmation link in your inbox.");
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered") || msg.includes("already been registered"))
    return t("هذا البريد مسجَّل. سجّل دخولك بدل إنشاء حساب.", "This email is already registered. Sign in instead.");
  if (code === "weak_password" || msg.includes("password should be at least"))
    return t("كلمة المرور قصيرة — ثمانية أحرف على الأقل.", "The password is too short — at least eight characters.");
  if (code === "same_password" || msg.includes("should be different"))
    return t("اختر كلمة مرور غير القديمة.", "Choose a password different from the old one.");
  if (err?.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("security purposes"))
    return t("محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.", "Too many attempts. Wait a minute, then try again.");
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed"))
    return t("تعذّر الاتصال. تحقّق من الإنترنت ثم أعد المحاولة.", "Couldn’t connect. Check your internet, then try again.");
  return t("تعذّر تنفيذ العملية. حاول مرة أخرى.", "That didn’t work. Try again.");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailError = (v: string) => (EMAIL_RE.test(v.trim()) ? null : t("اكتب بريداً صحيحاً، مثل name@example.com.", "Enter a valid email, like name@example.com."));
const passwordError = (v: string) => (v.length >= PASSWORD_MIN ? null : t("كلمة المرور قصيرة — ثمانية أحرف على الأقل.", "The password is too short — at least eight characters."));

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string | null>>;

/** يضع المؤشّر في أول حقل فيه خطأ */
function focusFirst(errors: Errors, ids: Record<string, string>) {
  const first = (["name", "email", "password", "confirm"] as const).find((k) => errors[k]);
  if (first) document.getElementById(ids[first])?.focus();
}

// ───────── الصفحة ─────────

export default function AuthPages({ mode }: { mode: Mode }) {
  useLang();
  const { account, loading, demo } = useAuth();
  const params = new URLSearchParams(useSearch());
  const dest = safeRedirect(params.get("redirect"));

  if (!demo && !loading && account && (mode === "login" || mode === "signup" || mode === "forgot")) return <Redirect to={dest} replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-bg md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <DuskPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-end gap-1 px-4 sm:px-6">
          <LangToggle />
          <ThemeToggle />
        </div>
        <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:px-6 md:items-center md:pt-0">
          <div className="w-full max-w-[24rem]">{isDemo || !supabase ? <DemoNote mode={mode} /> : <AuthBody mode={mode} dest={dest} email={params.get("email") ?? ""} />}</div>
        </main>
      </div>
    </div>
  );
}

function AuthBody({ mode, dest, email }: { mode: Mode; dest: string; email: string }) {
  switch (mode) {
    case "login":
      return <Login dest={dest} />;
    case "signup":
      return <Signup dest={dest} />;
    case "forgot":
      return <Forgot />;
    case "reset":
      return <Reset />;
    case "verify":
      return <Verify initialEmail={email} dest={dest} />;
  }
}

// ───────── لوح الغسق ─────────

function DuskPanel() {
  const now = useNow();
  const minute = now.getHours() * 60 + now.getMinutes();
  const f = dayFraction(minute);
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const live = f > 0 && f < 1;
  return (
    <aside className="relative isolate flex flex-col overflow-hidden bg-[#0b1322] px-4 pb-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white sm:px-6 md:sticky md:top-0 md:h-dvh md:px-10 md:pb-12 md:pt-8 lg:px-14">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 70% at 50% 100%, rgb(239 164 49 / 0.32) 0%, rgb(239 164 49 / 0.08) 38%, transparent 62%), linear-gradient(180deg, #0a1120 0%, #13284a 55%, #2a3f5f 100%)",
        }}
        aria-hidden
      />
      <Link href="/" className="press inline-flex w-fit items-baseline rounded-sm" aria-label={t("واف — الصفحة الرئيسية", "Waf — home page")}>
        <span className="font-display text-[1.6rem] font-bold leading-none md:text-3xl">وَاف</span>
      </Link>

      <div className="mt-auto hidden md:block">
        <p className="font-display text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-tight text-[#f4be66]">{t("من وَفَى: أتمَّ وأكمل.", "From wafā: to fulfil, to see through.")}</p>
        <p className="mt-4 max-w-sm text-white/70">
          {t("تجهّز اجتماعك وتخرج منه بقرار له مالك، ثم ترتّب وقتك لتفي بما التزمت به.", "Prepare a meeting and leave with decisions that have owners, then arrange your time to keep what you committed to.")}
        </p>
      </div>

      {/* الأفق حتى «الآن» */}
      <div className="relative mt-4 md:mt-14" aria-hidden>
        <div className="h-px w-full bg-white/25" />
        <div className="dayline-fill absolute start-0 top-0 h-px bg-[#f2b04a] shadow-[0_0_20px_2px_rgb(242_176_74/0.5)]" style={{ width: `${f * 100}%` }} />
        {live && (
          <span className="absolute -top-[4px] -ms-[4.5px] block size-[9px] rounded-full bg-[#f2b04a] ring-[5px] ring-[#f2b04a]/20" style={{ insetInlineStart: `${f * 100}%` }} />
        )}
        <p className="tnum mt-3 hidden text-xs text-white/50 md:block">
          {t("الآن", "Now")} {formatClock(hhmm)}
        </p>
      </div>
    </aside>
  );
}

// ───────── أجزاء النموذج ─────────

function Head({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      {lede && <p className="mt-2 text-ink-2">{lede}</p>}
    </div>
  );
}

function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-sm border border-ember/30 bg-ember-wash px-3 py-2 text-sm text-ember">
      {text}
    </p>
  );
}

function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="saffron" size="lg" className="mt-1 w-full" disabled={busy} aria-busy={busy}>
      {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
      {children}
    </Button>
  );
}

const inputCls = "h-11 md:h-10";

function EmailField({ value, onChange, error, id }: { value: string; onChange: (v: string) => void; error?: string | null; id: string }) {
  return (
    <Field label={t("البريد الإلكتروني", "Email")} error={error} id={id}>
      {(p) => (
        <Input
          {...p}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          placeholder="name@example.com"
          className={cx(inputCls, "text-start")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  name,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  hint?: string;
  autoComplete: "current-password" | "new-password";
  name: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      {(p) => (
        // الحقل وزرّه باتجاه النص اللاتيني، فيبقى الزرّ في نهاية الحقل لا فوق النقاط
        <div className="relative" dir="ltr">
          <Input
            {...p}
            type={shown ? "text" : "password"}
            name={name}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={cx(inputCls, "pe-12 text-start")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? t("أخفِ كلمة المرور", "Hide password") : t("أظهر كلمة المرور", "Show password")}
            aria-pressed={shown}
            aria-controls={id}
            title={shown ? t("أخفِ كلمة المرور", "Hide password") : t("أظهر كلمة المرور", "Show password")}
            className="press absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center rounded-sm text-ink-3 hover:text-ink"
          >
            {shown ? <EyeOff className="size-[18px]" strokeWidth={1.75} /> : <Eye className="size-[18px]" strokeWidth={1.75} />}
          </button>
        </div>
      )}
    </Field>
  );
}

function Foot({ children }: { children: ReactNode }) {
  return <p className="mt-8 border-t border-line pt-5 text-sm text-ink-2">{children}</p>;
}

const linkCls = "font-medium text-dusk underline decoration-dusk/30 underline-offset-4 hover:decoration-dusk";

// ───────── الدخول ─────────

function Login({ dest }: { dest: string }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { email: "login-email", password: "login-password" };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = { email: emailError(email), password: password ? null : t("اكتب كلمة المرور.", "Enter your password.") };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return focusFirst(next, ids);
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setFormError(authErrorText(error));
    navigate(dest, { replace: true });
  }

  const q = dest !== "/today" ? `?redirect=${encodeURIComponent(dest)}` : "";
  return (
    <>
      <Head title={t("أهلًا بك في واف.", "Welcome to Waf.")} lede={t("سجّل دخولك لتكمل من حيث توقّفت.", "Sign in to pick up where you left off.")} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <EmailField id={ids.email} value={email} onChange={setEmail} error={errors.email} />
        <div className="flex flex-col gap-1.5">
          <PasswordField id={ids.password} name="password" label={t("كلمة المرور", "Password")} autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
          <Link href="/forgot-password" className="inline-flex min-h-11 w-fit items-center text-sm text-ink-2 hover:text-ink md:min-h-0">
            {t("نسيت كلمة المرور؟", "Forgot your password?")}
          </Link>
        </div>
        <FormError text={formError} />
        <Submit busy={busy}>{busy ? t("جارٍ الدخول…", "Signing in…") : t("سجّل الدخول", "Sign in")}</Submit>
      </form>
      <Foot>
        {t("ليس لديك حساب؟ ", "No account yet? ")}
        <Link href={`/signup${q}`} className={linkCls}>
          {t("أنشئ حساباً", "Create one")}
        </Link>
      </Foot>
    </>
  );
}

// ───────── إنشاء حساب ─────────

function Signup({ dest }: { dest: string }) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { name: "su-name", email: "su-email", password: "su-password", confirm: "su-confirm" };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {
      name: name.trim() ? null : t("اكتب اسمك.", "Enter your name."),
      email: emailError(email),
      password: passwordError(password),
      confirm: confirm === password ? null : t("كلمتا المرور غير متطابقتين.", "The passwords don’t match."),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return focusFirst(next, ids);
    setBusy(true);
    const { data, error } = await supabase!.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim().slice(0, NAME_MAX) }, emailRedirectTo: window.location.origin + dest },
    });
    setBusy(false);
    if (error) return setFormError(authErrorText(error));
    // Supabase يعيد مستخدماً بلا هويات حين يكون البريد مسجَّلاً مسبقاً
    if (data.user && data.user.identities && data.user.identities.length === 0) return setFormError(authErrorText({ code: "user_already_exists" }));
    if (data.session) return navigate(dest, { replace: true });
    const q = new URLSearchParams({ email: email.trim() });
    if (dest !== "/today") q.set("redirect", dest);
    navigate(`/verify-email?${q}`, { replace: true });
  }

  const q = dest !== "/today" ? `?redirect=${encodeURIComponent(dest)}` : "";
  return (
    <>
      <Head title={t("ابدأ مع واف.", "Start with Waf.")} lede={t("أنشئ حسابك لتستخدم الخدمة وتحفظ أعمالك.", "Create your account to use Waf and keep your work.")} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t("الاسم", "Name")} error={errors.name} id={ids.name}>
          {(p) => <Input {...p} name="name" autoComplete="name" maxLength={NAME_MAX} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("كما تحبّ أن نناديك", "What we should call you")} />}
        </Field>
        <EmailField id={ids.email} value={email} onChange={setEmail} error={errors.email} />
        <PasswordField
          id={ids.password}
          name="new-password"
          label={t("كلمة المرور", "Password")}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={t("ثمانية أحرف على الأقل.", "At least eight characters.")}
        />
        <PasswordField id={ids.confirm} name="confirm-password" label={t("أعد كتابة كلمة المرور", "Confirm password")} autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
        <FormError text={formError} />
        <Submit busy={busy}>{busy ? t("جارٍ إنشاء الحساب…", "Creating your account…") : t("أنشئ الحساب", "Create account")}</Submit>
      </form>
      <Foot>
        {t("لديك حساب؟ ", "Already have an account? ")}
        <Link href={`/login${q}`} className={linkCls}>
          {t("سجّل الدخول", "Sign in")}
        </Link>
      </Foot>
    </>
  );
}

// ───────── نسيت كلمة المرور ─────────

function Forgot() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = emailError(email);
    setError(err);
    setFormError(null);
    if (err) return document.getElementById("fg-email")?.focus();
    setBusy(true);
    const { error: apiError } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    // الجواب واحد دائماً حتى لا يُعرف أيّ بريد مسجَّل، إلا حين يتعذّر الإرسال أصلاً
    const text = apiError ? authErrorText(apiError) : null;
    if (apiError && (apiError.status === 429 || /fetch|network/i.test(apiError.message))) return setFormError(text);
    setSent(true);
  }

  if (sent)
    return (
      <>
        <Head title={t("تحقّق من بريدك.", "Check your email.")} lede={t("إن كان هذا البريد مسجَّلاً عندنا فقد أرسلنا إليه رابط استعادة.", "If this email is registered with us, we’ve sent it a reset link.")} />
        <p className="text-sm text-ink-2" dir="auto">
          <bdi dir="ltr" className="break-all font-medium text-ink">
            {email.trim()}
          </bdi>
        </p>
        <p className="mt-4 text-sm text-ink-3">{t("الرابط يعمل مدة محدودة. إن لم تجد الرسالة فانظر في مجلد الرسائل غير المرغوبة.", "The link works for a limited time. If you don’t see the email, check your spam folder.")}</p>
        <Foot>
          <Link href="/login" className={linkCls}>
            {t("عُد إلى تسجيل الدخول", "Back to sign in")}
          </Link>
        </Foot>
      </>
    );

  return (
    <>
      <Head title={t("نسيت كلمة المرور؟", "Forgot your password?")} lede={t("اكتب بريدك ونرسل إليه رابطاً تختار به كلمة مرور جديدة.", "Enter your email and we’ll send a link to choose a new password.")} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <EmailField id="fg-email" value={email} onChange={setEmail} error={error} />
        <FormError text={formError} />
        <Submit busy={busy}>{busy ? t("جارٍ الإرسال…", "Sending…") : t("أرسل رابط الاستعادة", "Send reset link")}</Submit>
      </form>
      <Foot>
        <Link href="/login" className={linkCls}>
          {t("عُد إلى تسجيل الدخول", "Back to sign in")}
        </Link>
      </Foot>
    </>
  );
}

// ───────── كلمة مرور جديدة ─────────

function hashError(): string | null {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const d = h.get("error_description");
  return d ? d.replace(/\+/g, " ") : null;
}

function Reset() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<"checking" | "ready" | "invalid">(() => (hashError() ? "invalid" : "checking"));
  const [reason] = useState(hashError);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (state !== "checking" || !supabase) return;
    const ok = () => {
      done.current = true;
      setState("ready");
    };
    supabase.auth.getSession().then(({ data }) => data.session && ok());
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) ok();
    });
    const timer = setTimeout(() => !done.current && setState("invalid"), RECOVERY_WAIT_MS);
    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [state]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = { password: passwordError(password), confirm: confirm === password ? null : t("كلمتا المرور غير متطابقتين.", "The passwords don’t match.") };
    setErrors(next);
    setFormError(null);
    if (next.password || next.confirm) return focusFirst(next, { password: "rs-password", confirm: "rs-confirm" });
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setFormError(authErrorText(error));
    }
    await supabase!.auth.signOut();
    setBusy(false);
    toast.success(t("حُفظت كلمة المرور. سجّل دخولك بها.", "Password saved. Sign in with it."));
    navigate("/login", { replace: true });
  }

  if (state === "checking")
    return (
      <div role="status" className="flex items-center gap-3 text-ink-2">
        <Loader2 className="size-5 animate-spin" strokeWidth={1.75} aria-hidden />
        {t("لحظة… نتحقّق من الرابط.", "One moment… checking the link.")}
      </div>
    );

  if (state === "invalid")
    return (
      <>
        <Head title={t("الرابط لم يعد صالحاً.", "This link no longer works.")} lede={t("روابط الاستعادة تعمل مرة واحدة ولمدة محدودة. اطلب رابطاً جديداً وافتحه مباشرة.", "Reset links work once and for a limited time. Ask for a new one and open it right away.")} />
        {reason && (
          <p className="mb-5 rounded-sm bg-sunk px-3 py-2 text-xs text-ink-3" dir="auto">
            {reason}
          </p>
        )}
        <ButtonLink href="/forgot-password" variant="saffron" size="lg" className="w-full">
          {t("اطلب رابطاً جديداً", "Request a new link")}
        </ButtonLink>
        <Foot>
          <Link href="/login" className={linkCls}>
            {t("عُد إلى تسجيل الدخول", "Back to sign in")}
          </Link>
        </Foot>
      </>
    );

  return (
    <>
      <Head title={t("اختر كلمة مرور جديدة.", "Choose a new password.")} lede={t("بعد الحفظ نُخرجك من الجلسة لتدخل بكلمة المرور الجديدة.", "After saving, you’ll sign in again with the new password.")} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <PasswordField id="rs-password" name="new-password" label={t("كلمة المرور الجديدة", "New password")} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint={t("ثمانية أحرف على الأقل.", "At least eight characters.")} />
        <PasswordField id="rs-confirm" name="confirm-password" label={t("أعد كتابتها", "Confirm it")} autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
        <FormError text={formError} />
        <Submit busy={busy}>{busy ? t("جارٍ الحفظ…", "Saving…") : t("احفظ كلمة المرور", "Save password")}</Submit>
      </form>
    </>
  );
}

// ───────── تفعيل البريد ─────────

function Verify({ initialEmail, dest }: { initialEmail: string; dest: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const known = EMAIL_RE.test(initialEmail.trim());

  async function resend(e: FormEvent) {
    e.preventDefault();
    const err = emailError(email);
    setError(err);
    setFormError(null);
    if (err) return document.getElementById("vf-email")?.focus();
    setBusy(true);
    const { error: apiError } = await supabase!.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: window.location.origin + dest } });
    setBusy(false);
    if (apiError) return setFormError(authErrorText(apiError));
    toast.success(t("أُرسل رابط جديد.", "A new link is on its way."));
  }

  return (
    <>
      <Head
        title={t("تحقّق من بريدك الإلكتروني.", "Check your email.")}
        lede={
          known ? (
            <>
              {t("أرسلنا رابط التفعيل إلى ", "We sent a confirmation link to ")}
              <bdi dir="ltr" className="break-all font-medium text-ink">
                {initialEmail.trim()}
              </bdi>
              {t(". افتحه لتبدأ.", ". Open it to get started.")}
            </>
          ) : (
            t("أرسلنا إليك رابط التفعيل. افتحه لتبدأ.", "We sent you a confirmation link. Open it to get started.")
          )
        }
      />
      <p className="text-sm text-ink-3">{t("لم تصلك الرسالة؟ انظر في مجلد الرسائل غير المرغوبة، أو أعد الإرسال.", "Didn’t get it? Check your spam folder, or send it again.")}</p>
      <form onSubmit={resend} noValidate className="mt-6 flex flex-col gap-4">
        {!known && <EmailField id="vf-email" value={email} onChange={setEmail} error={error} />}
        <FormError text={formError} />
        <Button type="submit" variant="quiet" size="lg" className="w-full" disabled={busy} aria-busy={busy}>
          {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
          {t("إعادة إرسال البريد", "Resend the email")}
        </Button>
      </form>
      <Foot>
        <Link href="/login" className={linkCls}>
          {t("عُد إلى تسجيل الدخول", "Back to sign in")}
        </Link>
      </Foot>
    </>
  );
}

// ───────── العرض التجريبي ─────────

function DemoNote({ mode }: { mode: Mode }) {
  const titles: Record<Mode, string> = {
    login: t("أهلًا بك في واف.", "Welcome to Waf."),
    signup: t("ابدأ مع واف.", "Start with Waf."),
    forgot: t("نسيت كلمة المرور؟", "Forgot your password?"),
    reset: t("اختر كلمة مرور جديدة.", "Choose a new password."),
    verify: t("تحقّق من بريدك الإلكتروني.", "Check your email."),
  };
  return (
    <>
      <Head title={titles[mode]} />
      <div className="rounded-md border border-line bg-sheet p-4">
        <p className="font-medium">{t("الحسابات غير موصولة في هذه المعاينة.", "Accounts aren’t connected in this preview.")}</p>
        <p className="mt-1 text-sm text-ink-2">{t("جرّب واف كاملاً ببيانات تجريبية تُحفظ في هذا المتصفّح فقط.", "Try all of Waf with sample data kept in this browser only.")}</p>
      </div>
      <ButtonLink href="/today" variant="saffron" size="lg" className="mt-5 w-full">
        {t("ادخل العرض التجريبي", "Enter the demo")}
      </ButtonLink>
    </>
  );
}
