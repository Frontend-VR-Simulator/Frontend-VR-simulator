import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, LogOut, Mail, Menu, Plus, RefreshCw, Users, X } from "lucide-react";
import { API_BASE_URL } from "../config/api";
import "./dashboard.css";

const apiBase = `${API_BASE_URL}/user`;

function initials(name = "User") {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function Stat({ label, value, detail, icon: Icon }) {
  return <article className="metric-card"><div className="metric-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function Empty({ children }) {
  return <div className="empty"><Users size={28} /><p>{children}</p></div>;
}

function AdminDashboard({ data, reload, token, section }) {
  const isAdmin = data.me?.role === "admin";
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: isAdmin ? "admin" : "trainer", batch: "", trainerId: "" });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const users = data.users || [];
  const admins = users.filter((user) => user.role === "admin");
  const heads = users.filter((user) => user.role === "head");
  const trainers = users.filter((user) => user.role === "trainer");
  const trainees = users.filter((user) => user.role === "trainee");
  const rows = tab === "admins" ? admins : tab === "heads" ? heads : tab === "trainers" ? trainers : tab === "trainees" ? trainees : users;

  async function invite(event) {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const response = await axios.post(`${apiBase}/invitations`, form, { headers: { Authorization: `Bearer ${token}` } });
      const text = response.data.emailSent ? "Invitation email sent." : `SMTP is not configured. Copy this link: ${response.data.inviteUrl}`;
      setNotice(text); setForm({ name: "", email: "", role: isAdmin ? "admin" : "trainer", batch: "", trainerId: "" });
      await reload();
    } catch (error) { setNotice(error.response?.data?.message || "Could not create invitation."); }
    finally { setSaving(false); }
  }

  if (!isAdmin && section === "overview") {
    return <>
      <div className="page-heading"><div><span className="eyebrow">HEAD CONSOLE</span><h1>Overview</h1><p>A quick view of your training organization and active cohorts.</p></div></div>
      <div className="metric-grid">
        <Stat icon={Users} label="Total people" value={users.length} detail="Across your organization" />
        <Stat icon={GraduationCap} label="Trainers" value={trainers.length} detail="Active instructors" />
        <Stat icon={BookOpen} label="Trainees" value={trainees.length} detail={`${new Set(trainees.map((user) => user.batch).filter(Boolean)).size} active batches`} />
      </div>
    </>;
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">{isAdmin ? "SITE ADMIN CONSOLE" : "HEAD CONSOLE"}</span><h1>Team management</h1><p>{isAdmin ? "Invite site administrators and organization heads." : "Invite trainers and trainees and keep every cohort organized."}</p></div><button className="primary" onClick={() => { setNotice(""); setModal(true); }}><Plus size={17} /> Invite user</button></div>
    {isAdmin && <div className="metric-grid">
      <Stat icon={Users} label="Total people" value={users.length} detail="Across your organization" />
      {isAdmin && <Stat icon={LayoutDashboard} label="Heads" value={heads.length} detail="Management accounts" />}
      <Stat icon={GraduationCap} label="Trainers" value={trainers.length} detail="Active instructors" />
      <Stat icon={BookOpen} label="Trainees" value={trainees.length} detail={`${new Set(trainees.map((u) => u.batch).filter(Boolean)).size} active batches`} />
    </div>}
    <section className="panel">
      <div className="panel-head"><div><h2>Directory</h2><p>Names, assignments, and account details.</p></div><div className="tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>All</button>{isAdmin && <button className={tab === "admins" ? "active" : ""} onClick={() => setTab("admins")}>Admins</button>}{isAdmin && <button className={tab === "heads" ? "active" : ""} onClick={() => setTab("heads")}>Heads</button>}{!isAdmin && <button className={tab === "trainers" ? "active" : ""} onClick={() => setTab("trainers")}>Trainers</button>}{!isAdmin && <button className={tab === "trainees" ? "active" : ""} onClick={() => setTab("trainees")}>Trainees</button>}</div></div>
      {rows.length ? <div className="table-scroll"><table><thead><tr><th>Person</th><th>Employee ID</th><th>Role</th><th>Batch</th><th>Trainer</th></tr></thead><tbody>{rows.map((user) => { const trainer = trainers.find((item) => item.id === user.trainer_id); return <tr key={user.id}><td><div className="person"><i>{initials(user.name)}</i><div><strong>{user.name}</strong><span>{user.email}</span></div></div></td><td className="mono">{user.employee_id || "—"}</td><td><span className={`role ${user.role}`}>{user.role}</span></td><td>{user.batch || "—"}</td><td>{trainer?.name || "—"}</td></tr>; })}</tbody></table></div> : <Empty>No users in this view yet.</Empty>}
    </section>
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><form className="modal" onSubmit={invite} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><h2>Invite a new user</h2><p>No password is collected. The recipient creates one from the emailed link.</p></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X /></button></div>{notice && <div className="notice">{notice}</div>}<label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></label><label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" /></label><div className="form-row"><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, batch: "", trainerId: "" })}>{isAdmin ? <><option value="admin">Site admin</option><option value="head">Organization head</option></> : <><option value="trainer">Trainer</option><option value="trainee">Trainee</option></>}</select></label>{form.role === "trainee" && <label>Batch<input required value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="Batch A" /></label>}</div>{form.role === "trainee" && <label>Assigned trainer<select required value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}><option value="">Select trainer</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label>}<button className="primary submit" disabled={saving}><Mail size={17} />{saving ? "Sending…" : "Send invitation"}</button></form></div>}
  </>;
}

