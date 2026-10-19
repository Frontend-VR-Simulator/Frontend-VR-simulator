import { useState } from "react";
import { roomCardOrder, roomById, roomName } from "../../content/catalog";
import { Chip, Empty, Heading, Icon, Kpi, Modal, ModalHead, PctBar, Prog, Section, SkillsBlock } from "../../components/ui";
import { colors } from "../../lib/visual";
import { SearchInput } from "../../components/SessionsTable";
import { matches } from "../../lib/interaction";
import { useApp } from "../../lib/context";
import { errorMessage } from "../../lib/api";
import { SERIES_COLORS } from "../../lib/model";
import { fmtDate, localDate, plural } from "../../lib/format";

const programColor = (index) => SERIES_COLORS[index % SERIES_COLORS.length];
const dueText = (program) => (program.due_date ? fmtDate(localDate(program.due_date)) : "Not scheduled");

function weighted(programs) {
  const total = programs.reduce((sum, program) => sum + program.learners, 0);
  return total ? Math.round(programs.reduce((sum, program) => sum + program.completion * program.learners, 0) / total) : 0;
}

// Creates a program: a set of rooms assigned to one cohort with a deadline. With
// `template`, the same rooms are assigned to another cohort ("Assign training").
function ProgramModal({ template, onClose }) {
  const { model, api, reload, toast } = useApp();
  const batches = [...new Set(model.trainees.map((user) => user.batch).filter(Boolean))].sort();
  const titles = [...new Map(model.programs.map((program) => [program.title, program])).values()];
  const [form, setForm] = useState({ title: template?.title || "", batch: batches[0] || "", roomIds: template?.room_ids || [], dueDate: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((previous) => ({ ...previous, ...patch }));
  const toggleRoom = (id) => set({ roomIds: form.roomIds.includes(id) ? form.roomIds.filter((room) => room !== id) : [...form.roomIds, id] });

  async function submit(event) {
    event.preventDefault();
    if (!form.roomIds.length) { setError("Select at least one room."); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/vr/programs", { ...form, dueDate: form.dueDate || null });
      await reload();
      toast(template ? "Assignment saved." : "Program created.");
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, "Could not save the program."));
    } finally {
      setSaving(false);
    }
  }

  return <Modal onClose={onClose} label={template ? "Assign training" : "Create training program"}>
    <form onSubmit={submit}>
      <ModalHead title={template ? "Assign training" : "Create training program"} onClose={onClose} />
      <p>{template ? "Assign a training program to a cohort." : "Set up a new training program for a cohort."}</p>
      {error && <div className="form-notice error">{error}</div>}
      {template ? <div className="field"><label htmlFor="program-template">Program</label><select id="program-template" className="select" value={form.title} onChange={(event) => { const picked = titles.find((program) => program.title === event.target.value); set({ title: picked.title, roomIds: picked.room_ids }); }}>{titles.map((program) => <option key={program.title}>{program.title}</option>)}</select></div>
        : <div className="field"><label htmlFor="program-name">Program name</label><input id="program-name" className="input" required maxLength={90} value={form.title} onChange={(event) => set({ title: event.target.value })} placeholder="e.g. Solid dose fundamentals" /></div>}
      <div className="field"><label htmlFor="program-cohort">Cohort</label><input id="program-cohort" className="input" list="program-cohorts" required maxLength={70} value={form.batch} onChange={(event) => set({ batch: event.target.value })} placeholder="e.g. November Interns" /><datalist id="program-cohorts">{batches.map((batch) => <option key={batch} value={batch} />)}</datalist></div>
      {!template && <div className="field"><label>Rooms</label><div className="room-picks">{roomCardOrder.map((id) => <label className="check" key={id}><input type="checkbox" checked={form.roomIds.includes(id)} onChange={() => toggleRoom(id)} /> {roomById[id].name}</label>)}</div></div>}
      <div className="field"><label htmlFor="program-due">Deadline</label><input id="program-due" className="input" type="date" value={form.dueDate} onChange={(event) => set({ dueDate: event.target.value })} /></div>
      <div className="modal-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : template ? "Save assignment" : <>Create program <Icon name="arrow" /></>}</button></div>
    </form>
  </Modal>;
}

