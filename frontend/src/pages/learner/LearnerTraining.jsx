import { PASS_MARK, roomById, roomCardOrder, roomCards, roomDetails, roomPoints, roomSteps, roomTotalPoints, tracksCriticalErrors } from "../../content/catalog";
import { Chip, Empty, Heading, Icon, PctBar, Sparkline, StepDetail, VideoPlaceholder } from "../../components/ui";
import { assetUrl } from "../../lib/visual";
import { useApp } from "../../lib/context";
import { fmtClockSeconds, fmtDate, fmtHms } from "../../lib/format";

function roomStatus(progress) {
  return progress === 100 ? ["Complete", "mint"] : progress ? ["In progress", "yellow"] : ["Not started", "gray"];
}

// Without per-step points from the VR app, the points lost (score is a percentage of the
// room's total marks) are spread across steps by how often errors happen there.
function estimatedStepPoints(roomId, stats) {
  const points = roomPoints[roomId].map((step) => step[0]);
  const total = points.reduce((a, b) => a + b, 0);
  const weights = points.map((value, index) => value * (stats.stepErr[index] || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const target = Math.round((stats.score * total) / 100);
  const lost = total - target;
  const earned = points.map((value, index) => Math.max(0, Math.round(value - (lost * weights[index]) / totalWeight)));
  let diff = target - earned.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < 200; i += 1) {
    const k = i % earned.length;
    if (diff > 0 && earned[k] < points[k]) { earned[k] += 1; diff -= 1; } else if (diff < 0 && earned[k] > 0) { earned[k] -= 1; diff += 1; }
  }
  return earned;
}

function stepPoints(roomId, stats, lastEntry) {
  const points = roomPoints[roomId];
  if (lastEntry?.steps?.some((step) => step.points != null)) {
    return points.map(([max], index) => {
      const step = lastEntry.steps.find((item) => item.index === index);
      return Math.min(max, Math.round(step?.points ?? (step?.error ? 0 : max)));
    });
  }
  return stats.stepErr ? estimatedStepPoints(roomId, stats) : null;
}

function RoomTile({ id }) {
  const { model } = useApp();
  const room = roomById[id];
  const card = roomCards[id];
  const stats = model.roomStats(id, model.me.id);
  const { progress } = model.roomProgress(id, model.me.id);
  const [statusWord, statusColor] = roomStatus(progress);
  const n = roomCardOrder.indexOf(id) + 1;
  return <a className="room-tile" href={`#/learner/training?room=${id}`} aria-label={`Step ${n} of ${roomCardOrder.length}: ${room.name}, ${statusWord}`}>
    <div className="room-tile-img" style={{ backgroundImage: `url('${assetUrl(card.image)}')` }}>
      <span className={`tile-num ${progress === 100 ? "done" : progress ? "now" : ""}`} aria-hidden="true">{n}</span>
      <span className={`chip ${statusColor}`}>{statusWord}</span>
      <div className="room-tile-text"><h3>{room.name}</h3><p>{card.purpose}</p></div>
    </div>
    <div className="room-tile-foot"><span>{roomSteps(room).length} steps</span><span>{progress}% complete</span>{stats.sessions > 0 && <span>Score {stats.score}%</span>}<span className="room-tile-go">Details <Icon name="arrow" className="ico-sm" /></span></div>
  </a>;
}

// No walkthrough videos are linked yet, so every room shows the placeholder.
function RoomVideo({ card }) {
  return <VideoPlaceholder image={card.image} label="Process video" message="This process video is not available yet. Follow the process steps above; your VR session guides you through each one." />;
}

function PartHead({ number, title, sub }) {
  return <div className="part-head"><span className="part-num">{number}</span><div><h2>{title}</h2><p>{sub}</p></div></div>;
}

function RoomDetail({ room }) {
  const { model } = useApp();
  const me = model.me;
  const card = roomCards[room.id];
  const stats = model.roomStats(room.id, me.id);
  const progress = model.roomProgress(room.id, me.id);
  const [statusWord, statusColor] = roomStatus(progress.progress);
  const steps = roomSteps(room);
  const detail = roomDetails[room.module]?.detail;
  const seen = stats.sessions > 0;
  const points = roomPoints[room.id];
  const earned = seen ? stepPoints(room.id, stats, progress.last) : null;
  const worst = stats.stepErr ? stats.stepErr.indexOf(Math.max(...stats.stepErr)) : -1;
  const doneCount = progress.done.filter(Boolean).length;
  const n = roomCardOrder.indexOf(room.id) + 1;
  const lastSession = progress.last?.session;
  const totalPoints = roomTotalPoints(room.id);
  const critical = tracksCriticalErrors(room.id);
  const achievements = [
    ["Qualified", progress.progress === 100, "badge"],
    ["Passed first time", Boolean(stats.firstPass), "zap"],
    ["Score 90%+", seen && stats.score >= 90, "trophy"],
  ];
  const stat = (label, value, target, ok) => <div className="rc-stat"><span>{label}</span><b className={seen && ok != null ? (ok ? "ok" : "off") : ""}>{seen ? value : "—"}</b><em>{target}</em></div>;

  return <>
    <a className="btn ghost sm mb16" href="#/learner/training"><Icon name="back" /> All rooms</a>
    <section className="room-hero" style={{ backgroundImage: `url('${assetUrl(card.image)}')` }}><div className="room-hero-text">
      <div className="flex gap8 mb8" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <span className={`tile-num static ${progress.progress === 100 ? "done" : progress.progress ? "now" : ""}`}>{n}</span>
        <span className="chip gray">Step {n} of {roomCardOrder.length}</span><Chip color={statusColor}>{statusWord}</Chip>
      </div>
      <h1>{room.name}</h1><p>{card.purpose}</p>
    </div></section>

    <section className="panel part">
      <PartHead number={1} title="Equipment you will use" sub={`What is in the ${room.name.toLowerCase()} and what you will handle`} />
      <div className="equip-grid">{room.equipment.map((item) => <div className="equip" key={item}><Icon name="settings" /><span>{item}</span></div>)}</div>
    </section>

    <section className="panel part">
      <PartHead number={2} title="Process steps" sub={detail ? `${steps.length} steps in order. Open a step for its actions.` : `${steps.length} steps, in the order you perform them`} />
      <div className="points-key"><span><b>{totalPoints}</b> points in this room</span><span>Pass mark <b>{PASS_MARK}%</b></span>{critical && <span><Icon name="warning" className="ico-sm" /> An error on a <b>critical</b> step fails the attempt ({points.filter((step) => step[1]).length} critical steps)</span>}</div>
      {steps.map((name, index) => {
        const head = <>
          <span className="step-num" style={{ "--color": progress.done[index] ? "var(--mint)" : "var(--yellow)" }}>{index + 1}</span>
          <div className="grow row-heading">{name}{points[index][1] ? <> <span className="crit-tag" title="An error here fails the attempt"><Icon name="warning" className="ico-sm" /> Critical</span></> : null}</div>
          <span className="pts">{points[index][0]} pts</span>
          {progress.done[index] ? <Chip color="mint">Complete</Chip> : <Chip color="gray">Upcoming</Chip>}
        </>;
        return detail
          ? <details className="step-row rd-step" key={name}><summary><div className="flex gap8" style={{ alignItems: "center", flex: 1, minWidth: 0 }}>{head}</div><Icon name="chevrondown" /></summary><StepDetail detail={detail[index]} /></details>
          : <div className="rd-step plain" key={name}><div className="flex gap8" style={{ alignItems: "center" }}>{head}</div></div>;
      })}
    </section>

    <section className="panel part"><PartHead number={3} title="Watch how it is done" sub="A walkthrough of the process before you enter VR" /><RoomVideo card={card} /></section>

    <section className="panel part">
      <PartHead number={4} title="Your progress and results" sub={seen ? `${stats.sessions} session${stats.sessions > 1 ? "s" : ""} recorded · last completed ${fmtDate(stats.completedAt)} at ${fmtClockSeconds(stats.completedAt)}` : "Your results appear here after your first VR session"} />
      <div className="progress-line"><span className="small muted">{doneCount} of {steps.length} steps complete</span><span className="strong">{progress.progress}%</span></div>
      <PctBar value={progress.progress} color={progress.progress === 100 ? "mint" : "yellow"} />
      <div className="rc-stats mt16">
        {stat("Score", `${stats.score}%`, `Pass mark ${PASS_MARK}%`, stats.score >= PASS_MARK)}
        {stat("Duration", fmtHms(stats.seconds), `Latest attempt · target ${card.targetMin} min`, stats.seconds <= card.targetMin * 60)}
        {critical
          ? stat("Critical errors", stats.errors, "Target 0", stats.errors === 0)
          : stat("Completed", seen ? fmtClockSeconds(stats.completedAt) : null, seen ? fmtDate(stats.completedAt) : "Latest attempt", null)}
        {stat("First-time pass", `${stats.pass}%`, "Of first attempts", null)}
      </div>
      <div className="grid cols2even mt16">
        <div>
          <h4 className="room-h">Score trend</h4>
          {seen ? <Sparkline values={stats.trend} firstLabel="First session" lastLabel="Latest" /> : <Empty>Your trend appears after your first session.</Empty>}
          {earned && <>
            <h4 className="room-h">Your points by step · {earned.reduce((a, b) => a + b, 0)} of {totalPoints}</h4>
            {steps.map((name, index) => <div className="err-step" key={name} title={stats.stepErr ? `Errors at this step in ${stats.stepErr[index]}% of your attempts` : undefined}><span className={index === worst ? "worst" : ""}>{index + 1}. {name}</span><div className="room-bar"><i className={earned[index] < points[index][0] ? "lost" : ""} style={{ width: `${(earned[index] / points[index][0]) * 100}%` }} /></div><b>{earned[index]}/{points[index][0]}</b></div>)}
            {stats.stepErr && <p className="tiny muted">Hover a step to see how often you make errors there.</p>}
          </>}
        </div>
        <div>
          <h4 className="room-h">Achievements · {achievements.filter((item) => item[1]).length} of {achievements.length}</h4>
          <div className="ach-grid">{achievements.map(([title, on, icon]) => <div className={`ach ${on ? "on" : ""}`} key={title}><span className="ach-icon"><Icon name={on ? icon : "lock"} /></span><b>{title}</b><span>{on ? "Earned" : "Not earned yet"}</span></div>)}</div>
          {lastSession && <a className="btn primary sm mt16" href={`#/${progress.last.session.rooms.length > 1 ? `session/${lastSession.id}?room=${room.id}` : lastSession.href}`}>View recent assessment <Icon name="arrow" /></a>}
        </div>
      </div>
    </section>
  </>;
}

export default function LearnerTraining({ query }) {
  const { model } = useApp();
  const target = roomById[query.get("room")] || Object.values(roomById).find((room) => room.module && room.module === query.get("module"));
  if (target) return <RoomDetail room={target} key={target.id} />;
  const done = roomCardOrder.filter((id) => model.roomProgress(id, model.me.id).progress === 100).length;
  return <>
    <Heading title="Learning path" description={`${roomCardOrder.length} rooms of the production suite · ${done} complete. Select a room for your results, steps and achievements.`} eyebrow="PRODUCTION SUITE" />
    <div className="room-grid">{roomCardOrder.map((id) => <RoomTile id={id} key={id} />)}</div>
  </>;
}
