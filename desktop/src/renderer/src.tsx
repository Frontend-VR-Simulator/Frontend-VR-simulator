import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "../preload";
import "./style.css";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [vrPath, setVrPath] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([window.api.getSession(), window.api.getVrApp()]).then(([current, path]) => {
      setSession(current); setVrPath(path);
    });
    return window.api.onSessionChanged(({ session: next, error: nextError }) => {
      setSession(next); setWaiting(false); setError(nextError ?? "");
    });
  }, []);

  async function chooseVrApp() {
    setError("");
    try { setVrPath(await window.api.chooseVrApp()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not select the VR application."); }
  }

  async function login() {
    if (!vrPath) { setError("Choose the installed VR simulation first."); return; }
    setError(""); setWaiting(true);
    try { await window.api.login(); }
    catch (reason) { setWaiting(false); setError(reason instanceof Error ? reason.message : "Could not start sign-in."); }
  }

  async function run(action: () => Promise<void>) {
    setError("");
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The action failed."); }
  }

  return <main>
    <section className="card">
      <div className="logo">VR</div>
      <h1>VR Simulation Launcher</h1>
      <p className="subtitle">Sign in and launch your training environment.</p>

      {!vrPath && <div className="path-box">
        <span>One-time setup</span>
        <strong>Select the installed VR simulation application.</strong>
        <button className="secondary" onClick={chooseVrApp}>Choose application</button>
      </div>}

      {error && <div className="error" role="alert">{error}</div>}

      {session ? <div className="session">
        <div><span>Email</span><strong>{session.email}</strong></div>
        <div><span>Logged in</span><strong className="yes">true</strong></div>
        <button onClick={() => run(window.api.launchVrApp)}>Launch VR simulation</button>
        <button className="secondary" onClick={() => run(window.api.logout)}>Log out</button>
      </div> : waiting ? <div className="actions">
        <p>Waiting for browser…</p>
        <button className="secondary" onClick={() => run(window.api.cancelLogin)}>Cancel</button>
      </div> : <div className="actions">
        <button onClick={login}>Sign in</button>
        {error && <button className="link" onClick={login}>Retry</button>}
      </div>}
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
