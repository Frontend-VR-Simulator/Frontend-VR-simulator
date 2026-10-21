import { useRef, useState } from "react";
import { PASS_MARK, roomById, roomCardOrder, roomCards, roomDetails, roomSteps } from "../content/catalog";
import { Chip, Empty, Heading, Icon, Kpi, PctBar, RecordingChip, RecordingSoon, ResultChip, ScoreBar, Section, SkillsBlock, StepDetail } from "../components/ui";
import { RECORDINGS_LIVE } from "../config/features";
import { assetUrl, colors, scoreColor } from "../lib/visual";
import { useApp } from "../lib/context";
import { errorMessage } from "../lib/api";
import { completeSummary, SERIES_COLORS } from "../lib/model";
import { fmtMin, fmtSeconds, plural } from "../lib/format";

const backHref = (view) => `#/${view}/${view === "trainer" ? "queue" : "sessions"}`;

// Loads a short-lived signed URL on demand and seeks once the video's metadata is ready.
function useRecording(session) {
  const { api, toast } = useApp();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const pendingSeek = useRef(null);

  function seek(seconds) {
    const video = videoRef.current;
    if (!video) return;
    if (seconds != null) video.currentTime = seconds;
    video.play().catch(() => undefined);
  }

  async function play(seconds = null) {
    if (session.recording !== "Ready") { toast(session.recording === "Processing" ? "The recording is still uploading from the VR launcher." : "No recording is available for this session."); return; }
    if (url) { seek(seconds); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/vr/sessions/${session.id}/recording`);
      pendingSeek.current = seconds;
      setUrl(data.url);
    } catch (error) {
      toast(errorMessage(error, "Could not open the recording."));
    } finally {
      setLoading(false);
    }
  }

  const videoProps = {
    ref: videoRef,
    src: url || undefined,
    controls: true,
    playsInline: true,
    onLoadedMetadata: () => { seek(pendingSeek.current); pendingSeek.current = null; },
    onError: () => { setUrl(null); toast("The recording link expired or could not be played. Press play to try again."); },
  };
  return { url, loading, play, videoProps };
}

function NotesPanel({ session }) {
  const { api, reload, toast, model } = useApp();
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("learner");
  const [saving, setSaving] = useState(false);
  if (model.me.role === "trainee") return null;
  async function save() {
    if (!text.trim()) { toast("Write a short note before saving."); return; }
    setSaving(true);
    try {
      await api.post(`/vr/sessions/${session.id}/feedback`, { body: text.trim(), visibility });
      setText("");
      await reload();
      toast("Feedback saved. The session is marked as reviewed.");
    } catch (error) {
      toast(errorMessage(error, "Could not save feedback."));
    } finally {
      setSaving(false);
    }
  }
  return <section className="panel">
    <Section title="Trainer notes" subtitle="Add feedback to this attempt" />
    <label className="tiny muted" htmlFor="feedback-text">Feedback</label>
    <textarea className="input feedback-input mt12" id="feedback-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder="What went well? Which step needs more practice?" />
    <div className="flex-between mt12">
      <select className="select" aria-label="Note visibility" style={{ maxWidth: 170, minHeight: 37 }} value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="learner">Visible to learner</option><option value="private">Private trainer note</option></select>
      <button className="btn primary sm" onClick={save} disabled={saving}>{saving ? "Saving…" : <>Add feedback <Icon name="arrow" /></>}</button>
    </div>
  </section>;
}

function NotesList({ notes }) {
  return notes.length ? notes.map((note) => <div className="note" key={note.id}>{note.text}<div className="row-sub mt12">{note.author} · {note.date} · {note.visibility}</div></div>) : <div className="empty">No trainer notes added yet.</div>;
}

function VideoStatus({ session }) {
  if (!RECORDINGS_LIVE) return null;
  const duration = session.recordingSeconds || session.minutes * 60;
  return <section className="panel">
    <Section title="Video status" subtitle="Separate from assessment result" />
    <div className="flex-between"><div className="row-heading">Media asset</div><RecordingChip status={session.recording} /></div>
    <p className="small mt12">{session.recording === "Ready"
      ? `Asset REC-${session.id.slice(0, 8).toUpperCase()}-${session.attempt} · ${fmtSeconds(duration)} · stored in the private recording library. Playback links expire after one hour.`
      : session.recording === "Processing"
        ? "Results received. The VR launcher is uploading the video; it appears here when the upload completes."
        : "No recording was uploaded for this attempt."}</p>
  </section>;
}

function RoomReview({ session }) {
  const { model, view } = useApp();
  const [tab, setTab] = useState("assessment");
  const recording = useRecording(session);
  const room = roomById[session.module];
  const entry = session.rooms[0] || {};
  const steps = room ? roomSteps(room) : [];
  const detail = room && roomDetails[room.module]?.detail;
  const attempts = model.roomSessions(session.module, session.traineeId);
  const parent = session.session && session.session.rooms.length > 1 ? session.session : null;
  const notes = model.notes(session.id);
  const hasSteps = entry.steps?.length > 0;
  const duration = session.recordingSeconds || session.minutes * 60 || 1;
  const markers = (entry.steps || []).filter((step) => step.timestampSeconds != null).map((step) => ({ at: step.timestampSeconds, error: Boolean(step.error), label: `${step.index + 1}. ${steps[step.index] || step.name || "Step"}${step.error ? ` · ${step.error}` : ""}` }));
  const competencies = entry.competencies?.length
    ? entry.competencies.map((item, index) => [item.name, Math.round(item.score), SERIES_COLORS[index % 4]])
    : hasSteps && entry.steps.some((step) => step.maxPoints)
      ? entry.steps.filter((step) => step.maxPoints).map((step, index) => [steps[step.index] || step.name || `Step ${step.index + 1}`, Math.round((100 * (step.points ?? 0)) / step.maxPoints), SERIES_COLORS[index % 4]])
      : null;

  return <>
    <Heading title={session.title} description={`${session.learner} · Attempt ${session.attempt} · ${session.date} at ${session.time}${parent ? ` · part of ${parent.label}` : ""}`} action={<div className="flex gap8">{parent && <a className="btn ghost sm" href={`#/${parent.href}`}><Icon name="layers" /> Whole session</a>}<a className="btn ghost sm" href={backHref(view)}><Icon name="back" /> Back to sessions</a></div>} eyebrow="VR SESSION REVIEW" />
    <div className="kpis">
      <Kpi label="Assessment score" value={`${session.score}%`} detail={entry.maxPoints ? `${entry.points} of ${entry.maxPoints} points` : "VR-generated score"} icon="target" color="yellow" />
      <Kpi label="Attempt" value={session.attempt} detail={`${plural(attempts.length, "attempt")} on record`} icon="rotate" color="blue" />
      <Kpi label="Critical errors" value={session.errors} detail="Errors recorded in session" icon="warning" color="orange" />
      <Kpi label="Recording" value={RECORDINGS_LIVE ? session.recording : "Coming soon"} detail={!RECORDINGS_LIVE ? "Session video in a later release" : session.recording === "Ready" ? "Video available" : session.recording === "Processing" ? "Video uploading" : "No video captured"} icon="video" color="purple" />
    </div>
    <div className="review-grid">
      <div className="stack">
        <section className="panel">
          <div className="section-head"><div><h3 className="panel-title">Session recording</h3><p>{session.date} · {session.minutes} minutes{RECORDINGS_LIVE ? ` · ${session.recording}` : ""}</p></div><RecordingChip status={session.recording} /></div>
          {!RECORDINGS_LIVE ? <RecordingSoon image={room && roomCards[room.id]?.image} minHeight={300} /> : <div className="player">
            {recording.url ? <video {...recording.videoProps} /> : session.recording === "Ready" ? <>
              <div className="player-poster"><button className="player-action" aria-label="Play recording" onClick={() => recording.play()} disabled={recording.loading}><Icon name={recording.loading ? "clock" : "play"} className="ico-lg" /></button></div>
              <div className="player-overlay">
                <div className="timeline">{markers.map((marker) => <button key={marker.label} className="marker" style={{ left: `${Math.min(99, (100 * marker.at) / duration)}%`, "--mark": marker.error ? colors.red : colors.blue }} onClick={() => recording.play(marker.at)} title={`${fmtSeconds(marker.at)} · ${marker.label}`} aria-label={`Jump to ${fmtSeconds(marker.at)}`} />)}</div>
                <div className="player-meta"><span><Icon name="play" className="ico-sm" /> Session recording</span><span>{fmtSeconds(duration)}</span></div>
              </div>
            </> : <div className="player-poster no-video"><div style={{ textAlign: "center", padding: 20 }}><div style={{ color: "var(--yellow)" }}><Icon name={session.recording === "Processing" ? "clock" : "warning"} className="ico-lg" /></div><h3>{session.recording === "Processing" ? "Recording is uploading" : "Recording is unavailable"}</h3><p className="small">The assessment can still be reviewed without video.</p></div></div>}
          </div>}
          {RECORDINGS_LIVE && markers.length > 0 && session.recording === "Ready" && <div className="chapters"><span className="small muted">Jump to:</span>{markers.filter((marker) => marker.error).concat(markers.filter((marker) => !marker.error)).slice(0, 8).map((marker) => <button key={marker.label} className="chapter" onClick={() => recording.play(marker.at)}>{marker.error && <Icon name="warning" className="ico-sm" />} {marker.label.split(" · ")[0]} <em>{fmtSeconds(marker.at)}</em></button>)}</div>}
          {RECORDINGS_LIVE && session.recording === "Ready" && <div className="marker-legend">{[["Step change", "blue"], ["Error", "red"]].map(([name, color]) => <span key={name}><i className="legend-dot" style={{ "--color": colors[color] }} />{name}</span>)}</div>}
        </section>
        <div className="grid cols2even">
          <section className="panel">
            <Section title="Performance summary" subtitle="VR-generated assessment" />
            <div style={{ fontSize: 45, letterSpacing: "-.05em", fontWeight: 800, color: colors[scoreColor(session.score)] }}>{session.score}%</div>
            <PctBar value={session.score} color={scoreColor(session.score)} />
            <div className="divider" />
            <div className="flex-between"><span className="muted small">Final outcome</span><ResultChip result={session.result} /></div>
            <div className="flex-between mt12"><span className="muted small">Critical errors</span><b>{session.errors}</b></div>
            <div className="flex-between mt12"><span className="muted small">Time in room</span><b>{session.minutes} min{room ? ` · target ${roomCards[room.id].targetMin}` : ""}</b></div>
          </section>
          <section className="panel">
            <Section title="Competency scores" subtitle={entry.competencies?.length ? "Assessment by skill" : "Points earned by step"} />
            {competencies ? <SkillsBlock data={competencies} /> : <Empty>The VR app did not send a skill breakdown for this session.</Empty>}
          </section>
        </div>
        <section className="panel">
          <Section title="Previous attempts" subtitle={`${plural(attempts.length, "recorded attempt")} for this room`} />
          <div className="attempts">{attempts.map((attempt) => <a key={attempt.id} className={`attempt-card ${attempt.href === session.href ? "current" : ""}`} href={`#/${attempt.href}`}><span className="small">Attempt {attempt.attempt}</span><b>{attempt.score}%</b><span className="tiny muted">{attempt.date}</span><div className="mt12"><PctBar value={attempt.score} color={scoreColor(attempt.score)} tiny /></div></a>)}</div>
        </section>
      </div>
      <div className="stack">
        <section className="panel">
          <div className="tabs mb16"><button className={`tab ${tab === "assessment" ? "active" : ""}`} onClick={() => setTab("assessment")}>Assessment</button><button className={`tab ${tab === "notes" ? "active" : ""}`} onClick={() => setTab("notes")}>Feedback ({notes.length})</button></div>
          {tab === "assessment" ? <>
            <Section title="Step-by-step results" subtitle={hasSteps ? "Room and procedure milestones" : "The VR app did not send step results for this session"} />
            {steps.map((name, index) => {
              const issue = session.issues[index];
              const step = entry.steps?.find((item) => item.index === index);
              const color = issue ? (step?.critical ? "red" : "orange") : step ? "mint" : "gray";
              const summary = <summary><div className="flex gap8" style={{ alignItems: "center" }}><span className="step-num" style={{ "--color": colors[color] || "var(--muted)" }}>{index + 1}</span><span className="row-heading">{name}</span></div><div className="flex gap8" style={{ alignItems: "center" }}>{issue ? <Chip color={color}>{step?.critical ? "Critical" : "Flagged"}</Chip> : step ? <Chip color="mint">Passed</Chip> : null}<Icon name="chevrondown" /></div></summary>;
              return <details className="step-row" key={name} open={Boolean(issue)}>
                {summary}
                {detail ? <StepDetail detail={detail[index]} issue={issue} /> : <>
                  <p>{issue ? `Procedural deviation: ${issue}` : step ? "Step completed within the assessment criteria." : "No result recorded for this step."}</p>
                  <p className="tiny muted">{room?.name} · Step {index + 1}{step?.maxPoints ? ` · ${step.points ?? 0} of ${step.maxPoints} points` : ""}{RECORDINGS_LIVE && step?.timestampSeconds != null ? ` · at ${fmtSeconds(step.timestampSeconds)} in the recording` : ""}</p>
                </>}
              </details>;
            })}
          </> : <><Section title="Trainer feedback" subtitle={plural(notes.length, "note")} /><NotesList notes={notes} /></>}
        </section>
        <NotesPanel session={session} />
        <VideoStatus session={session} />
      </div>
    </div>
  </>;
}

function CompleteReview({ session }) {
  const { model, view } = useApp();
  const recording = useRecording(session);
  const runs = model.completeSessions(session.traineeId);
  const index = runs.findIndex((run) => run.id === session.id);
  const k = completeSummary(session);
  const previous = index > 0 && completeSummary(runs[index - 1]);
  const notes = model.notes(session.id);
  // Without explicit offsets from the VR app, rooms are assumed back to back in the recording.
  const chapters = k.rs.map((room, index) => ({ ...room, at: room.offset ?? k.rs.slice(0, index).reduce((sum, item) => sum + item.minutes, 0) * 60 }));
  const weakest = k.rs.filter((room) => room.recorded).slice().sort((a, b) => a.score - b.score).slice(0, 3);
  const roomHref = (id) => (view === "learner" ? `#/learner/training?room=${id}` : `#/${view}/rooms?room=${id}`);
  const delta = (a, b) => `${a - b >= 0 ? "+" : ""}${a - b}`;

  return <>
    <Heading title={`Complete session · ${session.label}`} description={`${session.learner} · ${session.date} at ${session.time} · ${k.played} of ${roomCardOrder.length} rooms`} action={<a className="btn ghost sm" href={backHref(view)}><Icon name="back" /> Back to sessions</a>} eyebrow="COMBINED RESULTS" />
    <div className="kpis">
      <Kpi label="Combined score" value={`${k.score}%`} detail={`${k.pts} of ${k.max} points`} icon="target" color="yellow" />
      <Kpi label="Rooms passed" value={`${k.passed} of ${k.played}`} detail={`≥ ${PASS_MARK}% with no critical error`} icon="checkcircle" color="mint" />
      <Kpi label="Critical errors" value={k.errors} detail="Across all rooms" icon="warning" color="orange" />
      <Kpi label="Total time" value={fmtMin(k.minutes)} detail="Whole session" icon="clock" color="blue" />
    </div>
    <div className="grid cols2even mb22">
      <section className="panel">
        <Section title="Session recording" subtitle={`${fmtMin(k.minutes)} · one recording for the whole session`} action={<RecordingChip status={session.recording} />} />
        {!RECORDINGS_LIVE ? <RecordingSoon image={roomCards.gowning.image} /> : <>
        <div className={`video-box ${recording.url ? "playing" : ""}`} style={{ backgroundImage: `url('${assetUrl(roomCards.gowning.image)}')` }}>
          {recording.url ? <video {...recording.videoProps} /> : <>
            <button className="video-play" onClick={() => recording.play()} aria-label="Play recording" disabled={recording.loading}><Icon name={recording.loading ? "clock" : "play"} className="ico-lg" /></button>
            <div className="video-caption"><Icon name="video" className="ico-sm" /> {session.recording === "Ready" ? "Session recording" : session.recording === "Processing" ? "Recording is uploading" : "Recording unavailable"}</div>
          </>}
        </div>
        <div className="chapters">{chapters.filter((room) => room.recorded).map((room) => <button className="chapter" key={room.id} onClick={() => recording.play(room.at)}>{roomCardOrder.indexOf(room.id) + 1}. {roomById[room.id].name} <em>{fmtSeconds(room.at)}</em></button>)}</div>
        </>}
      </section>
      <section className="panel">
        <Section title="Focus next" subtitle="The three lowest rooms in this run" />
        {weakest.map((room) => <a className="qual" key={room.id} href={roomHref(room.id)}><img className="thumb" src={assetUrl(roomCards[room.id].image)} alt="" loading="lazy" /><div className="grow"><div className="row-heading">{roomById[room.id].name}</div><div className="row-sub">{room.score}%{room.errors ? ` · ${plural(room.errors, "critical error")}` : ""}</div></div><Chip>Open room</Chip></a>)}
        {previous && <><h4 className="room-h">Compared with the previous complete session</h4><p className="small">Combined score {previous.score}% → <b>{k.score}%</b> ({delta(k.score, previous.score)} points). Rooms passed {previous.passed} → <b>{k.passed}</b>. Critical errors {previous.errors} → <b>{k.errors}</b>.</p></>}
        <h4 className="room-h">Trainer feedback</h4>
        <NotesList notes={notes} />
      </section>
    </div>
    <section className="panel mb22">
      <Section title="Results by room" subtitle="Each room is scored on its own points; open a room for its step results" action={<span className="bar-key" style={{ margin: 0 }}><span className="sbar-mark-key" />Pass mark {PASS_MARK}%</span>} />
      <div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>ROOM</th><th style={{ minWidth: 200 }}>SCORE</th><th>POINTS</th><th>TIME</th><th>CRITICAL ERRORS</th>{previous && <th>VS PREVIOUS</th>}<th>RESULT</th></tr></thead><tbody>
        {k.rs.map((room, j) => {
          const ok = room.score >= PASS_MARK && !room.errors;
          return <tr key={room.id}><td>{j + 1}</td><td>{room.recorded ? <a className="row-heading" href={`#/session/${session.id}?room=${room.id}`}>{roomById[room.id].name}</a> : <span className="row-heading muted">{roomById[room.id].name}</span>}</td><td>{room.recorded ? <ScoreBar value={room.score} mark={PASS_MARK} ok={ok} /> : <span className="muted">–</span>}</td><td>{room.recorded ? <><b>{room.points}</b>/{room.maxPoints}</> : "–"}</td><td>{room.recorded ? `${room.minutes} min` : "–"}<div className="row-sub">Target {roomCards[room.id].targetMin}</div></td><td>{room.recorded ? room.errors : "–"}</td>{previous && <td>{room.recorded && previous.rs[j].recorded ? delta(room.score, previous.rs[j].score) : "–"}</td>}<td>{room.recorded ? <ResultChip result={ok ? "Pass" : "Fail"} /> : <Chip>Not played</Chip>}</td></tr>;
        })}
        <tr className="total-row"><td /><td><b>Combined</b></td><td><ScoreBar value={k.score} mark={PASS_MARK} ok={k.result === "Pass"} /></td><td><b>{k.pts}</b>/{k.max}</td><td>{fmtMin(k.minutes)}</td><td>{k.errors}</td>{previous && <td>{delta(k.score, previous.score)}</td>}<td><ResultChip result={k.result} /></td></tr>
      </tbody></table></div>
    </section>
    <div className="grid cols2even"><NotesPanel session={session} /><VideoStatus session={session} /></div>
  </>;
}

export default function SessionReview({ id, room }) {
  const { model } = useApp();
  const session = model.sessionById.get(id);
  const visit = session && room ? model.roomVisit(session, room) : null;
  if (visit) return <RoomReview session={visit} key={`${session.id}-${room}`} />;
  if (!session) return <><Heading title="Session not found" description="This session does not exist or you do not have access to it." eyebrow="VR SESSION REVIEW" /><Empty>Check the link, or open the session from your session history.</Empty></>;
  return session.type === "complete" ? <CompleteReview session={session} key={session.id} /> : <RoomReview session={session} key={session.id} />;
}
