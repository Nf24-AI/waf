import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

export const control =
  "w-full rounded-sm border border-line bg-sheet px-3 text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/25 aria-[invalid=true]:border-ember";

interface FieldShell {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

/** حقل بتسمية ظاهرة، وتلميح تحته، والخطأ بجانبه لا في أعلى الصفحة */
export function Field({ label, hint, error, className, children, id }: FieldShell & { children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint || error ? `${fid}-hint` : undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={fid} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      {children({ id: fid, "aria-describedby": hintId, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={hintId} className={cx("text-xs", error ? "text-ember" : "text-ink-3")} role={error ? "alert" : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(control, "h-10", className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(control, "resize-y py-2 leading-relaxed [field-sizing:content] min-h-[4.5rem]", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(control, "h-10 appearance-none bg-[length:12px] bg-no-repeat pe-8 [background-position:left_0.75rem_center] rtl:[background-position:left_0.75rem_center] ltr:[background-position:right_0.75rem_center]", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%23636e84' stroke-width='1.6'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

/** مجموعة اختيار واحد بأزرار متجاورة */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-sm border border-line bg-sunk p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "press rounded-[4px] px-3 font-medium transition-colors duration-150",
              size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
              on ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
