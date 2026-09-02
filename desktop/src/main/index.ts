import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { access, chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";

type StoredSession = { userId: string; email: string; accessToken: string };
type PublicSession = { userId: string; email: string; isLoggedIn: true };
type Settings = { vrExecutablePath?: string };

const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const API_URL = process.env.API_URL ?? "http://localhost:8000/api/v1/user";
const AUTH_TIMEOUT_MS = 120_000;

let mainWindow: BrowserWindow | null = null;
let session: StoredSession | null = null;
let pendingServer: Server | null = null;
let pendingTimer: NodeJS.Timeout | null = null;
let vrProcess: ChildProcess | null = null;

app.setName("VR Simulation Launcher");

const userDataPath = () => app.getPath("userData");
const encryptedSessionPath = () => path.join(userDataPath(), "session.enc");
const ueSessionPath = () => process.env.VR_SESSION_PATH ?? path.join(userDataPath(), "ue-session.json");
const settingsPath = () => path.join(userDataPath(), "settings.json");

function publicSession(): PublicSession | null {
  return session ? { userId: session.userId, email: session.email, isLoggedIn: true } : null;
}

function notifySession(error?: string) {
  mainWindow?.webContents.send("session-changed", { session: publicSession(), error });
}

async function atomicWrite(filePath: string, data: string | Buffer) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, data, { mode: 0o600 });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600).catch(() => undefined);
}

async function loadSettings(): Promise<Settings> {
  try {
    return JSON.parse(await readFile(settingsPath(), "utf8")) as Settings;
  } catch {
    return {};
  }
}

async function saveSettings(settings: Settings) {
  await atomicWrite(settingsPath(), JSON.stringify(settings, null, 2));
}

async function persistSession(value: StoredSession) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure OS storage is not available.");
  await atomicWrite(encryptedSessionPath(), safeStorage.encryptString(JSON.stringify(value)));
  await atomicWrite(ueSessionPath(), JSON.stringify({
    userId: value.userId,
    accessToken: value.accessToken,
    isLoggedIn: true,
  }, null, 2));
}

async function restoreSession() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    const encrypted = await readFile(encryptedSessionPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted)) as StoredSession;
    if (!parsed.userId || !parsed.email || !parsed.accessToken) throw new Error("Invalid session");
    session = parsed;
    await persistSession(parsed);
  } catch {
    session = null;
    await Promise.all([
      rm(encryptedSessionPath(), { force: true }),
      rm(ueSessionPath(), { force: true }),
    ]);
  }
}

function cancelPendingLogin(message?: string) {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  pendingServer?.close();
  pendingServer = null;
  if (message) notifySession(message);
}

async function launchVrApp() {
  const settings = await loadSettings();
  if (!settings.vrExecutablePath) throw new Error("Choose the installed VR application first.");
  if (!session) throw new Error("Sign in before launching the VR application.");
  if (vrProcess && vrProcess.exitCode === null && !vrProcess.killed) {
    return;
  }
  await access(settings.vrExecutablePath);
  const child = spawn(settings.vrExecutablePath, [`-AuthSessionPath=${ueSessionPath()}`], {
    cwd: path.dirname(settings.vrExecutablePath),
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  vrProcess = child;
  child.once("exit", () => {
    if (vrProcess === child) vrProcess = null;
    if (BrowserWindow.getAllWindows().length === 0) app.quit();
  });
  child.unref();
}

async function stopVrApp() {
  const child = vrProcess;
  vrProcess = null;
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore",
    });
    await new Promise<void>((resolve) => {
      killer.once("close", () => resolve());
      killer.once("error", () => resolve());
    });
  } else {
    child.kill();
  }
}

async function exchangeCode(code: string): Promise<StoredSession> {
  const response = await fetch(`${API_URL}/desktop-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Code exchange failed.");
  const value = await response.json() as StoredSession;
  if (!value.userId || !value.email || !value.accessToken) throw new Error("The server returned an invalid session.");
  return value;
}

async function startLogin() {
  cancelPendingLogin();
  const state = randomBytes(32).toString("base64url");

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET" || url.pathname !== "/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    const returnedState = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (returnedState !== state || !code) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Invalid sign-in callback. Return to the app and try again.");
      cancelPendingLogin("The browser returned an invalid authentication state.");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end("<!doctype html><meta name=viewport content='width=device-width'><style>body{font:16px system-ui;background:#09090b;color:#fafafa;display:grid;place-items:center;height:100vh;margin:0}main{padding:32px;text-align:center}</style><main><h1>Signed in</h1><p>You can close this tab and return to the app.</p></main>");
    cancelPendingLogin();
    try {
      session = await exchangeCode(code);
      await persistSession(session);
      notifySession();
      try {
        await launchVrApp();
      } catch (error) {
        notifySession(error instanceof Error ? `Signed in, but the VR application could not start: ${error.message}` : "Signed in, but the VR application could not start.");
      }
    } catch (error) {
      session = null;
      await Promise.all([rm(encryptedSessionPath(), { force: true }), rm(ueSessionPath(), { force: true })]);
      notifySession(error instanceof Error ? error.message : "Sign-in failed.");
    }
  });

  pendingServer = server;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the sign-in callback.");
  pendingTimer = setTimeout(() => cancelPendingLogin("Sign-in timed out. Please try again."), AUTH_TIMEOUT_MS);
  const loginUrl = new URL("/login", WEB_URL);
  loginUrl.searchParams.set("redirect_uri", `http://127.0.0.1:${address.port}/callback`);
  loginUrl.searchParams.set("state", state);
  await shell.openExternal(loginUrl.toString());
}

function registerIpc() {
  ipcMain.handle("login", startLogin);
  ipcMain.handle("cancel-login", () => cancelPendingLogin("Sign-in cancelled."));
  ipcMain.handle("get-session", () => publicSession());
  ipcMain.handle("logout", async () => {
    cancelPendingLogin();
    await stopVrApp();
    session = null;
    await Promise.all([rm(encryptedSessionPath(), { force: true }), rm(ueSessionPath(), { force: true })]);
    notifySession();
  });
  ipcMain.handle("get-vr-app", async () => (await loadSettings()).vrExecutablePath ?? null);
  ipcMain.handle("choose-vr-app", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Choose the installed VR simulation",
      properties: ["openFile"],
      filters: process.platform === "win32" ? [{ name: "Applications", extensions: ["exe"] }] : undefined,
    });
    if (result.canceled || !result.filePaths[0]) return null;
    await saveSettings({ vrExecutablePath: result.filePaths[0] });
    return result.filePaths[0];
  });
  ipcMain.handle("launch-vr-app", launchVrApp);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 620,
    minWidth: 460,
    minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  await restoreSession();
  registerIpc();
  createWindow();
  if (session) {
    mainWindow?.webContents.once("did-finish-load", async () => {
      try {
        await launchVrApp();
      } catch (error) {
        notifySession(
          error instanceof Error
            ? `Your session was restored, but the VR application could not start: ${error.message}`
            : "Your session was restored, but the VR application could not start.",
        );
      }
    });
  }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  // Remain alive while VR runs so a reopened launcher can log out and stop it.
  if (process.platform !== "darwin" && !vrProcess) app.quit();
});
app.on("before-quit", () => cancelPendingLogin());