function ProgramsTable({ programs, compact = false }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>PROGRAM</th><th>COHORT</th><th>LEARNERS</th><th>COMPLETION</th>{!compact && <><th>STATUS</th><th>DEADLINE</th></>}</tr></thead><tbody>
    {programs.map((program, index) => <tr key={program.id}>
      <td><b className="row-heading">{program.title}</b><div className="row-sub">{program.room_ids.map(roomName).join(", ")}</div></td>
      <td>{program.cohort}</td><td>{program.learners}</td><td><Prog value={program.completion} color={programColor(index)} /></td>
      {!compact && <><td><Chip color={program.tone}>{program.status}</Chip></td><td>{dueText(program)}</td></>}
    </tr>)}
  </tbody></table></div>;
}

export function ManagerHome() {
  const { model } = useApp();
  const [creating, setCreating] = useState(false);
  const programs = model.programs;
  const cohorts = [...new Set(programs.map((program) => program.cohort))].map((name, index) => [name, weighted(programs.filter((program) => program.cohort === name)), programColor(index)]);
  const upcoming = programs.filter((program) => program.dueIn != null && program.dueIn >= 0 && program.completion < 100).sort((a, b) => a.dueIn - b.dueIn).slice(0, 4);
  const attention = programs.filter((program) => program.completion < 75);
  const onTrack = programs.filter((program) => program.status === "On track" || program.status === "Complete").length;
  return <>
    <Heading title="Training overview" description="Programs, cohorts, completion, and upcoming milestones." action={<button className="btn primary sm" onClick={() => setCreating(true)}><Icon name="plus" /> New program</button>} eyebrow="TRAINING MANAGER" />
    <div className="kpis">
      <Kpi label="Active programs" value={programs.length} detail={`${plural(cohorts.length, "cohort")} · ${programs.reduce((sum, program) => sum + program.learners, 0)} enrolments`} icon="book" color="blue" />
      <Kpi label="Learner completion" value={`${weighted(programs)}%`} detail="Weighted across all programs" icon="target" color="yellow" />
      <Kpi label="Pending assessments" value={model.pendingReviews().length} detail="Review or approval needed" icon="clipboard" color="purple" />
      <Kpi label="On-track programs" value={`${onTrack} / ${programs.length}`} detail="This training period" icon="checkcircle" color="orange" />
    </div>
    <div className="grid cols2 mb22">
      <section className="panel"><Section title="Programs & cohorts" subtitle="Completion rates by training program" action={<a className="link" href="#/manager/programs">View all <Icon name="arrow" /></a>} />{programs.length ? <ProgramsTable programs={programs.slice(0, 5)} compact /> : <Empty>No programs yet. Create one to assign rooms to a cohort.</Empty>}</section>
      <section className="panel"><Section title="Completion by cohort" subtitle="A quick view of cohorts needing attention" />{cohorts.length ? cohorts.map(([name, value, color]) => <div className="skill-item" key={name}><div className="progress-line"><span>{name}</span><b>{value}%</b></div><PctBar value={value} color={color} /></div>) : <Empty>No cohorts have assigned training yet.</Empty>}</section>
    </div>
    <div className="grid cols2">
      <section className="panel"><Section title="Upcoming deadlines" subtitle="Training milestones in the coming weeks" />{upcoming.length ? upcoming.map((program, index) => <div className="list-item" key={program.id}><span className="step-num" style={{ "--color": colors[["yellow", "blue", "purple", "orange"][index]] }}>{index + 1}</span><div className="grow"><div className="row-heading">{program.title}</div><div className="row-sub">{program.cohort} · {plural(program.learners, "learner")}</div></div><span className="small muted nowrap">{dueText(program)}</span></div>) : <Empty>No upcoming deadlines.</Empty>}</section>
      <section className="panel"><Section title="Program attention" subtitle="Completion below 75%" />{attention.length ? attention.map((program, index) => <div className="skill-item" key={program.id}><div className="progress-line"><span>{program.title}<div className="row-sub">{program.cohort}</div></span><Chip color={program.tone}>{program.status}</Chip></div><Prog value={program.completion} color={programColor(index)} /></div>) : <Empty>Every program is at 75% or above.</Empty>}<p className="small mt22">Completion counts rooms passed in VR. Qualification for practical GMP work also requires trainer sign-off.</p></section>
    </div>
    {creating && <ProgramModal onClose={() => setCreating(false)} />}
  </>;
}

