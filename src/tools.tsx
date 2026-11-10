import { ArrowRight, FolderOpen, KeyRound, Lock, RefreshCw, Search, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { TEXT } from "../shared/texts.ts";
import type { HistoryEntry, InstalledApp, Leftover, Metrics, StartupItem } from "../shared/types.ts";
import { fmt } from "./i18n.ts";
import { Chip } from "./pages.tsx";
import { useApp } from "./state.tsx";
import { Badge, Button, cx, PageHeader, Spinner, Switch, Toast, useArmed } from "./ui.tsx";

type Tab = "startup" | "apps" | "history";

/** Loads a list once and again on demand; `rows` is null while the first load runs. */
function useList<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await load());
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [load]);
  useEffect(() => void refresh(), [refresh]);
  return { rows, busy, refresh, setRows };
}

const Panel = ({ rows, empty, children }: { rows: unknown[] | null; empty: string; children: ReactNode }) =>
  rows === null ? (
    <div className="grid place-items-center py-20"><Spinner className="size-5" /></div>
  ) : rows.length === 0 ? (
    <div className="glass px-6 py-12 text-center text-[13px] text-white/40">{empty}</div>
  ) : (
    <div className="glass divide-y divide-white/[0.06] overflow-hidden">{children}</div>
  );

const loadStartup = () => window.api.startup.list();
function Startup() {
  const { d, info } = useApp();
  const { rows, setRows } = useList<StartupItem>(loadStartup);
  const toggle = async (item: StartupItem, enabled: boolean) => {
    if (await window.api.startup.set(item.id, enabled)) setRows((r) => r && r.map((x) => (x.id === item.id ? { ...x, enabled } : x)));
  };
  return (
    <>
      <p className="mb-4 max-w-[640px] text-[12px] leading-relaxed text-white/40">{d.tools.startupHint}</p>
      <Panel rows={rows} empty={d.tools.empty}>
        {rows?.map((item) => {
          const locked = item.scope === "machine" && !info.elevated;
          return (
            <div key={item.id} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium tracking-[-0.01em]">{item.name}</span>
                  <Badge>{item.scope === "user" ? d.tools.scopeUser : d.tools.scopeMachine}</Badge>
                  {locked && <Badge tone="outline"><Lock className="mr-1 size-2.5" />{d.tools.needsAdmin}</Badge>}
                </div>
                <p className="mt-1 truncate text-[12px] text-white/35" title={item.command}>{item.command}</p>
              </div>
              <div className={cx(locked && "pointer-events-none opacity-40")}>
                <Switch checked={item.enabled} onChange={(v) => void toggle(item, v)} label={item.name} />
              </div>
            </div>
          );
        })}
      </Panel>
    </>
  );
}

function UninstallButton({ label, busy, onRun }: { label: string; busy: boolean; onRun: () => void }) {
  const { d } = useApp();
  const [armed, arm] = useArmed();
  return (
    <Button size="sm" variant={armed ? "danger" : "secondary"} disabled={busy} onClick={() => arm(onRun)} aria-label={label}>
      {busy ? <Spinner /> : <Trash2 />}{armed ? d.common.confirmAgain : d.tools.uninstall}
    </Button>
  );
}

