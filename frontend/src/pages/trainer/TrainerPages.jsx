import { useState } from "react";
import { roomSteps, roomById } from "../../content/catalog";
import { Avatar, Chip, Empty, Heading, Icon, Kpi, Modal, ModalHead, PctBar, Prog, RecordingSoon, ResultChip, Section, SkillsBlock } from "../../components/ui";
import { RECORDINGS_LIVE } from "../../config/features";
import { colors, scoreColor, statusColor } from "../../lib/visual";
import { SearchInput, SessionsTable } from "../../components/SessionsTable";
import { matches, openOnKey, sessionSearchText } from "../../lib/interaction";
import { InviteUserModal } from "../../components/InviteUserModal";
import { useApp } from "../../lib/context";
import { avg } from "../../lib/model";
import { initials, plural } from "../../lib/format";
import { goto } from "../../lib/router";

export function TrainerHome() {
  const { model } = useApp();
  const review = model.pendingReviews().slice().sort((a, b) => a.score - b.score);
  const learners = model.learnerRows;
  const support = learners.filter((learner) => learner.status === "At risk" || learner.status === "Needs review");
  const scored = learners.filter((learner) => learner.score != null);
  const latestRecording = review.filter((session) => session.recording === "Ready").at(-1) || model.sessions.filter((session) => session.recording === "Ready").at(-1);
  const flaggedStep = latestRecording && Object.keys(latestRecording.issues)[0];
  const gaps = model.roomAverages.slice().sort((a, b) => a[1] - b[1]).slice(0, 4);

  return <>
    <Heading title="Trainer overview" description="Review assessments, support learners, and provide targeted feedback." action={<a href="#/trainer/queue" className="btn primary sm">Review sessions <Icon name="arrow" /></a>} eyebrow="TRAINER DASHBOARD" />
    <div className="kpis">
      <Kpi label="Sessions to review" value={review.length} detail={`${review.filter((s) => s.result === "Fail").length} failed, ${review.filter((s) => s.result === "Review").length} borderline`} icon="clipboard" color="blue" />
      <Kpi label="Learners needing support" value={support.length} detail={`${support.filter((l) => l.status === "At risk").length} at risk`} icon="warning" color="orange" />
      <Kpi label="Average score" value={scored.length ? `${avg(scored.map((l) => l.score))}%` : "—"} detail={`${plural(learners.length, "assigned learner")}`} icon="target" color="purple" />
      <Kpi label="Recordings available" value={RECORDINGS_LIVE ? model.sessions.filter((s) => s.recording === "Ready").length : "Soon"} detail={RECORDINGS_LIVE ? "Video evidence ready" : "Session video coming soon"} icon="video" color="yellow" />
    </div>
    <div className="grid cols2 mb22">
      <section className="panel">
        <Section title="Review queue" subtitle="Prioritized by assessment outcome" action={<a className="link" href="#/trainer/queue">Open queue <Icon name="arrow" /></a>} />
        {review.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>LEARNER</th><th>ROOM</th><th>SCORE</th><th>STATUS</th><th /></tr></thead><tbody>{review.slice(0, 8).map((session) => {
          const open = () => goto(`session/${session.id}`);
          return <tr className="clickable" key={session.id} tabIndex={0} onClick={open} onKeyDown={openOnKey(open)}><td><b className="row-heading">{session.learner}</b><div className="row-sub">{session.date}</div></td><td>{session.title}</td><td style={{ color: colors[scoreColor(session.score)], fontWeight: 750 }}>{session.score}%</td><td><ResultChip result={session.result} /></td><td><Icon name="chevron" /></td></tr>;
        })}</tbody></table></div> : <Empty>No sessions are waiting for review.</Empty>}
      </section>
      <section className="panel">
        <Section title="Assigned learners" subtitle="Lowest completion in your group" action={<a className="link" href="#/trainer/learners">View all <Icon name="arrow" /></a>} />
        {learners.length ? learners.slice().sort((a, b) => a.progress - b.progress).slice(0, 6).map((learner) => <div className="list-item" key={learner.id}><Avatar text={initials(learner.name)} /><div className="grow"><div className="flex-between mb8"><div className="row-heading">{learner.name}</div><span className="strong small">{learner.progress}%</span></div><PctBar value={learner.progress} color={learner.color} /></div><Chip color={statusColor(learner.status)}>{learner.status}</Chip></div>) : <Empty>No learners are assigned to you yet.</Empty>}
      </section>
    </div>
    <div className="grid cols2">
      <section className="panel">
        {!RECORDINGS_LIVE ? <><Section title="Session recordings" subtitle="Video review for every VR attempt" action={<Chip color="purple">Coming soon</Chip>} /><RecordingSoon /></> : <>
        <Section title="Latest recording review" subtitle={latestRecording ? `${latestRecording.title} · ${latestRecording.learner}` : "Session recordings"} action={latestRecording && <a className="link" href={`#/session/${latestRecording.id}`}>Open review <Icon name="arrow" /></a>} />
        {latestRecording ? <>
          <a className="video-poster" style={{ minHeight: 232 }} href={`#/session/${latestRecording.id}`}><span className="play-disc" role="img" aria-label="Recording preview"><Icon name="play" className="ico-lg" /></span><div className="recording-controls"><PctBar value={0} color="yellow" /><span className="tiny">Attempt {latestRecording.attempt} · {latestRecording.date} · {latestRecording.minutes} min</span></div></a>
          <div className="flex-between mt16"><span className="small">{flaggedStep != null ? `Procedural error flagged at step ${Number(flaggedStep) + 1}` : `${plural(latestRecording.errors, "critical error")} recorded`}</span><Chip color={latestRecording.reviewed ? "mint" : "orange"}>{latestRecording.reviewed ? "Reviewed" : "Needs review"}</Chip></div>
        </> : <Empty>No recordings have been uploaded yet.</Empty>}
        </>}
      </section>
      <section className="panel">
        <Section title="Competency gaps" subtitle="Lowest average room scores" />
        {gaps.length ? <SkillsBlock data={gaps} /> : <Empty>Room averages appear after the first sessions.</Empty>}
      </section>
    </div>
  </>;
}

