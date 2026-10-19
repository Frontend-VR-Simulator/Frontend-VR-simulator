import { useState } from "react";
import axios from "axios";
import { Icon, Logo } from "../components/ui";
import { LoginLayout } from "./Login";
import { API_BASE_URL } from "../config/api";
import { errorMessage } from "../lib/api";

export default function AcceptInvite({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setLoading(true);
    setMessage("");
    try {
      const response = await axios.post(`${API_BASE_URL}/user/invitations/accept`, { token, password });
      setMessage(response.data.message);
      setDone(true);
    } catch (error) {
      setMessage(errorMessage(error, "Could not accept this invitation."));
    } finally {
      setLoading(false);
    }
  }

  function continueToSignIn() {
    window.history.replaceState({}, "", "/#/login");
    window.location.reload();
  }

  return <LoginLayout>
    <form className="login-box" onSubmit={submit}>
      <div><Logo /></div>
      <h2>Join your training team.</h2>
      <p>Your invitation link verified your email. Create a secure password to activate your account.</p>
      {message && <div className={done ? "login-success" : "login-error"} role="alert">{message}</div>}
      {done ? <button className="btn primary" type="button" onClick={continueToSignIn}>Continue to sign in <Icon name="arrow" /></button> : <>
        <div className="field"><label htmlFor="new-password">Password</label><input id="new-password" className="input" type="password" minLength={8} required placeholder="8+ characters" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="field"><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="input" type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div>
        <button className="btn primary" type="submit" disabled={loading}>{loading ? "Creating account…" : <>Activate account <Icon name="arrow" /></>}</button>
      </>}
      <div className="login-bottom"><span><Icon name="shield" className="ico-sm" /> There is no public registration. Accounts are created by invitation only.</span></div>
    </form>
  </LoginLayout>;
}