export function ManagerPrograms() {
  const { model } = useApp();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  return <>
    <Heading title="Programs & cohorts" description="Manage the training catalog and follow program completion." action={<button className="btn primary sm" onClick={() => setCreating(true)}><Icon name="plus" /> Create program</button>} eyebrow="CURRICULUM" />
    <section className="panel"><Section title="All programs" subtitle="Training programs and assigned cohorts" action={<SearchInput value={query} onChange={setQuery} placeholder="Search programs..." label="Search programs" width={220} />} />
      {model.programs.length ? <ProgramsTable programs={model.programs.filter((program) => matches(`${program.title} ${program.cohort}`, query))} /> : <Empty>No programs yet.</Empty>}
    </section>
    {creating && <ProgramModal onClose={() => setCreating(false)} />}
  </>;
}

export function ManagerAssignments() {
  const { model } = useApp();
  const [assigning, setAssigning] = useState(null);
  return <>
    <Heading title="Assignments & deadlines" description="Training assignments with explicit completion expectations." action={model.programs.length > 0 && <button className="btn primary sm" onClick={() => setAssigning(model.programs[0])}><Icon name="plus" /> Assign training</button>} eyebrow="OPERATIONS" />
    {model.programs.length ? <div className="grid cols2even">{model.programs.map((program, index) => <section className="panel" key={program.id}>
      <div className="flex-between mb12"><h3 className="panel-title">{program.title}</h3><Chip color={program.tone}>{program.status}</Chip></div>
      <p className="small">{program.cohort} · {plural(program.learners, "learner")} · Due {dueText(program)}</p>
      <Prog value={program.completion} color={programColor(index)} />
      <button className="btn ghost sm mt16" onClick={() => setAssigning(program)}>Assign to another cohort <Icon name="arrow" /></button>
    </section>)}</div> : <Empty>Create a program first, then assign it to cohorts.</Empty>}
    {assigning && <ProgramModal template={assigning} onClose={() => setAssigning(null)} />}
  </>;
}

export function ManagerReports() {
  const { model } = useApp();
  function exportCsv() {
    const fields = ["Program", "Cohort", "Rooms", "Learners", "Completion %", "Status", "Deadline"];
    const rows = model.programs.map((program) => [program.title, program.cohort, program.room_ids.map(roomName).join("; "), program.learners, program.completion, program.status, program.due_date || ""]);
    const csv = [fields, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "vr-pharma-training-report.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  return <>
    <Heading title="Training reports" description="Use performance and completion data to identify gaps." action={<button className="btn primary sm" onClick={exportCsv} disabled={!model.programs.length}><Icon name="download" /> Export CSV</button>} eyebrow="REPORTING" />
    <div className="grid cols2">
      <section className="panel"><Section title="Program completion" subtitle="Latest cohort snapshots" />{model.programs.length ? model.programs.map((program, index) => <div className="skill-item" key={program.id}><div className="progress-line"><span>{program.title} <span className="row-sub">· {program.cohort}</span></span><b>{program.completion}%</b></div><PctBar value={program.completion} color={programColor(index)} /></div>) : <Empty>No programs yet.</Empty>}</section>
      <section className="panel"><Section title="Assessment overview" subtitle="Average score by room" />{model.roomAverages.length ? <SkillsBlock data={model.roomAverages} /> : <Empty>Room averages appear after the first sessions.</Empty>}</section>
    </div>
  </>;
}
