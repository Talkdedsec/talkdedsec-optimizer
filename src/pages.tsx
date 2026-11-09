import {
  ArrowRight, Check, ChevronDown, CircleSlash, History, Info, Lock, type LucideIcon, MonitorCog, Rocket, RotateCcw, Search, ShieldAlert, ShieldCheck,
  Sparkles, Trash2, TriangleAlert, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BY_ID, TWEAKS } from "../electron/engine.ts";
import { TEXT } from "../shared/texts.ts";
import { CATEGORIES, type Category, type RunResult, type SkipReason, type Tweak } from "../shared/types.ts";
import type { Route } from "./App.tsx";
import { duration, fmt } from "./i18n.ts";
import { useApp } from "./state.tsx";
import { Badge, Button, cx, DARK_SPINNER, Divider, PageHeader, ScoreRing, SECTION_LABEL, SettingRow, Spinner, StatTile, Switch, Toast, useArmed } from "./ui.tsx";

const isSafe = (id: string) => BY_ID.get(id)?.impact === "safe";
const shortOs = (name: string) => name.replace("Microsoft ", "");

function ActionCard({ icon: Icon, title, hint, busy, disabled, emphasis, confirm, onRun }: {
  icon: LucideIcon; title: string; hint: string; busy: boolean; disabled: boolean; emphasis?: boolean; confirm?: boolean; onRun: () => void;
}) {
  const { d } = useApp();
  const [armed, arm] = useArmed();
  return (
    <button
      type="button"
      onClick={() => (confirm ? arm(onRun) : onRun())}
      disabled={busy || disabled}
      className={cx(
        "no-drag group relative flex h-full flex-col items-start gap-3 rounded-[24px] border p-5 text-left transition-all duration-250 ease-out",
        "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40",
        emphasis
          ? "border-white bg-white text-black shadow-[0_16px_48px_-20px_rgba(255,255,255,0.6)] hover:shadow-[0_22px_60px_-20px_rgba(255,255,255,0.75)]"
          : "border-white/10 bg-white/[0.045] backdrop-blur-2xl hover:border-white/20 hover:bg-white/[0.08]",
      )}
    >
      <div className={cx("grid size-10 place-items-center rounded-[13px] border transition-colors", emphasis ? "border-black/10 bg-black/[0.06]" : "border-white/[0.12] bg-white/[0.06]")}>
        {busy ? <Spinner className={emphasis ? DARK_SPINNER : undefined} /> : <Icon className={cx("size-[18px]", emphasis ? "text-black" : "text-white/80")} />}
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold tracking-[-0.02em]">{title}</div>
        <p className={cx("mt-1 text-[12px] leading-relaxed", emphasis ? "text-black/55" : "text-white/40")}>{armed ? d.common.confirmAgain : hint}</p>
      </div>
    </button>
  );
}

const summary = (d: ReturnType<typeof useApp>["d"], r: RunResult) =>
  [fmt(d.opt.okCount, { count: r.applied }), fmt(d.opt.failCount, { count: r.failed }), r.requiresRestart ? d.opt.restartPrompt : null].filter(Boolean).join(" · ");

