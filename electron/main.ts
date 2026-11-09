import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import type { AppInfo, BackupEntry, RunResult, Settings, Tweak, TweakResult } from "../shared/types.ts";
import { analyze, applyScript, BY_ID, revertScript } from "./engine.ts";
import { deepClean, flushRam, isElevated, restorePoint, runJson, scanHardware } from "./ps.ts";

type Backups = Record<string, { appliedAt: string; entries: BackupEntry[] }>;
type RawResult = { id: string; ok: boolean; error?: string; skipped?: boolean; previous?: BackupEntry[] | BackupEntry };

const DEFAULTS: Settings = { lang: "tr", createRestorePoint: true, lastScan: null };
const userFile = (name: string) => join(app.getPath("userData"), name);

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return { ...fallback, ...JSON.parse(await readFile(userFile(name), "utf8")) };
  } catch {
    return fallback;
  }
}
// Write-then-rename: a crash mid-write must not leave a truncated backups.json, it is the only undo record.
async function writeJson(name: string, value: unknown) {
  const file = userFile(name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2), "utf8");
  await rename(`${file}.tmp`, file);
}
const readSettings = () => readJson("settings.json", DEFAULTS);
const readBackups = () => readJson<Backups>("backups.json", {});

const list = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);
const timeoutFor = (tweaks: Tweak[]) =>
  tweaks.some((t) => t.id === "clean.repair-system-files") ? 45 * 60_000 : Math.max(120_000, tweaks.length * 8_000);

let elevated: Promise<boolean> | null = null;
const getElevated = () => (elevated ??= isElevated());

function summarize(results: TweakResult[], started: number, restorePointMade: boolean): RunResult {
  return {
    results,
    applied: results.filter((r) => r.ok && !r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    totalMs: Date.now() - started,
    restorePoint: restorePointMade,
    requiresRestart: results.some((r) => r.ok && !r.skipped && BY_ID.get(r.id)?.requiresRestart),
  };
}

async function apply(ids: string[]): Promise<RunResult> {
  const started = Date.now();
  const tweaks = [...new Set(ids)].map((id) => BY_ID.get(id)).filter((t): t is Tweak => !!t);
  const admin = await getElevated();
  const runnable = tweaks.filter((t) => admin || !t.elevated);
  if (runnable.length === 0) return summarize(tweaks.map((t) => ({ id: t.id, ok: false, error: "needs-admin" })), started, false);

  const made = admin && (await readSettings()).createRestorePoint ? await restorePoint() : false;
  const raw = new Map(list(await runJson<RawResult[]>(applyScript(runnable), timeoutFor(runnable))).map((r) => [r.id, r]));
  const backups = await readBackups();
  const halfDone: { tweak: Tweak; entries: BackupEntry[] }[] = [];

  const results = tweaks.map((t): TweakResult => {
    if (!runnable.includes(t)) return { id: t.id, ok: false, error: "needs-admin" };
    const r = raw.get(t.id);
    if (!r) return { id: t.id, ok: false, error: "no-result" };
    const entries = list(r.previous);
    if (!r.ok && entries.length) halfDone.push({ tweak: t, entries });
    // Keep the oldest backup: re-applying must not overwrite the original values with our own.
    if (r.ok && t.reversible && entries.length && !backups[t.id]) backups[t.id] = { appliedAt: new Date().toISOString(), entries };
    return { id: t.id, ok: r.ok, error: r.error || undefined, skipped: r.skipped || undefined };
  });

  await writeJson("backups.json", backups);
  // A tweak that failed midway has already changed something; put those parts back so nothing is left half-applied.
  if (halfDone.length) await runJson(revertScript(halfDone), timeoutFor([]));
  return summarize(results, started, made);
}

async function revert(ids: string[]): Promise<RunResult> {
  const started = Date.now();
  const backups = await readBackups();
  const items = ids.flatMap((id) => {
    const tweak = BY_ID.get(id);
    return tweak && backups[id] ? [{ tweak, entries: backups[id].entries }] : [];
  });
  const raw = new Map(
    (items.length ? list(await runJson<RawResult[]>(revertScript(items), timeoutFor([]))) : []).map((r) => [r.id, r]),
  );
  const results = ids.map((id): TweakResult => {
    if (!backups[id]) return { id, ok: false, error: "no-backup" };
    const r = raw.get(id);
    if (!r) return { id, ok: false, error: "no-result" };
    if (r.ok) delete backups[id];
    return { id, ok: r.ok, error: r.error || undefined };
  });
  await writeJson("backups.json", backups);
  return summarize(results, started, false);
}

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: "#000000",
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once("ready-to-show", () => win?.show());
  const sendMax = () => win?.webContents.send("window:maximized", win.isMaximized());
  win.on("maximize", sendMax);
  win.on("unmaximize", sendMax);
  // The renderer only ever shows our own page; anything else opens in the browser or is dropped.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  if (process.env.VITE_DEV_SERVER_URL) void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void win.loadFile(join(__dirname, "../dist/index.html"));
}

function registerIpc() {
  ipcMain.handle("info", async (): Promise<AppInfo> => ({ version: app.getVersion(), elevated: await getElevated() }));
  ipcMain.handle("settings:read", readSettings);
  ipcMain.handle("settings:write", async (_e, patch: Partial<Settings>) => {
    const next = { ...(await readSettings()), ...patch };
    await writeJson("settings.json", next);
    return next;
  });
  ipcMain.handle("scan", async () => {
    const result = analyze(await scanHardware());
    await writeJson("settings.json", { ...(await readSettings()), lastScan: result });
    return result;
  });
  ipcMain.handle("applied", async () => Object.keys(await readBackups()));
  ipcMain.handle("apply", (_e, ids: string[]) => apply(list(ids).map(String)));
  ipcMain.handle("revert", (_e, ids: string[]) => revert(list(ids).map(String)));
  ipcMain.handle("flushRam", flushRam);
  ipcMain.handle("deepClean", deepClean);
  ipcMain.handle("restorePoint", restorePoint);
  // No /f: an app with unsaved work can still hold the restart.
  ipcMain.handle("restartWindows", () => void spawn("shutdown.exe", ["/r", "/t", "5"], { detached: true, stdio: "ignore" }).unref());
  ipcMain.handle("openExternal", (_e, url: string) => (String(url).startsWith("https://") ? shell.openExternal(url) : undefined));
  ipcMain.on("window:minimize", () => win?.minimize());
  ipcMain.on("window:toggle-maximize", () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
  ipcMain.on("window:close", () => win?.close());
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });
  app.on("window-all-closed", () => app.quit());
  void app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    registerIpc();
    createWindow();
  });
}
