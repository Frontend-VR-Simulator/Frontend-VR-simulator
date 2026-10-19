import { useState } from "react";
import { resultsExample, resultsMapping } from "../../content/resultsContract";
import { Avatar, Chip, Empty, Heading, Icon, Kpi, Modal, ModalHead, Prog, RecordingSoon, Section } from "../../components/ui";
import { RECORDINGS_LIVE } from "../../config/features";
import { colors } from "../../lib/visual";
import { SearchInput } from "../../components/SessionsTable";
import { matches } from "../../lib/interaction";
import { InviteUserModal } from "../../components/InviteUserModal";
import { useApp } from "../../lib/context";
import { accountRoleLabels, SERIES_COLORS } from "../../lib/model";
import { fmtBytes, fmtClock, fmtDate, fmtShortDate, initials, plural } from "../../lib/format";

const SERVICE_COLORS = ["mint", "blue", "purple", "orange"];

function useServices() {
  const { model } = useApp();
  return (model.integration?.services || []).map((service, index) => {
    if (!RECORDINGS_LIVE && /^Recording/.test(service.name)) return { ...service, soon: true, label: "Coming soon", color: "gray", detail: "Session video arrives in a later release" };
    const healthy = service.health >= 95;
    return { ...service, label: healthy ? "Connected" : "Attention", color: healthy ? SERVICE_COLORS[index] : "orange" };
  });
}

function useJobs() {
  const { model } = useApp();
  return model.sessions.filter((session) => session.recording !== "Unavailable").slice().reverse().map((session, index) => ({
    id: session.id,
    name: `${session.title} · ${session.learner} · ${session.label || `Attempt ${session.attempt}`}`,
    percent: session.recording === "Ready" ? 100 : 0,
    status: session.recording === "Ready" ? "Ready" : "Uploading",
    color: session.recording === "Ready" ? SERIES_COLORS[index % 3] : "purple",
  }));
}

const lastChecked = (service) => (service.lastEventAt ? `Last event ${fmtShortDate(service.lastEventAt)} ${fmtClock(service.lastEventAt)}` : "No events yet");
const eventColor = (event) => (event.outcome === "Failed" ? "red" : event.outcome === "In progress" ? "orange" : event.category === "recording" ? "blue" : event.category === "ingestion" ? "mint" : "purple");

function ServiceHealth({ services }) {
  if (!services.length) return <Empty>Integration status is unavailable.</Empty>;
  return services.map((service) => <div className="skill-item" key={service.name}><div className="progress-line"><span>{service.name}</span><Chip color={service.soon ? "purple" : service.color}>{service.label}</Chip></div>{!service.soon && <Prog value={service.health} color={service.color} />}</div>);
}

function JobList({ jobs, roomy = false }) {
  if (!jobs.length) return <Empty>No session recordings yet.</Empty>;
  return jobs.map((job) => <a className="skill-item" key={job.id} href={`#/session/${job.id}`} style={{ display: "block", ...(roomy ? { padding: "17px 0" } : {}) }}><div className="progress-line"><span>{job.name}</span><Chip color={job.status === "Ready" ? "blue" : "purple"}>{job.status}</Chip></div><Prog value={job.percent} color={job.color} /></a>);
}

