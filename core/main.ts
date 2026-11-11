import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, net, shell, Tray } from "electron";
import logo from "../src/assets/logo.png?inline";
import type { AppInfo, BackupEntry, HistoryEntry, Leftover, Metrics, RunResult, Settings, Tweak, TweakResult, UpdateInfo } from "../shared/types.ts";
import { analyze, applyScript, BY_ID, revertScript } from "./engine.ts";
import { cleanNames, focusStatus, setFocus } from "./focus.ts";
import { deepClean, flushRam, isElevated, restorePoint, runJson, scanHardware } from "./ps.ts";
import { isAppId, isNewer, listApps, listStartup, measure, removeLeftovers, setStartup, uninstallApp } from "./tools.ts";

type Backups = Record<string, { appliedAt: string; entries: BackupEntry[] }>;
type RawResult = { id: string; ok: boolean; error?: string; skipped?: boolean; previous?: BackupEntry[] | BackupEntry };

type History = { entries: HistoryEntry[] };
const REPO = "Talkdedsec/talkdedsec-optimizer";

const DEFAULTS: Settings = { lang: "tr", createRestorePoint: true, checkUpdates: true, lastScan: null, focus: { enabled: false, freeze: [], skip: [] } };
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

/** Logs a run that changed something, with the machine's numbers before and after it. */
async function record(action: HistoryEntry["action"], run: RunResult, before: Metrics | null): Promise<RunResult> {
  const ids = run.results.filter((r) => r.ok && !r.skipped).map((r) => r.id);
  if (ids.length) {
    const { entries } = await readJson<History>("history.json", { entries: [] });
    entries.unshift({ at: new Date().toISOString(), action, ids, applied: ids.length, failed: run.failed, before, after: await measure() });
    await writeJson("history.json", { entries: entries.slice(0, 200) });
  }
  return run;
}

async function apply(ids: string[]): Promise<RunResult> {
  const started = Date.now();
  const tweaks = [...new Set(ids)].map((id) => BY_ID.get(id)).filter((t): t is Tweak => !!t);
  const admin = await getElevated();
  const runnable = tweaks.filter((t) => admin || !t.elevated);
  if (runnable.length === 0) return summarize(tweaks.map((t) => ({ id: t.id, ok: false, error: "needs-admin" })), started, false);

  const before = await measure();
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
  return record("apply", summarize(results, started, made), before);
}

async function revert(ids: string[]): Promise<RunResult> {
  const started = Date.now();
  const backups = await readBackups();
  const items = ids.flatMap((id) => {
    const tweak = BY_ID.get(id);
    return tweak && backups[id] ? [{ tweak, entries: backups[id].entries }] : [];
  });
  const before = items.length ? await measure() : null;
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
  return record("revert", summarize(results, started, false), before);
}

let pendingUpdate: { url: string; sha256: string; name: string } | null = null;

// The only network request the app makes. It carries no user data; the setting turns it off.
async function checkUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const rel = (await res.json()) as { tag_name?: string; assets?: { name: string; digest?: string; browser_download_url: string }[] };
    const version = String(rel.tag_name ?? "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+$/.test(version) || !isNewer(version, app.getVersion())) return null;
    const asset = (rel.assets ?? []).find(
      (a) => /^Talkdedsec-Setup-[\d.]+\.exe$/.test(a.name) && /^sha256:[0-9a-f]{64}$/.test(a.digest ?? "") &&
        a.browser_download_url.startsWith(`https://github.com/${REPO}/releases/download/`),
    );
    // The portable build has no installation to update; it gets the release page instead.
    pendingUpdate = asset && !process.env.PORTABLE_EXECUTABLE_DIR ? { url: asset.browser_download_url, sha256: asset.digest!.slice(7), name: asset.name } : null;
    return { version, url: `https://github.com/${REPO}/releases/tag/v${version}`, canInstall: !!pendingUpdate };
  } catch {
    return null;
  }
}

async function installUpdate(): Promise<boolean> {
  if (!pendingUpdate) return false;
  try {
    const res = await net.fetch(pendingUpdate.url);
    if (!res.ok) return false;
    const data = Buffer.from(await res.arrayBuffer());
    // The installer is unsigned, so the digest GitHub recorded at upload is the integrity check.
    if (createHash("sha256").update(data).digest("hex") !== pendingUpdate.sha256) return false;
    const file = userFile(join("update", pendingUpdate.name));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    if (await shell.openPath(file)) return false;
    app.quit();
    return true;
  } catch {
    return false;
  }
}

