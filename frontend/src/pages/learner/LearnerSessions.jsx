import { useState } from "react";
import { PASS_MARK, roomById, roomCardOrder, roomCards, tracksCriticalErrors } from "../../content/catalog";
import { Empty, Heading, Icon, RecordingChip, ResultChip, Thumb } from "../../components/ui";
import { RECORDINGS_LIVE } from "../../config/features";
import { openOnKey } from "../../lib/interaction";
import { useApp } from "../../lib/context";
import { completeSummary } from "../../lib/model";
import { fmtHms } from "../../lib/format";
import { goto } from "../../lib/router";

function RoomGroups() {
  const { model } = useApp();
  const me = model.me;
  const groups = roomCardOrder.map((id) => ({ room: roomById[id], list: model.roomSessions(id, me.id) }));
  const visited = groups.filter((group) => group.list.length);
  const todo = groups.filter((group) => !group.list.length);
  if (!visited.length) return <Empty>No room attempts yet. Your rooms appear here after the VR application uploads your results.</Empty>;
  return <>
    {visited.map(({ room, list }) => {
      const n = roomCardOrder.indexOf(room.id) + 1;
      const last = list.at(-1);
      const best = Math.max(...list.map((session) => session.score));
      const passed = list.some((session) => session.result === "Pass");
      const critical = tracksCriticalErrors(room.id);
      return <details className="panel sess-group sess-toggle" key={room.id}>
        <summary className="sess-head"><Icon name="chevron" className="sess-chevron" /><Thumb image={roomCards[room.id].image} alt="" /><div className="grow"><div className="row-heading"><span className={`tile-num static mini ${passed ? "done" : "now"}`}>{n}</span>{room.name}</div><div className="row-sub">{list.length} attempt{list.length > 1 ? "s" : ""} · best {best}% · latest {last.result} · {last.date}</div></div><a className="link" href={`#/learner/training?room=${room.id}`} onClick={(event) => event.stopPropagation()}>Room details <Icon name="arrow" /></a></summary>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>ATTEMPT</th><th>COMPLETED</th><th>DURATION</th><th>SCORE</th>{critical && <th>CRITICAL ERRORS</th>}<th>RESULT</th><th>RECORDING</th><th /></tr></thead>
          <tbody>{list.slice().reverse().map((session) => {
            const open = () => goto(session.href);
            return <tr className="clickable" key={session.href} tabIndex={0} onClick={open} onKeyDown={openOnKey(open)}>
              <td><b>Attempt {session.attempt}</b></td><td>{session.date}<div className="row-sub">{session.timeSeconds}</div></td><td>{fmtHms(session.seconds)}</td><td><b>{session.score}%</b>{session.rooms[0]?.maxPoints != null && <div className="row-sub">{session.rooms[0].points} of {session.rooms[0].maxPoints} pts</div>}</td>{critical && <td>{session.errors}</td>}<td><ResultChip result={session.result} /></td>
              <td>{!RECORDINGS_LIVE ? <RecordingChip status={session.recording} /> : session.recording === "Ready" ? <span className="watch"><Icon name="play" className="ico-sm" /> Watch</span> : <span className="small muted">{session.recording}</span>}</td>
              <td className="pill-arrow"><Icon name="chevron" /></td>
            </tr>;
          })}</tbody>
        </table></div>
      </details>;
    })}
    {todo.length > 0 && <p className="small muted mt16">No sessions yet: {todo.map((group) => group.room.name).join(", ")}.</p>}
  </>;
}

function CompleteRuns() {
  const { model } = useApp();
  const runs = model.completeSessions(model.me.id).slice().reverse();
  if (!runs.length) return <Empty>No sessions yet. A session is one VR run through one or more of the {roomCardOrder.length} rooms.</Empty>;
  return runs.map((session, index) => {
    const k = completeSummary(session);
    const previous = runs[index + 1] && completeSummary(runs[index + 1]);
    const critical = k.rs.some((room) => room.recorded && tracksCriticalErrors(room.id));
    return <section className="panel sess-group" key={session.id}>
      <div className="sess-head"><span className="task-icon tone-blue"><Icon name="layers" /></span><div className="grow"><div className="row-heading">Session {session.run}{session.type === "room" ? ` · ${session.title}` : ""}</div><div className="row-sub">{session.date} at {session.timeSeconds} · {k.played} of {roomCardOrder.length} rooms · {session.recording === "Unavailable" ? "not recorded" : "recorded"}</div></div><ResultChip result={k.result} /></div>
      <div className="rc-stats cs-stats">
        <div className="rc-stat"><span>Combined score</span><b>{k.score}%</b><em>{k.pts} of {k.max} points{previous ? ` · ${k.score - previous.score >= 0 ? "+" : ""}${k.score - previous.score} vs last` : ""}</em></div>
        <div className="rc-stat"><span>Duration</span><b>{fmtHms(k.seconds)}</b><em>Across {k.played} room{k.played === 1 ? "" : "s"}</em></div>
        <div className="rc-stat"><span>Rooms passed</span><b>{k.passed} of {k.played}</b><em>≥ {PASS_MARK}% with no critical error</em></div>
        {critical ? <div className="rc-stat"><span>Critical errors</span><b>{k.errors}</b><em>Target 0</em></div> : <div className="rc-stat"><span>Completed</span><b>{session.timeSeconds}</b><em>{session.date}</em></div>}
      </div>
      <div className="flex gap8 mt12" style={{ flexWrap: "wrap" }}><a className="btn primary sm" href={`#/${session.href}`}>{session.type === "room" ? "Room results" : "Combined results"} <Icon name="arrow" /></a>{RECORDINGS_LIVE && session.recording === "Ready" && <a className="btn ghost sm" href={`#/${session.href}`}><Icon name="play" className="ico-sm" /> Watch recording</a>}</div>
    </section>;
  });
}

export default function LearnerSessions() {
  const { model } = useApp();
  const [view, setView] = useState("room");
  const roomCount = model.roomVisitsOf(model.me.id).length;
  const completeCount = model.completeSessions(model.me.id).length;
  const seg = <div className="seg" role="group" aria-label="Session type">
    <button className={view === "room" ? "active" : ""} onClick={() => setView("room")} aria-pressed={view === "room"}><Icon name="map" className="ico-sm" /> By room ({roomCount})</button>
    <button className={view === "complete" ? "active" : ""} onClick={() => setView("complete")} aria-pressed={view === "complete"}><Icon name="layers" className="ico-sm" /> Sessions ({completeCount})</button>
  </div>;
  return <>
    <Heading title="My sessions" description="Every VR session is recorded. See each room's attempts, or whole sessions with every room you played." action={seg} eyebrow="SESSION HISTORY" />
    {view === "room" ? <RoomGroups /> : <CompleteRuns />}
  </>;
}
