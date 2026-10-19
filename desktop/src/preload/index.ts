import { contextBridge, ipcRenderer } from "electron";

const api = {
  login: (): Promise<void> => ipcRenderer.invoke("login"),
  cancelLogin: (): Promise<void> => ipcRenderer.invoke("cancel-login"),
  logout: (): Promise<void> => ipcRenderer.invoke("logout"),
  getSession: (): Promise<Session | null> => ipcRenderer.invoke("get-session"),
  onSessionChanged: (callback: (event: SessionEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: SessionEvent) => callback(value);
    ipcRenderer.on("session-changed", listener);
    return () => ipcRenderer.removeListener("session-changed", listener);
  },
  getVrApp: (): Promise<string | null> => ipcRenderer.invoke("get-vr-app"),
  chooseVrApp: (): Promise<string | null> => ipcRenderer.invoke("choose-vr-app"),
  launchVrApp: (): Promise<void> => ipcRenderer.invoke("launch-vr-app"),
  getSyncStatus: (): Promise<SyncStatus> => ipcRenderer.invoke("get-sync-status"),
  syncResults: (): Promise<void> => ipcRenderer.invoke("sync-results"),
  onSyncStatus: (callback: (status: SyncStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: SyncStatus) => callback(value);
    ipcRenderer.on("sync-status", listener);
    return () => ipcRenderer.removeListener("sync-status", listener);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type Session = { userId: string; email: string; isLoggedIn: true };
export type SyncStatus = { pending: number; syncing: boolean; lastUploadedAt: string | null; error?: string };
export type SessionEvent = { session: Session | null; error?: string };
export type DesktopApi = typeof api;
