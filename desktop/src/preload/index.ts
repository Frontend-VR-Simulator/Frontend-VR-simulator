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
};

contextBridge.exposeInMainWorld("api", api);

export type Session = { userId: string; email: string; isLoggedIn: true };
export type SessionEvent = { session: Session | null; error?: string };
export type DesktopApi = typeof api;