export function Dashboard({ go }: { go: (r: Route) => void }) {
  const { d, settings, applied, runScan, apply } = useApp();
  const scan = settings.lastScan;
  const p = scan?.profile ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const run = async (key: string, job: () => Promise<string>) => {
    setBusy(key);
    try {
      setToast(await job());
    } catch {
      setToast(d.scan.failed);
    } finally {
      setBusy(null);
    }
  };
  const tile = (key: string) => ({ busy: busy === key, disabled: busy !== null && busy !== key });

  return (
    <>
      <PageHeader
        title={d.dash.welcome}
        subtitle={d.dash.subtitle}
        actions={
          <Button disabled={busy !== null} onClick={() => void run("scan", async () => fmt(d.scan.recommendedCount, { count: (await runScan()).recommended.length }))}>
            {busy === "scan" ? <Spinner /> : <MonitorCog />}
            {busy === "scan" ? d.scan.running : d.scan.rescan}
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="CPU" value={p ? p.cpuName.split(" ").slice(0, 4).join(" ") : "—"} hint={p?.cpuName} />
        <StatTile label="GPU" value={p?.gpus[0]?.name ?? "—"} />
        <StatTile label="RAM" value={p ? `${p.ramTotalGb} GB` : "—"} hint={p ? fmt(d.dash.ram + ": {v} GB", { v: p.ramFreeGb }) : undefined} />
        <StatTile label={p?.systemDriveType ?? d.category.storage} value={p ? `${p.systemDriveFreeGb} / ${p.systemDriveTotalGb} GB` : "—"} />
      </section>

      <section className="mt-8">
        <h2 className={cx("mb-3.5", SECTION_LABEL)}>{d.dash.quick}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard emphasis icon={Rocket} title={d.dash.oneClick} hint={d.dash.oneClickHint} {...tile("one")}
            onRun={() => void run("one", async () => {
              const ids = (scan ?? (await runScan())).recommended.filter((id) => isSafe(id) && !applied.has(id));
              return ids.length ? summary(d, await apply(ids)) : d.dash.nothingToApply;
            })} />
          <ActionCard icon={Zap} title={d.dash.flushRam} hint={d.dash.flushRamHint} {...tile("ram")}
            onRun={() => void run("ram", async () => fmt(d.dash.freedRam, { value: (await window.api.flushRam()).freedGb.toFixed(2) }))} />
          <ActionCard confirm icon={Trash2} title={d.dash.deepClean} hint={d.dash.deepCleanHint} {...tile("clean")}
            onRun={() => void run("clean", async () => fmt(d.dash.freedDisk, { value: (await window.api.deepClean()).freedMb }))} />
          <ActionCard icon={History} title={d.dash.restorePoint} hint={d.dash.restorePointHint} {...tile("rp")}
            onRun={() => void run("rp", async () => ((await window.api.restorePoint()) ? d.dash.restorePointDone : d.dash.restorePointFailed))} />
        </div>
      </section>

      <section className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="glass p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{d.scan.findings}</h2>
            {p && <Badge>{shortOs(p.osName)} · {p.osBuild}</Badge>}
          </div>
          {scan ? (
            <ul className="mt-4 space-y-2.5">
              {scan.findings.map((f) => (
                <li key={f.code} className="flex items-start gap-3">
                  <span className={cx("mt-[7px] size-1.5 shrink-0 rounded-full", f.level === "bad" ? "bg-white" : f.level === "warn" ? "bg-white/55" : "bg-white/25")} />
                  <span className="text-[13px] leading-relaxed text-white/60">{fmt(d.finding[f.code], { value: f.value })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-4 py-9">
              <p className="max-w-[420px] text-[13px] leading-relaxed text-white/45">{d.scan.empty}</p>
              <Button variant="primary" disabled={busy !== null} onClick={() => void run("scan", async () => fmt(d.scan.recommendedCount, { count: (await runScan()).recommended.length }))}>
                {busy === "scan" ? <Spinner className={DARK_SPINNER} /> : <MonitorCog />}
                {busy === "scan" ? d.scan.running : d.dash.runScan}
              </Button>
            </div>
          )}
        </div>
        <div className="glass flex flex-col items-center justify-center gap-5 p-6">
          <ScoreRing value={scan?.score ?? 0} label={d.dash.health} />
          <div className="grid w-full grid-cols-2 gap-2.5">
            {[[applied.size, d.dash.applied], [scan?.recommended.length ?? 0, d.scan.recommended]].map(([n, label]) => (
              <div key={label} className="glass-soft px-3.5 py-3 text-center">
                <div className="text-[19px] font-semibold tracking-[-0.03em]">{n}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</div>
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={() => go("scan")}>{d.nav.scan}<ArrowRight /></Button>
        </div>
      </section>
      {toast && <Toast>{toast}</Toast>}
    </>
  );
}

export function Scan() {
  const { d, lang, settings, applied, runScan, apply } = useApp();
  const scan = settings.lastScan;
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const doScan = async () => {
    setScanning(true);
    setNote(null);
    try {
      await runScan();
    } catch {
      setNote(d.scan.failed);
    } finally {
      setScanning(false);
    }
  };
  const doApply = async (ids: string[]) => {
    const pending = ids.filter((id) => !applied.has(id));
    if (pending.length === 0) return setNote(d.dash.nothingToApply);
    setApplying(true);
    try {
      setNote(summary(d, await apply(pending)));
    } finally {
      setApplying(false);
    }
  };

  if (!scan) {
    return (
      <>
        <PageHeader title={d.nav.scan} subtitle={d.scan.subtitle} />
        <div className="glass grid place-items-center px-8 py-20 text-center">
          <div className="grid size-16 place-items-center rounded-[22px] border border-white/[0.12] bg-white/[0.05]">
            {scanning ? <Spinner className="size-6" /> : <Sparkles className="size-7 text-white/75" />}
          </div>
          <h2 className="mt-6 text-[17px] font-semibold tracking-[-0.025em]">{scanning ? d.scan.running : d.nav.scan}</h2>
          <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-white/45">{note ?? d.scan.empty}</p>
          <Button variant="primary" size="lg" className="mt-7" disabled={scanning} onClick={() => void doScan()}>
            {scanning ? <Spinner className={DARK_SPINNER} /> : <Sparkles />}
            {scanning ? d.scan.running : d.scan.start}
          </Button>
        </div>
      </>
    );
  }

  const p = scan.profile;
  const recommended = scan.recommended.map((id) => BY_ID.get(id)).filter((t): t is Tweak => !!t);
  return (
    <>
      <PageHeader
        title={d.nav.scan}
        subtitle={d.scan.subtitle}
        actions={<Button disabled={scanning || applying} onClick={() => void doScan()}>{scanning ? <Spinner /> : <Sparkles />}{d.scan.rescan}</Button>}
      />
      <section className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="glass flex flex-col items-center gap-5 p-6">
          <ScoreRing value={scan.score} label={d.scan.score} />
          <div className="flex w-full flex-col gap-2.5">
            <Button variant="primary" className="w-full" disabled={applying} onClick={() => void doApply(scan.recommended)}>
              {applying ? <Spinner className={DARK_SPINNER} /> : <Sparkles />}
              {d.scan.applyRecommended}
            </Button>
            <Button className="w-full" disabled={applying} onClick={() => void doApply(scan.recommended.filter(isSafe))}>
              <ShieldCheck />
              {d.scan.applySafe}
            </Button>
          </div>
          {note && <p className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-[12px] leading-relaxed text-white/65" role="status">{note}</p>}
        </div>
        <div className="glass p-6">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{d.scan.hardware}</h2>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <StatTile label={d.scan.hw.cpu} value={p.cpuName} />
            <StatTile label={d.scan.hwCores} value={`${p.cpuCores} / ${p.cpuThreads}`} />
            <StatTile label={d.scan.hw.gpu} value={p.gpus[0]?.name ?? "—"} />
            <StatTile label="VRAM" value={p.gpus[0]?.vramGb ? `${p.gpus[0].vramGb} GB` : "—"} />
            <StatTile label={d.scan.hw.ram} value={`${p.ramTotalGb} GB`} hint={`${d.dash.ram}: ${p.ramFreeGb} GB`} />
            <StatTile label={d.scan.hw.disk} value={`${p.systemDriveType} · ${p.systemDriveTotalGb} GB`} />
            <StatTile label={d.scan.hw.type} value={p.chassis === "Laptop" ? d.scan.laptop : d.scan.desktop} />
            <StatTile label={d.scan.hw.power} value={p.powerPlan || "—"} />
            <StatTile label={d.scan.hw.display} value={p.display ? `${p.display.width}×${p.display.height} @ ${p.display.refreshHz} Hz` : "—"} />
            <StatTile label="Windows" value={`${shortOs(p.osName)} · ${p.osBuild}`} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3.5 flex items-center gap-2.5">
          <h2 className={SECTION_LABEL}>{d.scan.recommended}</h2>
          <Badge tone="outline">{fmt(d.scan.recommendedCount, { count: recommended.length })}</Badge>
        </div>
        <div className="glass divide-y divide-white/[0.06] overflow-hidden">
          {recommended.map((t) => (
            <div key={t.id} className="flex items-start gap-4 px-5 py-4">
              <div className="mt-[3px] grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.08]">
                {applied.has(t.id) ? <Check className="size-3.5 text-white" /> : <ShieldCheck className="size-3.5 text-white/60" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium tracking-[-0.01em]">{TEXT[t.id][lang][0]}</span>
                  <Badge>{d.category[t.category]}</Badge>
                  {t.impact !== "safe" && <Badge tone="outline">{d.impact[t.impact]}</Badge>}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-white/40">{TEXT[t.id][lang][1]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {scan.skipped.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            aria-expanded={showSkipped}
            onClick={() => setShowSkipped((v) => !v)}
            className={cx("no-drag flex items-center gap-2 transition-colors hover:text-white/60", SECTION_LABEL)}
          >
            <ChevronDown className={cx("size-3.5 transition-transform duration-200", showSkipped && "rotate-180")} />
            {d.scan.skipped}
            <Badge>{fmt(d.scan.skippedCount, { count: scan.skipped.length })}</Badge>
          </button>
          {showSkipped && (
            <div className="glass mt-3 divide-y divide-white/[0.06] overflow-hidden">
              {scan.skipped.map(({ id, reason }) => (
                <div key={id} className="flex items-start gap-4 px-5 py-3.5">
                  <CircleSlash className="mt-[3px] size-4 shrink-0 text-white/25" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium tracking-[-0.01em] text-white/70">{TEXT[id][lang][0]}</div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-white/35">{fmt(d.skip[reason.code], reason)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function TweakRow({ tweak, unsuitable, checked, onToggle }: { tweak: Tweak; unsuitable?: SkipReason; checked: boolean; onToggle: (v: boolean) => void }) {
  const { d, lang, applied } = useApp();
  const [title, description] = TEXT[tweak.id][lang];
  return (
    <div className={cx("flex items-start gap-4 px-5 py-4 transition-colors duration-200", checked ? "bg-white/[0.035]" : "hover:bg-white/[0.02]")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium tracking-[-0.01em]">{title}</span>
          {applied.has(tweak.id) && <Badge tone="solid"><Check className="mr-1 size-2.5" />{d.opt.applied}</Badge>}
          {tweak.impact !== "safe" && <Badge tone="outline">{d.impact[tweak.impact]}</Badge>}
          {!tweak.reversible && <Badge><Lock className="mr-1 size-2.5" />{d.opt.oneWay}</Badge>}
          {tweak.requiresRestart && <Badge>{d.opt.needsRestart}</Badge>}
        </div>
        <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-white/40">{description}</p>
        {unsuitable && <p className="mt-1 text-[12px] leading-relaxed text-white/55">{d.opt.unsuitable}: {fmt(d.skip[unsuitable.code], unsuitable)}</p>}
      </div>
      <Switch checked={checked} onChange={onToggle} label={title} className="mt-0.5" />
    </div>
  );
}

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cx(
      "no-drag rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200 active:scale-[0.97]",
      active ? "bg-white text-black" : "border border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white",
    )}
  >
    {children}
  </button>
);

export function Optimize() {
  const { d, lang, info, settings, applied, apply, revert } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [appliedOnly, setAppliedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"apply" | "revert" | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restartArmed, armRestart] = useArmed();

  const unsuitable = useMemo(() => new Map(settings.lastScan?.skipped.map((s) => [s.id, s.reason])), [settings.lastScan]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang);
    return TWEAKS.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (appliedOnly && !applied.has(t.id)) return false;
      return !q || TEXT[t.id][lang].some((s) => s.toLocaleLowerCase(lang).includes(q)) || t.id.includes(q);
    });
  }, [query, category, appliedOnly, applied, lang]);
  const groups = CATEGORIES.map((c) => ({ category: c, tweaks: visible.filter((t) => t.category === c) })).filter((g) => g.tweaks.length);

  const chosen = [...selected].map((id) => BY_ID.get(id)!);
  const oneWay = chosen.filter((t) => !t.reversible).length;
  const advanced = chosen.filter((t) => t.impact === "advanced").length;
  const undoable = chosen.filter((t) => applied.has(t.id)).map((t) => t.id);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const run = async (kind: "apply" | "revert") => {
    setConfirming(false);
    setBusy(kind);
    setResult(null);
    try {
      setResult(kind === "apply" ? await apply([...selected]) : await revert(undoable));
      if (kind === "revert") setSelected(new Set());
    } finally {
      setBusy(null);
    }
  };
  const failed = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <>
      <PageHeader
        title={d.nav.optimize}
        subtitle={d.opt.subtitle}
        actions={
          <>
            <Button disabled={undoable.length === 0 || busy !== null} onClick={() => void run("revert")}>
              {busy === "revert" ? <Spinner /> : <RotateCcw />}
              {busy === "revert" ? d.opt.reverting : d.opt.revert}
            </Button>
            <Button variant="primary" disabled={selected.size === 0 || busy !== null} onClick={() => (oneWay + advanced > 0 ? setConfirming(true) : void run("apply"))}>
              {busy === "apply" ? <Spinner className={DARK_SPINNER} /> : <Check />}
              {busy === "apply" ? d.opt.applying : `${d.opt.apply} (${selected.size})`}
            </Button>
          </>
        }
      />
      {!info.elevated && (
        <div className="glass mb-4 flex items-start gap-3 px-5 py-4">
          <ShieldAlert className="mt-px size-4 shrink-0 text-white/60" />
          <p className="text-[12px] leading-relaxed text-white/55">{d.admin.hint}</p>
        </div>
      )}
      {confirming && (
        <div className="glass mb-4 flex flex-wrap items-center gap-3 px-5 py-4" role="alertdialog" aria-label={d.opt.applyAnyway}>
          <TriangleAlert className="size-4 shrink-0 text-white/70" />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/65">{fmt(d.opt.risky, { oneWay, advanced })}</p>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{d.common.cancel}</Button>
          <Button variant="danger" size="sm" onClick={() => void run("apply")}>{d.opt.applyAnyway}</Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.opt.search}
            aria-label={d.opt.search}
            className="no-drag h-10 w-full select-text rounded-full border border-white/[0.12] bg-white/[0.05] pl-11 pr-4 text-[13px] text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.08]"
          />
        </div>
        <Button variant={appliedOnly ? "primary" : "secondary"} aria-pressed={appliedOnly} onClick={() => setAppliedOnly((v) => !v)}>{appliedOnly ? d.opt.appliedOnly : d.opt.allTweaks}</Button>
        {/* Select-all never picks advanced, one-way or unsuitable tweaks; those are switched on one by one, on purpose. */}
        <Button disabled={visible.length === 0} onClick={() => setSelected(new Set(visible.filter((t) => t.reversible && t.impact !== "advanced" && !unsuitable.has(t.id)).map((t) => t.id)))}>{d.opt.selectAll}</Button>
        <Button variant="ghost" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>{d.opt.clear}</Button>
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>{d.common.all}</Chip>
        {CATEGORIES.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{d.category[c]}</Chip>)}
      </div>

      {result && (
        <div className="glass mb-5 px-5 py-4" role="status">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[13px] font-semibold tracking-[-0.01em]">{d.opt.done}</span>
            <span className="text-[12px] text-white/55">{fmt(d.opt.okCount, { count: result.applied })}</span>
            {result.failed > 0 && <span className="flex items-center gap-1.5 text-[12px] text-white/55"><TriangleAlert className="size-3.5" />{fmt(d.opt.failCount, { count: result.failed })}</span>}
            <span className="text-[12px] text-white/35">{fmt(d.opt.duration, { value: duration(result.totalMs) })}</span>
            {result.restorePoint && <Badge>{d.opt.restorePoint}</Badge>}
            {result.requiresRestart && (
              <div className="ml-auto flex items-center gap-2.5">
                <span className="text-[12px] text-white/55">{d.opt.restartPrompt}</span>
                <Button variant="outline" size="sm" onClick={() => armRestart(() => void window.api.restartWindows())}>{restartArmed ? d.common.confirmAgain : d.common.restartNow}</Button>
              </div>
            )}
          </div>
          {failed.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-[12px] leading-relaxed text-white/45">
              {failed.map((r) => <li key={r.id}><span className="text-white/75">{TEXT[r.id]?.[lang][0] ?? r.id}</span> — {d.err[r.error ?? ""] ?? r.error}</li>)}
            </ul>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="glass grid place-items-center px-6 py-16 text-[13px] text-white/40">{d.opt.empty}</div>
      ) : (
        <div className="space-y-6 pb-4">
          {groups.map((g) => (
            <section key={g.category}>
              <div className="mb-2.5 flex items-center gap-2.5 px-1">
                <h2 className={SECTION_LABEL}>{d.category[g.category]}</h2>
                <Badge>{g.tweaks.length}</Badge>
              </div>
              <div className="glass divide-y divide-white/[0.06] overflow-hidden">
                {g.tweaks.map((t) => <TweakRow key={t.id} tweak={t} unsuitable={unsuitable.get(t.id)} checked={selected.has(t.id)} onToggle={(on) => toggle(t.id, on)} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function LanguageSegment() {
  const { lang, patch } = useApp();
  const langs = ["tr", "en"] as const;
  return (
    <div className="segment no-drag inline-flex" role="radiogroup">
      <div aria-hidden className="absolute inset-y-1 w-[calc((100%-0.5rem)/2)] rounded-full bg-white transition-transform duration-300 ease-apple" style={{ transform: `translateX(${langs.indexOf(lang) * 100}%)` }} />
      {langs.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => void patch({ lang: l })}
          className={cx("relative z-10 w-[46px] rounded-full py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-200", lang === l ? "text-black" : "text-white/50 hover:text-white/80")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Preferences() {
  const { d, info, settings, applied, patch, revert } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const revertAll = async () => {
    setBusy(true);
    try {
      setNote(summary(d, await revert([...applied])));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <PageHeader title={d.nav.settings} />
      <div className="max-w-[760px] space-y-3">
        <div className="glass divide-y divide-white/[0.06]">
          <SettingRow title={d.settings.language} hint={d.settings.languageHint}><LanguageSegment /></SettingRow>
          <SettingRow title={d.settings.restorePoint} hint={d.settings.restorePointHint}>
            <Switch label={d.settings.restorePoint} checked={settings.createRestorePoint} onChange={(v) => void patch({ createRestorePoint: v })} />
          </SettingRow>
        </div>
        <div className="glass divide-y divide-white/[0.06]">
          <div className={cx("px-6 pb-1 pt-5", SECTION_LABEL)}>{d.settings.system}</div>
          <SettingRow title={info.elevated ? d.admin.yes : d.admin.no} hint={info.elevated ? undefined : d.admin.hint}>
            {info.elevated ? <ShieldCheck className="size-5 text-white/70" /> : <ShieldAlert className="size-5 text-white/45" />}
          </SettingRow>
        </div>
        <div className="glass divide-y divide-white/[0.06]">
          <div className={cx("px-6 pb-1 pt-5", SECTION_LABEL)}>{d.settings.dangerZone}</div>
          <SettingRow title={d.settings.revertAll} hint={note ?? fmt(d.settings.revertAllHint, { count: applied.size })}>
            {confirming ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{d.common.cancel}</Button>
                <Button variant="danger" size="sm" disabled={busy} onClick={() => void revertAll()}>{busy ? <Spinner /> : <RotateCcw />}{d.common.confirm}</Button>
              </div>
            ) : (
              <Button size="sm" disabled={applied.size === 0} onClick={() => setConfirming(true)}><RotateCcw />{applied.size}</Button>
            )}
          </SettingRow>
        </div>
        <div className="glass px-6 py-5">
          <div className={SECTION_LABEL}>{d.settings.about}</div>
          <Divider className="my-4" />
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Talkdedsec</span>
            <span className="text-white/40">{d.settings.version} {info.version}</span>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-white/35">
            <Info className="mt-px size-3.5 shrink-0" />
            <span>
              {d.settings.privacy}{" "}
              <button type="button" className="no-drag underline underline-offset-2 hover:text-white/70" onClick={() => void window.api.openExternal("https://talkdedsec.com")}>talkdedsec.com</button>
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
