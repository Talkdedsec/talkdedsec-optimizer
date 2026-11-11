import { contextBridge, ipcRenderer } from "electron";
import type { Api } from "../shared/types.ts";

const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api: Api = {
  info: call("info"),
  settings: { read: call("settings:read"), write: call("settings:write") },
  scan: call("scan"),
  applied: call("applied"),
  apply: call("apply"),
  revert: call("revert"),
  flushRam: call("flushRam"),
  deepClean: call("deepClean"),
  restorePoint: call("restorePoint"),
  restartWindows: call("restartWindows"),
  openExternal: call("openExternal"),
  startup: { list: call("startup:list"), set: call("startup:set") },
  apps: { list: call("apps:list"), uninstall: call("apps:uninstall"), removeLeftovers: call("apps:removeLeftovers") },
  history: { list: call("history:list"), clear: call("history:clear") },
  focus: { status: call("focus:status") },
  profile: { export: call("profile:export"), import: call("profile:import") },
  update: { check: call("update:check"), install: call("update:install") },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    close: () => ipcRenderer.send("window:close"),
    onMaximize: (cb) => {
      const listener = (_e: unknown, maximized: boolean) => cb(maximized);
      ipcRenderer.on("window:maximized", listener);
      return () => ipcRenderer.removeListener("window:maximized", listener);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);