function TrainerDashboard({ data }) {
  const trainees = data.trainees || [];
  const sessions = data.sessions || [];
  const details = trainees.map((trainee) => {
    const history = sessions.filter((item) => item.trainee_id === trainee.id);
    const average = history.length ? Math.round(history.reduce((sum, item) => sum + Number(item.score), 0) / history.length) : 0;
    return { ...trainee, sessions: history.length, average, last: history.at(-1)?.completed_at };
  });
  const overall = sessions.length ? Math.round(sessions.reduce((sum, item) => sum + Number(item.score), 0) / sessions.length) : 0;
  return <><div className="page-heading"><div><span className="eyebrow">TRAINER WORKSPACE</span><h1>Your trainees</h1><p>Track participation and spot who needs extra coaching.</p></div></div><div className="metric-grid"><Stat icon={Users} label="Assigned trainees" value={trainees.length} detail="In your roster" /><Stat icon={BookOpen} label="Sessions completed" value={sessions.length} detail="Across all trainees" /><Stat icon={BarChart3} label="Average score" value={`${overall}%`} detail="Overall performance" /></div><section className="panel"><div className="panel-head"><div><h2>Performance overview</h2><p>Training activity for your assigned trainees.</p></div></div>{details.length ? <div className="trainee-cards">{details.map((item) => <article className="trainee-card" key={item.id}><div className="person"><i>{initials(item.name)}</i><div><strong>{item.name}</strong><span>{item.email}</span></div></div><div className="score-ring" style={{ "--score": `${item.average * 3.6}deg` }}><span>{item.average}%</span></div><dl><div><dt>Batch</dt><dd>{item.batch || "—"}</dd></div><div><dt>Sessions</dt><dd>{item.sessions}</dd></div><div><dt>Last activity</dt><dd>{item.last ? new Date(item.last).toLocaleDateString() : "Not started"}</dd></div></dl></article>)}</div> : <Empty>No trainees have been assigned to you yet.</Empty>}</section></>;
}