export function AdminHome() {
  const { model } = useApp();
  const services = useServices();
  const jobs = useJobs();
  const storage = model.integration?.storage;
  const storagePct = storage ? Math.round((100 * storage.usedBytes) / storage.quotaBytes) : 0;
  return <>
    <Heading title="System overview" description="Monitor VR data ingestion, users, and recording processing." action={<a className="btn ghost sm" href="#/admin/integrations">Integration details <Icon name="arrow" /></a>} eyebrow="SYSTEM ADMINISTRATION" />
    <div className="kpis">
      <Kpi label="Active users" value={model.users.length} detail={`${plural(model.invitations.length, "pending invitation")}`} icon="users" color="blue" />
      <Kpi label="Integrations healthy" value={`${services.filter((s) => s.label === "Connected").length} / ${services.filter((s) => !s.soon).length}`} detail={services.some((s) => s.label === "Attention") ? "A service needs attention" : "All services healthy"} icon="layers" color="yellow" />
      {RECORDINGS_LIVE ? <>
      <Kpi label="Video storage used" value={`${storagePct}%`} detail={storage ? `${fmtBytes(storage.usedBytes)} of ${fmtBytes(storage.quotaBytes)}` : "—"} icon="database" color="purple" />
      <Kpi label="Recording jobs" value={jobs.filter((job) => job.status !== "Ready").length} detail="Still uploading" icon="video" color="orange" />
      </> : <>
      <Kpi label="VR sessions ingested" value={model.sessions.length} detail="All time, from the VR launcher" icon="database" color="purple" />
      <Kpi label="Session recordings" value="Soon" detail="Video arrives in a later release" icon="video" color="orange" />
      </>}
    </div>
    <div className="grid cols2 mb22">
      <section className="panel"><Section title="Platform health" subtitle="Last 7 days of VR and recording events" /><ServiceHealth services={services} /></section>
      <section className="panel"><Section title="VR integrations" subtitle="Status of source connections" action={<a className="link" href="#/admin/integrations">View details <Icon name="arrow" /></a>} />
        {services.map((service) => <div className="list-item" key={service.name}><span className="kpi-icon" style={{ "--accent": colors[service.color], width: 35, height: 35 }}><Icon name="layers" /></span><div className="grow"><div className="row-heading">{service.name}</div><div className="row-sub">{service.detail} · {lastChecked(service)}</div></div><Chip color={service.color}>{service.label}</Chip></div>)}
      </section>
    </div>
    <div className="grid cols2">
      {RECORDINGS_LIVE ? <section className="panel"><Section title="Recording processing" subtitle="Media can arrive after assessment results" action={<a className="link" href="#/admin/recordings">All jobs <Icon name="arrow" /></a>} /><JobList jobs={jobs.slice(0, 6)} /></section>
        : <section className="panel"><Section title="Recording processing" subtitle="Session video pipeline" action={<Chip color="purple">Coming soon</Chip>} /><RecordingSoon /></section>}
      <section className="panel"><Section title="Recent events" subtitle="Activity log" action={<a className="link" href="#/admin/audit">Audit log <Icon name="arrow" /></a>} />
        {model.audit.length ? model.audit.slice(0, 6).map((event) => <div className="list-item" key={event.id}><span className="color-swatch" style={{ "--swatch": colors[eventColor(event)] }} /><div className="grow row-heading">{event.event}</div><span className="small muted nowrap">{fmtClock(event.created_at)}</span></div>) : <Empty>No events recorded yet.</Empty>}
      </section>
    </div>
  </>;
}

export function AdminUsers() {
  const { model } = useApp();
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const progressById = new Map(model.learnerRows.map((learner) => [learner.id, learner]));
  const rows = model.users.filter((user) => matches(`${user.name} ${user.email} ${user.role} ${user.batch || ""}`, query));
  const invites = model.invitations.filter((invite) => matches(`${invite.name} ${invite.email} ${invite.role}`, query));
  return <>
    <Heading title="Users & roles" description="Manage LMS roles and review learner access." action={<button className="btn primary sm" onClick={() => setInviting(true)}><Icon name="plus" /> Invite user</button>} eyebrow="ACCESS CONTROL" />
    <section className="panel">
      <Section title="Users" subtitle={`${plural(model.users.length, "account")} · ${plural(model.invitations.length, "pending invitation")}`} action={<SearchInput value={query} onChange={setQuery} placeholder="Search users..." label="Search users" width={220} />} />
      <div className="table-wrap"><table className="data-table"><thead><tr><th>USER</th><th>ROLE</th><th>EMPLOYEE ID</th><th>BATCH</th><th>PROGRESS</th><th>ACCOUNT</th></tr></thead><tbody>
        {rows.map((user) => {
          const learner = progressById.get(user.id);
          return <tr key={user.id}>
            <td><div className="row-identity"><Avatar text={initials(user.name)} className="table-avatar" /><div><b className="row-heading">{user.name}</b><div className="row-sub">{user.email}</div></div></div></td>
            <td>{accountRoleLabels[user.role]}</td><td className="small">{user.employee_id || "—"}</td><td>{user.batch || "—"}</td>
            <td>{learner ? <Prog value={learner.progress} color={learner.color} /> : <span className="muted small">Staff account</span>}</td>
            <td><Chip color="mint">Active</Chip></td>
          </tr>;
        })}
        {invites.map((invite) => <tr key={invite.id}>
          <td><div className="row-identity"><Avatar text={initials(invite.name)} className="table-avatar" /><div><b className="row-heading">{invite.name}</b><div className="row-sub">{invite.email}</div></div></div></td>
          <td>{accountRoleLabels[invite.role]}</td><td className="small">—</td><td>—</td><td><span className="muted small">Expires {fmtDate(invite.expires_at)}</span></td><td><Chip color="yellow">Invited</Chip></td>
        </tr>)}
      </tbody></table></div>
    </section>
    {inviting && <InviteUserModal onClose={() => setInviting(false)} />}
  </>;
}

