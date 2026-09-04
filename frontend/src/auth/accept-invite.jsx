import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

export default function AcceptInvite({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setLoading(true); setMessage("");
    try {
      const response = await axios.post(`${API_BASE_URL}/user/invitations/accept`, { token, password });
      setMessage(response.data.message); setDone(true);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not accept this invitation.");
    } finally { setLoading(false); }
  }

  return <main className="h-screen bg-zinc-950 flex items-center justify-center px-4">
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-7 text-zinc-100">
      <div className="w-11 h-11 bg-emerald-400 text-zinc-950 font-bold rounded-xl grid place-items-center mb-5">VR</div>
      <h1 className="text-2xl font-semibold">Join your training team</h1>
      <p className="text-zinc-400 text-sm mt-2 mb-6">Your invitation link verified your email. Create a secure password to activate your account.</p>
      {message && <div className={`mb-4 p-3 rounded-lg text-sm ${done ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{message}</div>}
      {!done ? <form onSubmit={submit} className="space-y-4">
        <input className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3" type="password" minLength="8" required placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3" type="password" minLength="8" required placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button disabled={loading} className="w-full bg-emerald-400 text-zinc-950 rounded-lg p-3 font-semibold">{loading ? "Creating account…" : "Activate account"}</button>
      </form> : <button onClick={() => { window.history.replaceState({}, "", "/"); window.location.reload(); }} className="w-full bg-zinc-100 text-zinc-950 rounded-lg p-3 font-semibold">Continue to sign in</button>}
    </div>
  </main>;
}
