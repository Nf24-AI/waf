import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * The gate.
 *
 * Shown only when the server reports `locked` — that is, when APP_PASSWORD is
 * set. Without it the workspace is open, which is correct on localhost and
 * wrong anywhere else.
 *
 * The password is posted to `auth.unlock`, which returns a signed session
 * cookie. Nothing is stored in the browser, and a wrong password is answered
 * with the same flat message however it failed.
 */
export default function Lock({
  onUnlock,
  language,
}: {
  onUnlock: (password: string) => Promise<boolean>;
  language: "ar" | "en";
}) {
  const isArabic = language === "ar";
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || pending) return;

    setPending(true);
    setFailed(false);
    try {
      const ok = await onUnlock(password);
      if (!ok) {
        setFailed(true);
        setPassword("");
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="lock-screen">
      <form className="lock-card waf-dots" onSubmit={submit}>
        <p className="lock-wordmark">واف</p>
        <p className="lock-eyebrow">{isArabic ? "مساحة مقيّدة" : "RESTRICTED"}</p>

        <label className="lock-field">
          <span>{isArabic ? "كلمة المرور" : "Password"}</span>
          <input
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setFailed(false);
            }}
            aria-invalid={failed}
            aria-describedby={failed ? "lock-error" : undefined}
          />
        </label>

        {/* One flat message: never reveal whether the password merely mistyped. */}
        {failed && (
          <p className="lock-error" id="lock-error" role="alert">
            {isArabic ? "كلمة المرور غير صحيحة" : "Incorrect password"}
          </p>
        )}

        <button className="primary-button lock-submit" type="submit" disabled={!password || pending}>
          {pending && <Loader2 size={15} className="lock-spinner" />}
          {isArabic ? "دخول" : "Enter"}
        </button>
      </form>
    </div>
  );
}