export function AdminIntegrations() {
  const services = useServices();
  const [showPayload, setShowPayload] = useState(false);
  return <>
    <Heading title="VR integrations" description="Data and media connections between the VR simulators and the LMS." eyebrow="INTEGRATIONS" />
    <div className="grid cols2">
      <section className="panel"><Section title="Connections" subtitle="Health of the data and media integration" /><ServiceHealth services={services} />
        {services.map((service) => <p className="tiny muted mt12" key={service.name}><b>{service.name}:</b> {service.detail}. {lastChecked(service)}.</p>)}
      </section>
      <section className="panel"><Section title="Data mapping" subtitle="results.json fields mapped to LMS records" />
        {resultsMapping.map(([field, description]) => <div className="list-item" key={field}><code className="small" style={{ color: "var(--yellow)", minWidth: 140 }}>{field}</code><span className="small muted">{description}</span></div>)}
        <button className="btn ghost sm mt16" onClick={() => setShowPayload(true)}><Icon name="file" /> View payload</button>
      </section>
    </div>
    {showPayload && <Modal onClose={() => setShowPayload(false)} label="VR results payload">
      <ModalHead title="VR results payload" onClose={() => setShowPayload(false)} />
      <p>The results.json file the VR application writes when a session ends. The launcher uploads it and then the recording.</p>
      <pre className="payload">{JSON.stringify(resultsExample, null, 2)}</pre>
      <button className="btn ghost sm mt16" onClick={() => setShowPayload(false)}>Close</button>
    </Modal>}
  </>;
}

export function AdminRecordings() {
  const jobs = useJobs();
  return <>
    <Heading title="Recording jobs" description="Upload status for each VR session recording." eyebrow="MEDIA PIPELINE" />
    {RECORDINGS_LIVE ? <section className="panel"><Section title="Recording processing queue" subtitle={`${jobs.filter((job) => job.status !== "Ready").length} uploading · ${jobs.filter((job) => job.status === "Ready").length} ready`} /><JobList jobs={jobs} roomy /></section>
      : <section className="panel"><Section title="Recording processing queue" subtitle="Session video arrives in a later release" action={<Chip color="purple">Coming soon</Chip>} /><RecordingSoon minHeight={340} /></section>}
  </>;
}

export function AdminAudit() {
  const { model } = useApp();
  return <>
    <Heading title="Audit log" description="Immutable record of important changes." eyebrow="PLATFORM AUDIT" />
    <section className="panel"><Section title="Recent platform events" subtitle={`Latest ${model.audit.length} events · retained per data-integrity policy`} />
      {model.audit.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>TIME</th><th>EVENT</th><th>ACTOR</th><th>OUTCOME</th></tr></thead><tbody>
        {model.audit.map((event) => <tr key={event.id}><td className="nowrap">{fmtShortDate(event.created_at)} {fmtClock(event.created_at)}</td><td>{event.event}</td><td>{event.actor_label}</td><td><Chip color={event.outcome === "Failed" ? "red" : event.outcome === "In progress" ? "yellow" : "mint"}>{event.outcome}</Chip></td></tr>)}
      </tbody></table></div> : <Empty>No events recorded yet.</Empty>}
    </section>
  </>;
}