export function TrainerQueue() {
  const { model } = useApp();
  const [query, setQuery] = useState("");
  const pending = model.pendingReviews().slice().reverse();
  return <>
    <Heading title="Review queue" description="Select a session to review procedural steps, evidence, and feedback." eyebrow="ASSESSMENTS" />
    <section className="panel">
      <Section title="Sessions awaiting attention" subtitle={`${pending.length} failed or borderline attempts without trainer sign-off`} action={<SearchInput value={query} onChange={setQuery} placeholder="Search name or room..." label="Search review queue" width={245} />} />
      <SessionsTable sessions={pending.filter((session) => matches(sessionSearchText(session), query))} />
    </section>
  </>;
}

function LearnerSessionsModal({ learner, onClose }) {
  const { model } = useApp();
  const list = model.sessionsOf(learner.id).slice().reverse();
  return <Modal onClose={onClose} label={`${learner.name} sessions`}>
    <ModalHead title={`${learner.name} · Sessions`} onClose={onClose} />
    {list.length ? list.map((session) => {
      const open = () => goto(`session/${session.id}`);
      return <div className="list-item clickable" key={session.id} tabIndex={0} onClick={open} onKeyDown={openOnKey(open)}><div className="grow"><div className="row-heading">{session.title}</div><div className="row-sub">{session.label || `Attempt ${session.attempt}`} · {session.date}</div></div><b>{session.score}%</b><Icon name="chevron" /></div>;
    }) : <p className="small">No sessions available yet.</p>}
  </Modal>;
}

export function LearnersPage({ manager = false }) {
  const { model } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [inviting, setInviting] = useState(false);
  const learners = model.learnerRows;
  return <>
    <Heading title={manager ? "Learner directory" : "My learners"} description={manager ? "Organization-wide learner overview." : "Track every learner’s completion, performance, and support needs."} action={manager && <button className="btn primary sm" onClick={() => setInviting(true)}><Icon name="plus" /> Invite user</button>} eyebrow={manager ? "TRAINING MANAGER" : "TRAINER"} />
    <section className="panel">
      <Section title={manager ? "All learners" : "Assigned learners"} subtitle={`${plural(learners.length, "learner")}${manager ? " in your organization" : " assigned to you"}`} action={<SearchInput value={query} onChange={setQuery} placeholder="Search learners..." label="Search learners" width={220} />} />
      {learners.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>LEARNER</th><th>BATCH</th>{manager && <th>TRAINER</th>}<th>COMPLETION</th><th>AVG SCORE</th><th>STATUS</th><th /></tr></thead><tbody>
        {learners.filter((learner) => matches(`${learner.name} ${learner.email} ${learner.batch || ""}`, query)).map((learner) => <tr key={learner.id}>
          <td><div className="row-identity"><Avatar text={initials(learner.name)} className="table-avatar" /><div><b className="row-heading">{learner.name}</b><div className="row-sub">{learner.employee_id || learner.email}</div></div></div></td>
          <td>{learner.batch || "—"}</td>
          {manager && <td>{model.users.find((user) => user.id === learner.trainer_id)?.name || "—"}</td>}
          <td><Prog value={learner.progress} color={learner.color} /></td>
          <td><b>{learner.score == null ? "—" : `${learner.score}%`}</b></td>
          <td><Chip color={statusColor(learner.status)}>{learner.status}</Chip></td>
          <td><button className="link" onClick={() => setSelected(learner)}>View sessions <Icon name="arrow" /></button></td>
        </tr>)}
      </tbody></table></div> : <Empty>{manager ? "No learners yet. Invite trainees to get started." : "No learners are assigned to you yet."}</Empty>}
    </section>
    {selected && <LearnerSessionsModal learner={selected} onClose={() => setSelected(null)} />}
    {inviting && <InviteUserModal onClose={() => setInviting(false)} />}
  </>;
}