async function exportProfile(): Promise<boolean> {
  const { filePath } = await dialog.showSaveDialog(win!, { defaultPath: "talkdedsec-profile.json", filters: [{ name: "JSON", extensions: ["json"] }] });
  if (!filePath) return false;
  await writeFile(filePath, JSON.stringify({ app: "talkdedsec", version: 1, tweaks: Object.keys(await readBackups()) }, null, 2), "utf8");
  return true;
}

async function importProfile(): Promise<string[] | null> {
  const { filePaths } = await dialog.showOpenDialog(win!, { properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
  if (!filePaths[0]) return null;
  try {
    const data = JSON.parse(await readFile(filePaths[0], "utf8")) as { app?: string; tweaks?: unknown };
    if (data.app !== "talkdedsec" || !Array.isArray(data.tweaks)) return [];
    // Only ids from our own catalog: the file decides which tweaks, never what they do.
    return data.tweaks.map(String).filter((id) => BY_ID.has(id));
  } catch {
    return []; // unreadable: the renderer reports it; null is reserved for a cancelled dialog
  }
}

let leftovers = new Map<string, Leftover>();
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
// Our own mark for the window and the tray, so an unpackaged run does not show the runtime's icon either.
const ICON = nativeImage.createFromDataURL(logo);

const showWindow = () => {
  if (win?.isMinimized()) win.restore();
  win?.show();
  win?.focus();
};

/** Starts or stops the watcher to match the settings. While it runs the app lives in the tray, so closing the window does not end it. */
async function syncFocus(s: Settings) {
  if (s.focus.enabled && !tray) {
    tray = new Tray(ICON.resize({ width: 32, height: 32 }));
    tray.setToolTip("Talkdedsec");
    tray.on("click", showWindow);
  }
  if (!s.focus.enabled && tray) {
    tray.destroy();
    tray = null;
  }
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: s.lang === "tr" ? "Göster" : "Show", click: showWindow },
    { label: s.lang === "tr" ? "Çıkış" : "Quit", click: () => app.quit() },
  ]));
  await setFocus(s.focus);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: "#000000",
    icon: ICON,
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once("ready-to-show", () => win?.show());
  win.on("close", (e) => {
    if (!tray || quitting) return;
    e.preventDefault();
    win?.hide();
  });
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
    // The names end up in a script: keep only what looks like a process name.
    if (patch.focus) next.focus = { enabled: patch.focus.enabled === true, freeze: cleanNames(patch.focus.freeze), skip: cleanNames(patch.focus.skip) };
    await writeJson("settings.json", next);
    if (patch.focus || patch.lang) await syncFocus(next);
    return next;
  });
  ipcMain.handle("focus:status", focusStatus);
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
  ipcMain.handle("startup:list", listStartup);
  ipcMain.handle("startup:set", (_e, id: string, enabled: boolean) => setStartup(String(id), enabled === true));
  ipcMain.handle("apps:list", listApps);
  ipcMain.handle("apps:uninstall", async (_e, id: string) => {
    if (!isAppId(String(id))) return { ok: false, error: "bad-id", leftovers: [] };
    const result = await uninstallApp(String(id));
    // The renderer only ever names leftovers by id; the paths stay here.
    leftovers = new Map(result.leftovers.map((l) => [l.id, l]));
    return result;
  });
  ipcMain.handle("apps:removeLeftovers", (_e, ids: string[]) =>
    removeLeftovers(list(ids).map((id) => leftovers.get(String(id))).filter((l): l is Leftover => !!l), userFile("removed-keys")));
  ipcMain.handle("history:list", async () => (await readJson<History>("history.json", { entries: [] })).entries);
  ipcMain.handle("history:clear", () => writeJson("history.json", { entries: [] }));
  ipcMain.handle("profile:export", exportProfile);
  ipcMain.handle("profile:import", importProfile);
  ipcMain.handle("update:check", async () => ((await readSettings()).checkUpdates ? checkUpdate() : null));
  ipcMain.handle("update:install", installUpdate);
  ipcMain.on("window:minimize", () => win?.minimize());
  ipcMain.on("window:toggle-maximize", () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
  ipcMain.on("window:close", () => win?.close());
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", showWindow);
  app.on("window-all-closed", () => app.quit());
  // Closing the watcher's pipe makes it put every process back, also when this process dies without getting here.
  app.on("before-quit", () => {
    quitting = true;
    void setFocus(null);
  });
  void app.whenReady().then(async () => {
    nativeTheme.themeSource = "dark";
    registerIpc();
    createWindow();
    await syncFocus(await readSettings());
  });
}
