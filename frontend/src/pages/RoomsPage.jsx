import { useState } from "react";
import { rooms, roomSteps } from "../content/catalog";
import { Chip, Empty, Heading, Icon, Kpi, Section, Sparkline } from "../components/ui";
import { openOnKey } from "../lib/interaction";
import { useApp } from "../lib/context";
import { goto } from "../lib/router";

const roomMetrics = {
  score: { label: "Average score", short: "Avg score", fmt: (v) => `${v}%`, status: [85, 70] },
  pass: { label: "First-time pass rate", short: "First pass", fmt: (v) => `${v}%`, status: [80, 65] },
  errors: { label: "Critical errors", short: "Errors", fmt: (v) => `${v}` },
  minutes: { label: "Average time in room", short: "Time", fmt: (v) => `${v} min` },
};

function roomTone(metric, value, all) {
  const m = roomMetrics[metric];
  if (value == null) return { fill: "var(--panel2)", word: "No data" };
  if (m.status) {
    const [good, watch] = m.status;
    if (value >= good) return { fill: "color-mix(in srgb,var(--mint) 26%,var(--panel))", word: "Good", tone: "mint" };
    if (value >= watch) return { fill: "color-mix(in srgb,var(--yellow) 24%,var(--panel))", word: "Watch", tone: "yellow" };
    return { fill: "color-mix(in srgb,var(--orange) 30%,var(--panel))", word: "Focus", tone: "orange" };
  }
  const max = Math.max(...all, 1);
  const pct = [12, 24, 38, 54][Math.min(3, Math.floor((value / max) * 3.999))];
  return { fill: `color-mix(in srgb,var(--blue) ${pct}%,var(--panel))` };
}