const loadApps = () => window.api.apps.list();
function Apps() {
  const { d } = useApp();
  const { rows, busy, refresh, setRows } = useList<InstalledApp>(loadApps);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<InstalledApp["kind"] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [left, setLeft] = useState<{ name: string; items: Leftover[]; picked: Set<string> } | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((a) => (!kind || a.kind === kind) && (!q || a.name.toLowerCase().includes(q) || a.publisher.toLowerCase().includes(q)));
  }, [rows, query, kind]);

  const uninstall = async (app: InstalledApp) => {
    setWorking(app.id);
    setNote(null);
    try {
      const r = await window.api.apps.uninstall(app.id);
      if (!r.ok) return setNote(r.error === "still-installed" ? d.tools.stillInstalled : fmt(d.tools.uninstallFailed, { error: r.error ?? "?" }));
      setRows((list) => list && list.filter((x) => x.id !== app.id));
      setNote(fmt(d.tools.uninstalled, { name: app.name }));
      if (r.leftovers.length) setLeft({ name: app.name, items: r.leftovers, picked: new Set(r.leftovers.map((l) => l.id)) });
    } finally {
      setWorking(null);
    }
  };
  const removeLeft = async () => {
    if (!left) return;
    const count = await window.api.apps.removeLeftovers([...left.picked]);
    setLeft(null);
    setNote(fmt(d.tools.leftoversRemoved, { count }));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.tools.search}
            aria-label={d.tools.search}
            className="no-drag h-10 w-full select-text rounded-full border border-white/[0.12] bg-white/[0.05] pl-11 pr-4 text-[13px] text-white outline-none backdrop-blur-xl transition-colors placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.08]"
          />
        </div>
        <Chip active={kind === null} onClick={() => setKind(null)}>{d.common.all}</Chip>
        <Chip active={kind === "program"} onClick={() => setKind("program")}>{d.tools.kindProgram}</Chip>
        <Chip active={kind === "store"} onClick={() => setKind("store")}>{d.tools.kindStore}</Chip>
        <Button size="sm" disabled={busy} onClick={() => void refresh()}>{busy ? <Spinner /> : <RefreshCw />}{d.tools.refresh}</Button>
      </div>

      {left && (
        <div className="glass mb-4 px-6 py-5">
          <div className="text-[13px] font-medium">{fmt(d.tools.leftoversTitle, { name: left.name })}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/40">{d.tools.leftoversHint}</p>
          <div className="mt-3 space-y-1.5">
            {left.items.map((l) => (
              <label key={l.id} className="no-drag flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.04]">
                <input
                  type="checkbox"
                  className="size-3.5 accent-white"
                  checked={left.picked.has(l.id)}
                  onChange={(e) => {
                    const picked = new Set(left.picked);
                    if (e.target.checked) picked.add(l.id); else picked.delete(l.id);
                    setLeft({ ...left, picked });
                  }}
                />
                {l.kind === "folder" ? <FolderOpen className="size-3.5 shrink-0 text-white/40" /> : <KeyRound className="size-3.5 shrink-0 text-white/40" />}
                <span className="min-w-0 flex-1 truncate" title={l.path}>{l.path}</span>
                {l.kind === "folder" && <span className="shrink-0 text-white/35">{l.sizeMb} MB</span>}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setLeft(null)}>{d.tools.keep}</Button>
            <Button size="sm" variant="danger" disabled={left.picked.size === 0} onClick={() => void removeLeft()}><Trash2 />{d.tools.removeSelected}</Button>
          </div>
        </div>
      )}

      {kind === "store" && <p className="mb-3 text-[12px] text-white/40">{d.tools.storeWarn}</p>}
      <Panel rows={rows && shown} empty={d.tools.empty}>
        {shown.map((app) => (
          <div key={app.id} className="flex items-center gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[13px] font-medium tracking-[-0.01em]">{app.name}</span>
                {app.kind === "store" && <Badge>{d.tools.kindStore}</Badge>}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-white/35">
                {[app.publisher, app.version, app.sizeMb > 0 ? `${app.sizeMb} MB` : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
            <UninstallButton label={`${d.tools.uninstall}: ${app.name}`} busy={working === app.id} onRun={() => void uninstall(app)} />
          </div>
        ))}
      </Panel>
      {note && <Toast>{note}</Toast>}
    </>
  );
}

function Delta({ label, unit, before, after, lowerIsBetter }: { label: string; unit?: string; before: number; after: number; lowerIsBetter?: boolean }) {
  const diff = after - before;
  const good = diff !== 0 && diff < 0 === !!lowerIsBetter;
  return (
    <div className="min-w-[120px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-white/55">
        <span>{before}</span><ArrowRight className="size-3 text-white/25" /><span className="text-white">{after}{unit}</span>
        {diff !== 0 && <span className={good ? "text-white/80" : "text-white/35"}>({diff > 0 ? "+" : ""}{diff})</span>}
      </div>
    </div>
  );
}
const metricRows = (d: ReturnType<typeof useApp>["d"], b: Metrics, a: Metrics) => (
  <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
    <Delta label={d.tools.mRam} unit=" MB" before={b.freeRamMb} after={a.freeRamMb} />
    <Delta label={d.tools.mProc} before={b.processes} after={a.processes} lowerIsBetter />
    <Delta label={d.tools.mSvc} before={b.services} after={a.services} lowerIsBetter />
  </div>
);

const loadHistory = () => window.api.history.list();
function HistoryList() {
  const { d, lang } = useApp();
  const { rows, setRows } = useList<HistoryEntry>(loadHistory);
  const when = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }), [lang]);
  return (
    <>
      {!!rows?.length && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => void window.api.history.clear().then(() => setRows([]))}><Trash2 />{d.tools.clear}</Button>
        </div>
      )}
      <Panel rows={rows} empty={d.tools.historyEmpty}>
        {rows?.map((e) => (
          <div key={e.at} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium tracking-[-0.01em]">{fmt(e.action === "apply" ? d.tools.applied : d.tools.reverted, { count: e.applied })}</span>
              <span className="text-[12px] text-white/35">{when.format(new Date(e.at))}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/40">{e.ids.map((id) => TEXT[id]?.[lang][0] ?? id).join(" · ")}</p>
            {e.before && e.after && metricRows(d, e.before, e.after)}
          </div>
        ))}
      </Panel>
    </>
  );
}

export function Tools() {
  const { d } = useApp();
  const [tab, setTab] = useState<Tab>("startup");
  return (
    <>
      <PageHeader title={d.nav.tools} subtitle={d.tools.subtitle} />
      <div className="mb-5 flex gap-2">
        <Chip active={tab === "startup"} onClick={() => setTab("startup")}>{d.tools.tabStartup}</Chip>
        <Chip active={tab === "apps"} onClick={() => setTab("apps")}>{d.tools.tabApps}</Chip>
        <Chip active={tab === "history"} onClick={() => setTab("history")}>{d.tools.tabHistory}</Chip>
      </div>
      {tab === "startup" && <Startup />}
      {tab === "apps" && <Apps />}
      {tab === "history" && <HistoryList />}
    </>
  );
}
