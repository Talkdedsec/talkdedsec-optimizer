import { Gauge, type LucideIcon, Settings2, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Background } from "./Background.tsx";
import { Dashboard, Optimize, Preferences, Scan } from "./pages.tsx";
import { AppProvider, useApp } from "./state.tsx";
import { cx } from "./ui.tsx";

export type Route = "dashboard" | "scan" | "optimize" | "settings";
const NAV: [Route, LucideIcon][] = [
  ["dashboard", Gauge],
  ["scan", Sparkles],
  ["optimize", SlidersHorizontal],
  ["settings", Settings2],
];

const STROKE = { stroke: "currentColor", strokeWidth: 1, strokeLinecap: "square", vectorEffect: "non-scaling-stroke" } as const;
const Glyph = ({ children }: { children: ReactNode }) => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>{children}</svg>;

function WindowControls({ className }: { className?: string }) {
  const [max, setMax] = useState(false);
  useEffect(() => window.api.window.onMaximize(setMax), []);
  const btn =
    "no-drag grid h-[32px] w-[46px] place-items-center text-white/70 transition-colors duration-150 hover:bg-white/[0.12] hover:text-white active:bg-white/[0.18] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/40";
  return (
    <div className={cx("flex items-center overflow-hidden rounded-bl-[14px]", className)}>
      <button type="button" className={btn} onClick={window.api.window.minimize} aria-label="Minimize" title="Minimize">
        <Glyph><line x1="0" y1="5" x2="10" y2="5" {...STROKE} /></Glyph>
      </button>
      <button type="button" className={btn} onClick={window.api.window.toggleMaximize} aria-label={max ? "Restore" : "Maximize"} title={max ? "Restore" : "Maximize"}>
        <Glyph>
          {max ? (
            <>
              <rect x="0.5" y="2.5" width="7" height="7" {...STROKE} />
              <path d="M2.5 2.5V0.5h7v7h-2" {...STROKE} fill="none" />
            </>
          ) : (
            <rect x="0.5" y="0.5" width="9" height="9" {...STROKE} />
          )}
        </Glyph>
      </button>
      <button type="button" className={cx(btn, "hover:bg-white hover:text-black active:bg-white/90")} onClick={window.api.window.close} aria-label="Close" title="Close">
        <Glyph>
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" {...STROKE} />
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" {...STROKE} />
        </Glyph>
      </button>
    </div>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center border border-white/15 bg-white/[0.06] font-bold leading-none"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), fontSize: Math.round(size * 0.5) }}
    >
      T
    </div>
  );
}

function Shell({ route, onRoute, children }: { route: Route; onRoute: (r: Route) => void; children: ReactNode }) {
  const { d, info } = useApp();
  const Shield = info.elevated ? ShieldCheck : ShieldAlert;
  return (
    <div className="relative z-10 flex h-full">
      <aside className="flex w-[236px] shrink-0 flex-col border-r border-white/[0.07] bg-black/25 backdrop-blur-2xl">
        <div className="drag-region flex h-[54px] items-center gap-2.5 px-5">
          <LogoMark />
          <span className="text-[13px] font-semibold tracking-[-0.02em]">Talkdedsec</span>
        </div>
        <nav className="flex flex-col gap-1 px-3 pt-3">
          {NAV.map(([key, Icon]) => {
            const active = route === key;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onRoute(key)}
                className={cx(
                  "no-drag group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium transition-all duration-200",
                  active ? "bg-white text-black shadow-[0_6px_20px_-8px_rgba(255,255,255,0.45)]" : "text-white/55 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon className={cx("size-[17px] shrink-0", active ? "text-black" : "text-white/45 group-hover:text-white/80")} />
                <span className="truncate">{d.nav[key]}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-3">
          {!info.elevated && (
            <div className="mb-3 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{d.admin.no}</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{d.admin.hint}</p>
            </div>
          )}
          <div className="glass-soft flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold leading-none text-white/70 ring-1 ring-inset ring-white/10">T</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium leading-tight">Talkdedsec</div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/40">
                <Shield className="size-3" />
                <span className="truncate">v{info.version} · {info.elevated ? d.admin.yes : d.admin.no}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="drag-region h-[54px] shrink-0" />
        <main className="scroll-area min-h-0 flex-1 overflow-y-auto px-9 pb-10">{children}</main>
      </div>
    </div>
  );
}

function Routes() {
  const [route, setRoute] = useState<Route>("dashboard");
  return (
    <Shell route={route} onRoute={setRoute}>
      <div key={route} className="animate-fade-in">
        {route === "dashboard" && <Dashboard go={setRoute} />}
        {route === "scan" && <Scan />}
        {route === "optimize" && <Optimize />}
        {route === "settings" && <Preferences />}
      </div>
    </Shell>
  );
}

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <Background className="pointer-events-none absolute inset-0" />
      <div className="drag-region fixed inset-x-0 top-0 z-40 h-[46px]" />
      <WindowControls className="fixed right-0 top-0 z-50" />
      <AppProvider><Routes /></AppProvider>
    </div>
  );
}