function FloorPlan({ statsById, metric, selected, onSelect }) {
  const S = 52, P = 14, W = 18 * S + P * 2, H = 8 * S + P * 2 + 46;
  const X = (v) => P + v * S, Y = (v) => P + v * S;
  const values = rooms.map((room) => statsById[room.id][metric]).filter((v) => v != null);
  const arrow = (x, text) => <g className="fp-entry"><path d={`M${X(x)} ${Y(8) + 40} V${Y(8) + 10} m-6 8 6-8 6 8`} /><text x={X(x) + 12} y={Y(8) + 32}>{text}</text></g>;
  return <svg className="floorplan" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Production suite floor plan, rooms coloured by ${roomMetrics[metric].label.toLowerCase()}`}>
    <rect className="fp-corridor" x={X(0) + 3} y={Y(3) + 3} width={18 * S - 6} height={2 * S - 6} rx="6" />
    <text className="fp-sub" x={X(9)} y={Y(4) + 4} textAnchor="middle">Corridor · 2 m</text>
    {rooms.filter((room) => room.door != null).map((room) => <rect key={room.id} className="fp-door" x={X(room.door) - 14} y={(room.y === 0 ? Y(3) : Y(5)) - 4} width="28" height="8" rx="2" />)}
    {rooms.map((room) => {
      const st = statsById[room.id];
      const value = st.sessions ? st[metric] : null;
      const tone = roomTone(metric, value, values);
      const label = value == null ? "No visits" : roomMetrics[metric].fmt(value);
      const cx = X(room.x + room.w / 2);
      const desc = `${room.name} · ${roomMetrics[metric].label}: ${label}${tone.word && value != null ? `, ${tone.word}` : ""}${st.sessions ? ` · ${st.sessions} sessions` : ""}`;
      const select = () => onSelect(room.id);
      return <g key={room.id} className={`fp-room ${room.id === selected ? "selected" : ""}`} tabIndex={0} role="button" aria-label={desc} onClick={select} onKeyDown={openOnKey(select)}>
        <title>{desc}</title>
        <rect x={X(room.x) + 3} y={Y(room.y) + 3} width={room.w * S - 6} height={room.h * S - 6} rx="6" style={{ fill: tone.fill }} />
        {room.booths && <>
          <line className="fp-booth" x1={X(room.x + 2)} y1={Y(room.y + 1.4)} x2={X(room.x + 2)} y2={Y(room.y + 3) - 3} />
          <line className="fp-booth" x1={X(room.x) + 3} y1={Y(room.y + 1.4)} x2={X(room.x + room.w) - 3} y2={Y(room.y + 1.4)} />
          <text className="fp-sub" x={X(room.x + 1)} y={Y(room.y + 2.75)} textAnchor="middle">API</text>
          <text className="fp-sub" x={X(room.x + 3)} y={Y(room.y + 2.75)} textAnchor="middle">Excipients</text>
        </>}
        <text className="fp-name" x={cx} y={Y(room.y) + (room.booths ? 22 : (room.h * S) / 2 - 12)} textAnchor="middle">{room.w < 3 ? room.name.replace(" / ", "/") : room.name}</text>
        <text className="fp-val" x={cx} y={Y(room.y) + (room.booths ? 42 : (room.h * S) / 2 + 12)} textAnchor="middle">{label}</text>
        {tone.word && value != null && <text className="fp-sub" x={cx} y={Y(room.y) + (room.booths ? 58 : (room.h * S) / 2 + 30)} textAnchor="middle">{tone.word}</text>}
        {room.zone === "unclassified" && <text className="fp-sub" x={cx} y={Y(room.y + room.h) - 12} textAnchor="middle">Not clean zone</text>}
      </g>;
    })}
    {arrow(1.8, "Personnel in / out")}
    {arrow(13.6, "Goods in / out")}
  </svg>;
}

export default function RoomsPage({ query }) {
  const { model, view } = useApp();
  const [metric, setMetric] = useState("score");
  const selected = rooms.find((room) => room.id === query.get("room")) || rooms.find((room) => room.id === "granulation");
  const statsById = Object.fromEntries(rooms.map((room) => [room.id, model.roomStats(room.id)]));
  const visited = rooms.filter((room) => statsById[room.id].sessions);
  const totalSessions = visited.reduce((sum, room) => sum + statsById[room.id].sessions, 0);
  const average = totalSessions ? Math.round(visited.reduce((sum, room) => sum + statsById[room.id].score * statsById[room.id].sessions, 0) / totalSessions) : null;
  const focus = visited.filter((room) => statsById[room.id].score < 70);
  const st = statsById[selected.id];
  const steps = roomSteps(selected);
  const worst = st.stepErr ? st.stepErr.indexOf(Math.max(...st.stepErr)) : -1;
  const selectRoom = (id) => goto(`${view}/rooms?room=${id}`);
  const scoreTone = st.sessions ? roomTone("score", st.score) : null;
  const change = st.trend ? st.trend.at(-1) - st.trend[0] : 0;
  const m = roomMetrics[metric];

  return <>
    <Heading title="Rooms & analytics" description="Performance recorded from VR sessions in each room of the production suite." eyebrow="FACILITY" />
    <div className="kpis">
      <Kpi label="Rooms" value={rooms.length} detail={`${visited.length} with recorded sessions`} icon="map" color="blue" />
      <Kpi label="Sessions recorded" value={totalSessions} detail="Room visits, all time" icon="video" color="purple" />
      <Kpi label="Average score" value={average == null ? "—" : `${average}%`} detail="Weighted by sessions" icon="target" color="mint" />
      <Kpi label="Rooms to focus on" value={focus.length} detail={focus.map((room) => room.name).join(", ") || "None below 70%"} icon="alert" color="orange" />
    </div>

    <section className="panel mb22">
      <Section title="Production suite" subtitle="18 m × 8 m · select a room to see its analytics" action={<div className="seg" role="group" aria-label="Colour rooms by">{Object.entries(roomMetrics).map(([key, item]) => <button key={key} className={key === metric ? "active" : ""} onClick={() => setMetric(key)} aria-pressed={key === metric}>{item.short}</button>)}</div>} />
      <div className="fp-wrap"><FloorPlan statsById={statsById} metric={metric} selected={selected.id} onSelect={selectRoom} /></div>
      <div className="fp-legend">
        {m.status ? <>
          <span><i style={{ background: "color-mix(in srgb,var(--mint) 26%,var(--panel))" }} />Good (≥{m.status[0]}%)</span>
          <span><i style={{ background: "color-mix(in srgb,var(--yellow) 24%,var(--panel))" }} />Watch ({m.status[1]}–{m.status[0] - 1}%)</span>
          <span><i style={{ background: "color-mix(in srgb,var(--orange) 30%,var(--panel))" }} />Focus (&lt;{m.status[1]}%)</span>
        </> : <>
          <span><i style={{ background: "color-mix(in srgb,var(--blue) 12%,var(--panel))" }} />Lower</span><span className="fp-ramp" /><span><i style={{ background: "color-mix(in srgb,var(--blue) 54%,var(--panel))" }} />Higher {m.label.toLowerCase()}</span>
        </>}
        <span className="muted">Ceiling height 3.5 m in all rooms, 5 m in Blending.</span>
      </div>
    </section>

    <div className="grid cols2even mb22">
      <section className="panel">
        <div className="section-head"><div><span className="eyebrow">SELECTED ROOM</span><h2 className="room-title">{selected.name}</h2><div className="flex gap8" style={{ flexWrap: "wrap" }}>
          <Chip color={selected.zone === "clean" ? "blue" : "gray"}>{selected.zone === "clean" ? "Clean zone" : "Not a clean zone"}</Chip><Chip>{selected.w} × {selected.h} m</Chip><Chip>Height {selected.height || 3.5} m</Chip>{selected.airlock && <Chip color="purple">Airlock</Chip>}{selected.entry && <Chip>{selected.entry}</Chip>}
        </div></div>{st.sessions > 0 && <a className="btn ghost sm" href={`#/${view}/sessions?room=${selected.id}`}>Sessions <Icon name="arrow" /></a>}</div>
        {st.sessions ? <>
          <div className="room-stats">
            <div><span>Sessions</span><b>{st.sessions}</b><em>{st.learners} learners</em></div>
            <div><span>Avg time in room</span><b>{st.minutes} min</b><em>Per session</em></div>
            <div><span>Avg score</span><b>{st.score}%</b><em><Chip color={scoreTone.tone}>{scoreTone.word}</Chip></em></div>
            <div><span>First-time pass</span><b>{st.pass}%</b><em>Of first attempts</em></div>
            <div><span>Critical errors</span><b>{st.errors}</b><em>Last 6 weeks</em></div>
            <div><span>Most errors at</span><b>{worst >= 0 ? `Step ${worst + 1}` : "—"}</b><em title={steps[worst]}>{worst >= 0 ? steps[worst] : "No step data yet"}</em></div>
          </div>
          <h4 className="room-h">Average score trend</h4>
          <Sparkline values={st.trend} />
          {st.trend.length > 1 && <p className="tiny muted">{change >= 0 ? "Up" : "Down"} {Math.abs(change)} points over {st.trend.length} active weeks.</p>}
        </> : <Empty>No sessions recorded yet.</Empty>}
        <h4 className="room-h">Equipment</h4>
        <ul className="room-equip">{selected.equipment.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="panel">
        <Section title="Process steps in this room" subtitle={st.stepErr ? "Where errors happen" : "Steps the VR scene walks through"} />
        {st.stepErr ? <>
          <div className="room-steps">{steps.map((name, index) => <div className="room-step" key={name}><span className="step-num" style={{ "--color": index === worst ? "var(--orange)" : "var(--muted)" }}>{index + 1}</span><div className="grow"><div className="flex-between"><span>{name}{index === worst && <> <span className="chip orange">Most errors</span></>}</span><b className="tiny">{st.stepErr[index]}%</b></div><div className="room-bar"><i style={{ width: `${(st.stepErr[index] / Math.max(...st.stepErr, 1)) * 100}%` }} /></div></div></div>)}</div>
          <p className="tiny muted mt12">Share of attempts with an error at each step.</p>
        </> : <ol className="room-plain">{steps.map((name) => <li key={name}>{name}</li>)}</ol>}
        {st.top?.length > 0 && <>
          <h4 className="room-h">Most common errors</h4>
          {st.top.map(([text, count]) => <div className="room-err" key={text}><span className="task-icon tone-red" style={{ width: 28, height: 28 }}><Icon name="warning" className="ico-sm" /></span><span className="grow">{text}</span><b>{count}×</b></div>)}
        </>}
        <p className="tiny muted mt16"><Icon name="info" className="ico-sm" /> Reference: {selected.source}</p>
      </section>
    </div>

    <section className="panel mb22">
      <Section title="All rooms" subtitle="Table view of the floor plan data" />
      <div className="table-wrap"><table className="data-table"><thead><tr><th>ROOM</th><th>ZONE</th><th>SESSIONS</th><th>AVG TIME</th><th>AVG SCORE</th><th>FIRST PASS</th><th>CRITICAL ERRORS</th><th>TREND</th></tr></thead><tbody>
        {rooms.map((room) => {
          const s = statsById[room.id];
          const select = () => selectRoom(room.id);
          const delta = s.sessions ? s.trend.at(-1) - s.trend[0] : 0;
          return <tr key={room.id} className={`clickable ${room.id === selected.id ? "row-selected" : ""}`} tabIndex={0} onClick={select} onKeyDown={openOnKey(select)}>
            <td><div className="row-heading">{room.name}</div><div className="row-sub">{room.w} × {room.h} m</div></td><td>{room.zone === "clean" ? "Clean" : "Not clean"}</td>
            {s.sessions ? <><td>{s.sessions}</td><td>{s.minutes} min</td><td><b>{s.score}%</b></td><td>{s.pass}%</td><td>{s.errors}</td><td>{delta >= 0 ? "+" : ""}{delta} pts</td></> : <td colSpan={6} className="muted">Not visited yet</td>}
          </tr>;
        })}
      </tbody></table></div>
    </section>

    <section className="panel"><Section title="What is recorded in each room" subtitle="Data the VR app sends in results.json for every session" />
      <div className="grid cols4 rec-grid">{[["door", "Room time", "Time in each room and the order rooms were visited"], ["checkcircle", "Step results", "Points per step against the room’s process"], ["warning", "Step errors", "Skipped checks and critical errors, with a timestamp in the recording"], ["target", "Assessment", "Room score, pass / fail and attempt number"]].map(([icon, title, text]) => <div className="rec" key={title}><span className="task-icon tone-blue"><Icon name={icon} /></span><b>{title}</b><span className="small muted">{text}</span></div>)}</div>
    </section>
  </>;
}
