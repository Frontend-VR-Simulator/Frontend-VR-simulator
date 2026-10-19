import { PASS_MARK, roomById, roomCardOrder } from "../../content/catalog";
import { Empty, Heading, Kpi, ScoreRow, Section } from "../../components/ui";
import { SessionsTable } from "../../components/SessionsTable";
import { useApp } from "../../lib/context";

export default function LearnerProgress() {
  const { model } = useApp();
  const me = model.me;
  const mine = model.sessionsOf(me.id);
  const latestRoomSession = mine.filter((session) => session.type === "room").at(-1);
  const currentRoom = latestRoomSession && roomById[latestRoomSession.module];
  const attempts = currentRoom ? model.roomSessions(currentRoom.id, me.id) : [];
  const latest = mine.at(-1);
  const improvement = attempts.length > 1 ? attempts.at(-1).score - attempts[0].score : null;
  const latestByRoom = roomCardOrder.map((id) => [id, model.roomStats(id, me.id)]).filter(([, stats]) => stats.sessions);

  return <>
    <Heading title="My progress" description="Your latest result and improvement across all attempts." eyebrow="PERFORMANCE" />
    <div className="kpis">
      <Kpi label="Current room completion" value={currentRoom ? `${model.roomProgress(currentRoom.id, me.id).progress}%` : "—"} detail={currentRoom?.name || "No room sessions yet"} icon="target" color="yellow" />
      <Kpi label="Latest attempt score" value={latest ? `${latest.score}%` : "—"} detail={latest ? `${latest.title} · ${latest.date}` : "No sessions yet"} icon="checkcircle" color="blue" />
      <Kpi label="Score improvement" value={improvement == null ? "—" : `${improvement >= 0 ? "+" : ""}${improvement} pts`} detail={improvement == null ? "Needs two attempts in a room" : "From first to latest attempt"} icon="chart" color="purple" />
      <Kpi label="Total VR attempts" value={mine.length} detail="Room and complete sessions" icon="rotate" color="orange" />
    </div>
    <div className="grid cols2 mb22">
      <section className="panel">
        <Section title={currentRoom ? `${currentRoom.name} attempts` : "Room attempts"} subtitle="All attempts remain visible in history" />
        {attempts.length ? <>
          {attempts.slice().reverse().map((session) => <ScoreRow key={session.id} label={`Attempt ${session.attempt}`} sub={session.date} value={session.score} tag={<span className={`score-tag ${session.result === "Pass" ? "ok" : ""}`}>{session.result}</span>} mark={null} ok={session.result === "Pass"} />)}
          <p className="bar-key">Muted bars are attempts that did not pass.</p>
        </> : <Empty>Your attempts appear here after your first room session.</Empty>}
      </section>
      <section className="panel">
        <Section title="Room breakdown" subtitle="Latest assessed score in each room" />
        {latestByRoom.length ? <>
          {latestByRoom.map(([id, stats]) => <ScoreRow key={id} label={roomById[id].name} value={stats.score} tag={stats.score < PASS_MARK ? <span className="score-tag">Below pass mark</span> : null} />)}
          <p className="bar-key"><span className="sbar-mark-key" />Pass mark {PASS_MARK}%</p>
        </> : <Empty>No assessed rooms yet.</Empty>}
      </section>
    </div>
    <section className="panel">
      <Section title="Assessment history" subtitle="Select an attempt to review procedural steps, errors, and video evidence" />
      <SessionsTable sessions={mine.slice().reverse()} />
    </section>
  </>;
}
