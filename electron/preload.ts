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
