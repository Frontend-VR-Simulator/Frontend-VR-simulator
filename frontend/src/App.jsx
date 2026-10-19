import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import AcceptInvite from "./pages/AcceptInvite.jsx";
import Workspace from "./pages/Workspace.jsx";
import { AppContext } from "./lib/context";
import { createApi, errorMessage } from "./lib/api";
import { buildModel, ROLE_VIEW } from "./lib/model";
import { goto, useHashRoute } from "./lib/router";

const AUTH_KEY = "vr-auth";
const REFRESH_MS = 30_000;

function loadAuth() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const value = JSON.parse(storage.getItem(AUTH_KEY));
      if (value?.token) return value;
    } catch { /* Ignore unreadable storage. */ }
  }
  return null;
}

function storeAuth(value, remember) {
  try {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
    if (value) (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, JSON.stringify(value));
  } catch { /* Storage disabled: the session lasts for this page only. */ }
}

const params = new URLSearchParams(window.location.search);
const inviteToken = params.get("invite");
// The desktop launcher opens /?redirect_uri=...&state=... (older builds: /login?...) in the system browser.
const desktopLogin = params.has("redirect_uri");
// Pages are hash routes, so any other path (an old bookmark such as /admin/register, or
// /login) is reset to "/", keeping the query the invite and desktop sign-in still need.
if (window.location.pathname !== "/") {
  const hash = window.location.hash || (window.location.pathname === "/login" && !desktopLogin ? "#/login" : "");
  window.history.replaceState({}, "", `/${window.location.search}${hash}`);
}

export default function App() {
  const [auth, setAuth] = useState(loadAuth);
  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef(null);
  const route = useHashRoute();

  const toast = useCallback((message) => {
    setToastMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(""), 4000);
  }, []);

  const logout = useCallback(() => {
    storeAuth(null);
    setAuth(null);
    setWorkspace(null);
    goto("login");
  }, []);

  const login = useCallback((value, remember) => {
    storeAuth(value, remember);
    setAuth(value);
    goto(`${ROLE_VIEW[value.role] || "learner"}/overview`);
    toast("Signed in. Welcome back.");
  }, [toast]);

  const api = useMemo(() => (auth ? createApi(auth.token, logout) : null), [auth, logout]);

  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const response = await api.get("/vr/workspace");
      setWorkspace(response.data);
      setLoadError("");
    } catch (error) {
      if (error.response?.status !== 401) setLoadError(errorMessage(error, "Could not load your workspace."));
    }
  }, [api]);

  // New VR results arrive from the launcher at any time, so the workspace refreshes
  // while the tab is visible and whenever it regains focus.
  useEffect(() => {
    if (!api) return undefined;
    let active = true;
    const fetchWorkspace = () => api.get("/vr/workspace")
      .then((response) => { if (active) { setWorkspace(response.data); setLoadError(""); } })
      .catch((error) => { if (active && error.response?.status !== 401) setLoadError(errorMessage(error, "Could not load your workspace.")); });
    const refreshIfVisible = () => { if (document.visibilityState === "visible") fetchWorkspace(); };
    fetchWorkspace();
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [api]);

  const model = useMemo(() => (workspace ? buildModel(workspace) : null), [workspace]);
  const view = model ? ROLE_VIEW[model.me.role] : auth ? ROLE_VIEW[auth.role] : null;
  const [first, second] = route.parts;

  // Route guards: public pages are open; workspace pages need a session and the user's own workspace.
  let redirect = null;
  if (!desktopLogin && !(inviteToken && !auth)) {
    if (!first) redirect = auth ? `${view}/overview` : "landing";
    else if (first === "login" && auth) redirect = `${view}/overview`;
    else if (first !== "landing" && first !== "login" && !auth) redirect = "login";
    else if (auth && view && !["session", "landing", "login", view].includes(first)) redirect = `${view}/${second || "overview"}`;
  }
  useEffect(() => { if (redirect) goto(redirect); }, [redirect]);

  useEffect(() => {
    const titles = { landing: "SIMQO | Practice. Prove. Progress.", login: "Sign in | SIMQO", session: "Session review | SIMQO" };
    document.title = titles[first || "landing"] || `${second || "overview"} | SIMQO`;
  }, [first, second]);

  const context = useMemo(() => ({ auth, model, api, reload, toast, logout, view }), [auth, model, api, reload, toast, logout, view]);

  let page;
  if (inviteToken && !auth) page = <AcceptInvite token={inviteToken} />;
  else if (desktopLogin) page = <Login onLogin={login} />;
  else if (redirect) page = null;
  else if (first === "landing") page = <Landing signedIn={Boolean(auth)} />;
  else if (first === "login") page = <Login onLogin={login} />;
  else if (loadError && !model) page = <div className="load-state"><p>{loadError}</p><div className="flex gap8"><button className="btn primary" onClick={reload}>Try again</button><button className="btn ghost" onClick={logout}>Sign out</button></div></div>;
  else if (!model) page = <div className="load-state"><p className="muted">Loading your workspace…</p></div>;
  else page = <Workspace route={route} />;

  return <AppContext.Provider value={context}>
    {page}
    <div id="toast" aria-live="polite" aria-atomic="true">{toastMessage && <div className="notice">{toastMessage}</div>}</div>
  </AppContext.Provider>;
}