export function SessionsPage({ onlyRecordings = false, query: routeQuery }) {
  const { model } = useApp();
  const [query, setQuery] = useState("");
  const room = roomById[routeQuery?.get("room")];
  const list = model.sessions.slice().reverse()
    .filter((session) => !onlyRecordings || session.recording !== "Unavailable")
    .filter((session) => !room || session.rooms.some((item) => item.roomId === room.id));
  if (onlyRecordings && !RECORDINGS_LIVE) return <>
    <Heading title="Session recordings" description="Video recordings of every VR attempt, linked to its assessment." eyebrow="RECORDING LIBRARY" />
    <section className="panel"><Section title="Recording library" subtitle="Session video arrives in a later release" action={<Chip color="purple">Coming soon</Chip>} /><RecordingSoon minHeight={340} /></section>
  </>;
  return <>
    <Heading title={onlyRecordings ? "Session recordings" : "VR session history"} description={onlyRecordings ? "Video recordings of every VR attempt, linked to its assessment." : "Every training attempt is recorded and assessed."} eyebrow={onlyRecordings ? "RECORDING LIBRARY" : "SESSION HISTORY"} />
    <section className="panel">
      <Section title={onlyRecordings ? "Recording library" : room ? `Sessions in ${room.name}` : "All sessions"} subtitle={plural(list.length, "training attempt")} action={<SearchInput value={query} onChange={setQuery} placeholder="Search sessions..." label="Search sessions" />} />
      <SessionsTable sessions={list.filter((session) => matches(sessionSearchText(session), query))} />
    </section>
    {RECORDINGS_LIVE && <div className="small muted mt16">&apos;Processing&apos; recordings are still uploading from the VR launcher and cannot be played yet. Open a ready recording to view playback.</div>}
  </>;
}

export function TrainerAnalytics() {
  const { model } = useApp();
  const stepHotspots = Object.values(roomById).map((room) => {
    const stats = model.roomStats(room.id);
    if (!stats.stepErr) return null;
    const worst = stats.stepErr.indexOf(Math.max(...stats.stepErr));
    return [`${room.name} · ${roomSteps(room)[worst]}`, stats.stepErr[worst], "orange"];
  }).filter(Boolean).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return <>
    <Heading title="Skill analytics" description="Compare skills across your learner group." eyebrow="COMPETENCY" />
    <div className="grid cols2">
      <section className="panel">
        <Section title="Cohort competency" subtitle="Average assessed score in each room" />
        {model.roomAverages.length ? <SkillsBlock data={model.roomAverages} /> : <Empty>Room averages appear after the first sessions.</Empty>}
        {stepHotspots.length > 0 && <><h4 className="room-h">Steps with the most errors</h4><SkillsBlock data={stepHotspots} /><p className="tiny muted mt12">Share of attempts with an error at that step.</p></>}
      </section>
      <section className="panel">
        <Section title="Learner readiness" subtitle="Rooms passed out of the full production suite" />
        {model.learnerRows.length ? model.learnerRows.map((learner) => <div className="skill-item" key={learner.id}><div className="progress-line"><span>{learner.name}</span><b>{learner.progress}%</b></div><PctBar value={learner.progress} color={learner.color} /></div>) : <Empty>No learners yet.</Empty>}
      </section>
    </div>
  </>;
}