function TraineeDashboard({ data }) {
  const sessions = data.sessions || [];
  const scores = sessions.map((item) => Number(item.score));
  const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const best = scores.length ? Math.max(...scores) : 0;
  const minutes = sessions.reduce((sum, item) => sum + item.duration_minutes, 0);
  return <><div className="page-heading"><div><span className="eyebrow">MY LEARNING</span><h1>Training progress</h1><p>See every session, score, and improvement over time.</p></div></div><div className="metric-grid"><Stat icon={BookOpen} label="Sessions taken" value={sessions.length} detail={`${minutes} total minutes`} /><Stat icon={BarChart3} label="Average score" value={`${average}%`} detail="Across all sessions" /><Stat icon={GraduationCap} label="Personal best" value={`${best}%`} detail="Highest recorded score" /></div><section className="panel chart-panel"><div className="panel-head"><div><h2>Learning curve</h2><p>Your score across recent training sessions.</p></div></div>{scores.length ? <div className="chart"><div className="axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="bars">{scores.map((score, index) => <div className="bar-col" key={sessions[index].id}><div className="bar-value">{score}%</div><div className="bar" style={{ height: `${Math.max(score, 4)}%` }}></div><span>S{index + 1}</span></div>)}</div></div> : <Empty>Your progress chart will appear after your first VR session.</Empty>}</section></>;
}

export default function Dashboard({ auth, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [section, setSection] = useState(auth.role?.toLowerCase() === "head" ? "overview" : "management");
  const load = useCallback(async () => {
    setError("");
    try { const response = await axios.get(`${apiBase}/dashboard`, { headers: { Authorization: `Bearer ${auth.token}` } }); setData(response.data); }
    catch (reason) { if (reason.response?.status === 401) onLogout(); else setError(reason.response?.data?.message || "Could not load dashboard."); }
  }, [auth.token, onLogout]);
  useEffect(() => {
    let active = true;
    axios.get(`${apiBase}/dashboard`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then((response) => { if (active) setData(response.data); })
      .catch((reason) => {
        if (!active) return;
        if (reason.response?.status === 401) onLogout();
        else setError(reason.response?.data?.message || "Could not load dashboard.");
      });
    return () => { active = false; };
  }, [auth.token, onLogout]);
  const role = data?.me?.role || auth.role?.toLowerCase();
  const nav = useMemo(() => role === "admin" ? [[LayoutDashboard, "Management", "management"], [Users, "Directory", "directory"]] : role === "head" ? [[LayoutDashboard, "Overview", "overview"], [Users, "User management", "users"]] : role === "trainer" ? [[LayoutDashboard, "Overview", "overview"], [Users, "My trainees", "trainees"]] : [[LayoutDashboard, "My progress", "progress"], [BookOpen, "Sessions", "sessions"]], [role]);

  return <div className="dashboard-shell"><aside className={menu ? "open" : ""}><div className="brand"><div>VR</div><span>Simulation<strong>Suite</strong></span></div><nav>{nav.map(([Icon, label, id]) => <button className={section === id ? "active" : ""} key={label} onClick={() => { setSection(id); setMenu(false); }}><Icon size={18} />{label}</button>)}</nav><div className="profile"><i>{initials(data?.me?.name || auth.email)}</i><div><strong>{data?.me?.name || "Account"}</strong><span>{role}</span></div><button onClick={onLogout} title="Log out"><LogOut size={18} /></button></div></aside><main className="dashboard-main"><header><button className="menu-button" onClick={() => setMenu(!menu)}><Menu /></button><div><span>Workspace</span><strong>{data?.me?.employee_id || "VR Training"}</strong></div><button className="refresh" onClick={load}><RefreshCw size={16} /> Refresh</button></header><div className="content">{error ? <div className="load-state"><p>{error}</p><button onClick={load}>Try again</button></div> : !data ? <div className="load-state"><RefreshCw className="spin" /><p>Loading your workspace…</p></div> : ["admin", "head"].includes(role) ? <AdminDashboard data={data} reload={load} token={auth.token} section={section} /> : role === "trainer" ? <TrainerDashboard data={data} /> : <TraineeDashboard data={data} />}</div></main>{menu && <button className="aside-scrim" onClick={() => setMenu(false)} aria-label="Close navigation" />}</div>;
}
