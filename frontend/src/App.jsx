
import { useCallback, useState } from "react";
import "./App.css";
import Login from "./auth/loginpage.jsx";
import AcceptInvite from "./auth/accept-invite.jsx";
import Dashboard from "./dashboard/Dashboard.jsx";

function loadAuth() {
  try { return JSON.parse(localStorage.getItem("vr-auth")) || null; }
  catch { return null; }
}

function App() {
  const [auth, setAuth] = useState(loadAuth);
  const invite = new URLSearchParams(window.location.search).get("invite");

  function login(value) {
    localStorage.setItem("vr-auth", JSON.stringify(value));
    setAuth(value);
  }

  const logout = useCallback(() => {
    localStorage.removeItem("vr-auth");
    setAuth(null);
  }, []);

  if (invite && !auth) return <AcceptInvite token={invite} />;
  if (!auth) return <Login onLogin={login} />;
  return <Dashboard auth={auth} onLogout={logout} />;
}

export default App
