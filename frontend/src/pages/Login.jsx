import { useState } from "react";
import axios from "axios";
import { Icon, Logo } from "../components/ui";
import { API_BASE_URL } from "../config/api";
import { COMPANY } from "../config/company";
import { errorMessage } from "../lib/api";
import { useApp } from "../lib/context";

// The desktop launcher opens /login?redirect_uri=http://127.0.0.1:<port>/callback&state=...
function readDesktopRequest() {
  const params = new URLSearchParams(window.location.search);
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  if (!redirectUri) return { redirect: null, error: "" };
  try {
    const parsed = new URL(redirectUri);
    const validHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (parsed.protocol !== "http:" || !validHost || parsed.pathname !== "/callback" || parsed.search || parsed.hash || !state) throw new Error("Invalid desktop sign-in request.");
    return { redirect: { redirectUri: parsed.toString(), state }, error: "" };
  } catch {
    return { redirect: null, error: "Invalid desktop sign-in request. Please return to the desktop app and try again." };
  }
}

export function LoginLayout({ children }) {
  return <div className="login-page">
    <div className="login-media">
      <a href="#/landing" style={{ position: "relative", zIndex: 3 }}><Logo /></a>
      <div className="login-overlay"><div className="eyebrow">IMMERSIVE TRAINING</div><h1>Real skills.<br /><span>Real impact.</span></h1><p>Explore a smarter way to develop pharmaceutical manufacturing skills and follow every step of learning.</p></div>
    </div>
    <div className="login-form-wrap">{children}</div>
  </div>;
}

export default function Login({ onLogin }) {
  const { toast } = useApp();
  const [desktopRequest] = useState(readDesktopRequest);
  const [values, setValues] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(desktopRequest.error);
  const desktopRedirect = desktopRequest.redirect;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/user/login`, { email: values.email.trim(), password: values.password });
      const auth = response.data.data;
      if (desktopRedirect) {
        const codeResponse = await axios.post(`${API_BASE_URL}/user/desktop-code`, {}, { headers: { Authorization: `Bearer ${auth.token}` } });
        const callback = new URL(desktopRedirect.redirectUri);
        callback.searchParams.set("code", codeResponse.data.code);
        callback.searchParams.set("state", desktopRedirect.state);
        window.location.assign(callback.toString());
        return;
      }
      onLogin(auth, remember);
    } catch (reason) {
      setError(reason.response ? errorMessage(reason, "Login failed. Try again later.") : "Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const field = (name) => ({
    value: values[name],
    disabled: loading,
    onChange: (event) => setValues((previous) => ({ ...previous, [name]: event.target.value })),
  });

  return <LoginLayout>
    <form className="login-box" onSubmit={submit}>
      <div><Logo /></div>
      <h2>Welcome back.</h2>
      <p>{desktopRedirect ? "Sign in to start your VR training session." : `Sign in to your ${COMPANY} training workspace.`}</p>
      {error && <div className="login-error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="email">Email address</label><input id="email" className="input" type="text" placeholder="you@company.com" autoComplete="email" required {...field("email")} /></div>
      <div className="field">
        <div className="flex-between"><label htmlFor="password">Password</label><button type="button" className="link" onClick={() => toast("Please contact your system administrator to reset your password.")}>Forgot password?</button></div>
        <div className="flex gap8"><input id="password" className="input" type={showPassword ? "text" : "password"} autoComplete="current-password" required {...field("password")} /><button type="button" className="btn ghost" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" /></button></div>
      </div>
      {!desktopRedirect && <label className="check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me on this device</label>}
      <button className="btn primary" type="submit" disabled={loading}>{loading ? "Signing in…" : <>{desktopRedirect ? "Sign in and start VR" : "Enter workspace"} <Icon name="arrow" /></>}</button>
      <div className="login-bottom"><span><Icon name="shield" className="ico-sm" /> Secure access for {COMPANY} personnel</span><div className="mt12">New to VR Pharma? <a className="link" href="#/landing">Explore the platform <Icon name="arrow" /></a></div></div>
    </form>
  </LoginLayout>;
}
