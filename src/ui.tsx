import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, useEffect, useState } from "react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("inline-block size-4 animate-spin rounded-full border-2 border-white/25 border-t-white", className)} />;
}
export const DARK_SPINNER = "border-black/25 border-t-black";

const VARIANT = {
  primary: "bg-white text-black shadow-[0_8px_24px_-8px_rgba(255,255,255,0.45)] hover:bg-white/90",
  secondary: "border border-white/15 bg-white/[0.07] text-white backdrop-blur-xl hover:bg-white/[0.12] hover:border-white/25",
  ghost: "text-white/65 hover:bg-white/[0.07] hover:text-white",
  outline: "border border-white/20 bg-transparent text-white hover:bg-white/[0.06]",
  danger: "border border-white/25 bg-transparent text-white hover:bg-white hover:text-black",
};
const SIZE = { sm: "h-8 px-3.5", md: "h-10 px-5", lg: "h-12 px-7 text-[14px]" };

export function Button({
  variant = "secondary", size = "md", className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "no-drag inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-[13px] font-medium tracking-[-0.01em] transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    />
  );
}

/** Two clicks for anything destructive: the first arms it for a few seconds, the second runs it. */
export function useArmed(ms = 4000): [boolean, (run: () => void) => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(timer);
  }, [armed, ms]);
  return [armed, (run) => (armed ? (setArmed(false), run()) : setArmed(true))];
}

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: "solid" | "neutral" | "outline" }) {
  return (
    <span
      {...rest}
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-[3px] text-[10px] font-medium uppercase tracking-[0.08em]",
        tone === "solid" && "bg-white text-black",
        tone === "neutral" && "bg-white/[0.08] text-white/60",
        tone === "outline" && "border border-white/20 text-white/70",
        className,
      )}
    />
  );
}

export const Divider = ({ className }: { className?: string }) => <div className={cx("h-px w-full bg-white/[0.07]", className)} />;
export const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35";

export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "no-drag inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        checked ? "border-white bg-white" : "border-white/15 bg-white/[0.06]",
        className,
      )}
    >
      <span
        className={cx(
          "pointer-events-none block size-[20px] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out",
          checked ? "translate-x-[20px] bg-black" : "translate-x-[2px] bg-white/60",
        )}
      />
    </button>
  );
}

export function ScoreRing({ value, label }: { value: number; label: string }) {
  const c = 2 * Math.PI * 54;
  return (
    <div className="relative grid size-[136px] place-items-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 136 136" aria-hidden>
        <circle cx="68" cy="68" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle
          cx="68" cy="68" r="54" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="text-center">
        <div className="text-[34px] font-semibold leading-none tracking-[-0.04em]">{value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</div>
      </div>
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-soft px-4 py-3.5">
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/40">{label}</div>
      <div className="mt-1.5 truncate text-[15px] font-medium tracking-[-0.02em]" title={hint ?? value}>{value}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-7 pt-1">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.035em]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-white/45">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SettingRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium tracking-[-0.01em]">{title}</div>
        {hint && <p className="mt-1 max-w-[460px] text-[12px] leading-relaxed text-white/40">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Small pill toast pinned to the bottom of the window. */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-7 left-1/2 z-50 -translate-x-1/2 animate-fade-up" role="status">
      <div className="glass flex items-center gap-2.5 rounded-full px-5 py-3">
        <span className="size-1.5 rounded-full bg-white" />
        <span className="text-[13px] font-medium">{children}</span>
      </div>
    </div>
  );
}
