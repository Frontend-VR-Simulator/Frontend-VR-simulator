import { PASS_MARK, roomById, roomCardOrder, roomCards, roomName, roomSteps } from "../../content/catalog";
import { Avatar, Chip, Empty, Heading, Icon, Kpi, ResultChip, Section, Thumb } from "../../components/ui";
import { useApp } from "../../lib/context";
import { accountRoleLabels } from "../../lib/model";
import { dateParts, fmtDate, fmtShortDate, greeting, initials, localDate, longToday, plural } from "../../lib/format";
import { goto } from "../../lib/router";

function dueLabel(program) {
  if (program.dueIn == null) return ["Assigned", "gray"];
  if (program.dueIn < 0) return ["Overdue", "red"];
  if (program.dueIn === 0) return ["Due today", "yellow"];
  if (program.dueIn <= 7) return [`Due in ${plural(program.dueIn, "day")}`, "yellow"];
  return [`Due ${fmtShortDate(localDate(program.due_date))}`, "gray"];
}

function qualificationOf(id, progress, assigned) {
  const last = progress.last?.session;
  if (progress.passed) return ["Qualified", "mint", "badge", `Passed ${fmtDate(progress.passedAt)}`];
  if (last && last.result === "Review" && !last.reviewed) return ["Awaiting review", "blue", "clipcheck", `Attempt ${last.attempt} with trainer`];
  if (progress.last) return ["In training", "yellow", "clock", `Latest score ${Math.round(progress.last.score)}% · ${progress.progress}% of steps`];
  const program = assigned.get(id);
  return ["Assigned", "gray", "calendar", program?.due_date ? `Due ${fmtDate(localDate(program.due_date))}` : "Not started"];
}

export default function LearnerHome() {
  const { model } = useApp();
  const me = model.me;
  const progress = Object.fromEntries(roomCardOrder.map((id) => [id, model.roomProgress(id, me.id)]));
  const roomsDone = roomCardOrder.filter((id) => progress[id].progress === 100).length;
  const recent = model.sessionsOf(me.id).slice().reverse().slice(0, 4);

  const programs = model.programs;
  const open = programs.filter((program) => program.completion < 100);
  const overdue = open.filter((program) => program.dueIn != null && program.dueIn < 0);
  const dueThisWeek = open.filter((program) => program.dueIn != null && program.dueIn >= 0 && program.dueIn <= 7).sort((a, b) => a.dueIn - b.dueIn);
  const upcoming = open.filter((program) => program.dueIn != null && program.dueIn >= 0).sort((a, b) => a.dueIn - b.dueIn).slice(0, 3);
  const assigned = new Map();
  for (const program of programs) for (const roomId of program.room_ids) if (!assigned.has(roomId)) assigned.set(roomId, program);

  const currentId = roomCardOrder.find((id) => progress[id].progress > 0 && progress[id].progress < 100) || roomCardOrder.find((id) => progress[id].progress < 100);
  const current = currentId && roomById[currentId];
  const steps = current ? roomSteps(current) : [];
  const currentStep = current ? Math.max(0, progress[currentId].done.findIndex((done) => !done)) : 0;
  const lastEntry = current && progress[currentId].last;

  const notes = model.allNotes();
  const tasks = [
    ...open.map((program) => {
      const [state, tone] = dueLabel(program);
      return { key: program.id, title: program.title, meta: `${plural(program.room_ids.length, "room")} · ${program.completion}% complete`, state, tone, icon: tone === "red" ? "grad" : "headset", href: `#/learner/training?room=${program.room_ids.find((id) => !model.passedRooms(me.id).has(id)) || program.room_ids[0]}` };
    }),
    ...model.recentNotes.map((note) => {
      const session = model.sessionById.get(note.sessionId);
      return { key: note.id, title: `Trainer feedback on ${session?.title ?? "a session"}, attempt ${session?.attempt ?? ""}`, meta: note.author, state: "New", tone: "blue", icon: "message", href: `#/session/${note.sessionId}` };
    }),
  ].slice(0, 5);
  const quals = roomCardOrder.filter((id) => progress[id].last || assigned.has(id)).slice(0, 6);
  const latestNote = notes[0];
  const latestNoteSession = latestNote && model.sessionById.get(latestNote.sessionId);

  return <>
    <Heading title={`${greeting()}, ${me.name.split(" ")[0]}`} description={`${longToday()} · ${me.batch ? (/^batch\b/i.test(me.batch) ? me.batch : `Batch ${me.batch}`) : "Trainee"}${model.trainer ? ` · Trainer ${model.trainer.name}` : ""}`} action={<a className="btn ghost sm" href="#/learner/progress">My progress <Icon name="arrow" /></a>} eyebrow="LEARNER DASHBOARD" />
    <div className="kpis">
      <Kpi label="Assigned training" value={programs.length} detail={`${programs.length - open.length} completed`} icon="book" color="blue" />
      <Kpi label="Due this week" value={dueThisWeek.length} detail={dueThisWeek[0] ? `Next: ${dueThisWeek[0].title}, ${fmtShortDate(localDate(dueThisWeek[0].due_date))}` : "Nothing due in the next 7 days"} icon="calendar" color="yellow" />
      <Kpi label="Overdue" value={overdue.length} detail={overdue[0]?.title || "Nothing overdue"} icon="alert" color="red" />
      <Kpi label="Rooms complete" value={`${roomsDone} of ${roomCardOrder.length}`} detail="Production suite learning path" icon="award" color="mint" />
    </div>

    <div className="grid cols2 mb22">
      <div className="panel-hero"><div style={{ position: "relative", zIndex: 2 }}>
        {current ? <>
          <div className="eyebrow">{lastEntry ? "CONTINUE TRAINING" : "START TRAINING"}</div>
          <h2>{current.name}</h2>
          <p>{lastEntry
            ? <>Next step: <b>{steps[currentStep]}</b>. Your last attempt scored {Math.round(lastEntry.score)}% ({lastEntry.session.result}). A pass needs {PASS_MARK}% with no critical errors.</>
            : <>Start with step 1: <b>{steps[0]}</b>. {roomCards[current.id].purpose}</>}</p>
          <div className="step-dots" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>{steps.map((name, index) => <span key={index} className={progress[current.id].done[index] ? "done" : index === currentStep ? "now" : ""} title={name} />)}<em>Step {currentStep + 1} of {steps.length}</em></div>
          <div className="flex gap8" style={{ flexWrap: "wrap" }}>
            <a className="btn primary" href={`#/learner/training?room=${current.id}`}>{lastEntry ? "Continue room" : "Open room"} <Icon name="arrow" /></a>
            {lastEntry && <a className="btn ghost" href={`#/session/${lastEntry.session.id}`}>Review last attempt</a>}
          </div>
        </> : <>
          <div className="eyebrow">LEARNING PATH COMPLETE</div>
          <h2>Every room passed</h2>
          <p>You have passed all {roomCardOrder.length} rooms of the production suite. Keep practising complete runs to stay sharp.</p>
          <div className="flex gap8"><a className="btn primary" href="#/learner/sessions">My sessions <Icon name="arrow" /></a></div>
        </>}
      </div></div>

      <section className="panel">
        <Section title="Upcoming deadlines" subtitle="Assigned training due soon" action={<a className="link" href="#/learner/training">Training path <Icon name="arrow" /></a>} />
        {upcoming.length ? upcoming.map((program) => {
          const parts = dateParts(localDate(program.due_date));
          return <div className="booking" key={program.id}>
            <div className="date-block"><span>{parts.day}</span><b>{parts.date}</b><span>{parts.month}</span></div>
            <div className="grow"><div className="row-heading">{program.title}</div><div className="row-sub"><Icon name="clock" className="ico-sm" /> {dueLabel(program)[0]} · {program.completion}% complete</div><div className="row-sub"><Icon name="pin" className="ico-sm" /> {program.room_ids.map(roomName).join(", ")}</div></div>
          </div>;
        }) : <Empty>No upcoming deadlines.</Empty>}
        <p className="tiny muted mt12">A room counts as complete once you pass it with no critical errors.</p>
      </section>
    </div>

    <div className="grid cols2 mb22">
      <section className="panel">
        <Section title="To do" subtitle="Assigned by your training manager" action={overdue.length ? <span className="chip red">{overdue.length} overdue</span> : null} />
        {tasks.length ? tasks.map((task) => <a className="task" key={task.key} href={task.href}><span className={`task-icon tone-${task.tone === "gray" ? "blue" : task.tone}`}><Icon name={task.icon} /></span><div className="grow"><div className="row-heading">{task.title}</div><div className="row-sub">{task.meta}</div></div><Chip color={task.tone}>{task.state}</Chip></a>) : <Empty>Nothing to do right now.</Empty>}
      </section>
      <section className="panel">
        <Section title="My qualifications" subtitle="Training matrix status" action={<a className="link" href="#/learner/training">Training path <Icon name="arrow" /></a>} />
        {quals.length ? quals.map((id) => {
          const [state, tone, icon, detail] = qualificationOf(id, progress[id], assigned);
          return <a className="qual" key={id} href={`#/learner/training?room=${id}`}><Thumb image={roomCards[id].image} /><div className="grow"><div className="row-heading">{roomById[id].name}</div><div className="row-sub">{detail}</div></div><span className={`chip ${tone}`}><Icon name={icon} className="ico-sm" /> {state}</span></a>;
        }) : <Empty>Your qualifications appear after your first VR session.</Empty>}
      </section>
    </div>

    <div className="grid cols2">
      <section className="panel">
        <Section title="Recent results" subtitle="Your last assessed VR attempts" action={<a className="link" href="#/learner/sessions">History <Icon name="arrow" /></a>} />
        {recent.length ? <div className="results">{recent.map((session) => <button className="result-row" key={session.id} onClick={() => goto(`session/${session.id}`)}>
          <div className="grow"><div className="row-heading">{session.title} <span className="row-sub">· {session.label || `Attempt ${session.attempt}`}</span></div><div className="row-sub">{session.date} · {session.minutes} min{session.errors ? ` · ${plural(session.errors, "critical error")}` : ""}</div></div>
          <b className="score">{session.score}%</b><ResultChip result={session.result} />
        </button>)}</div> : <Empty>Your results appear here after your first VR session.</Empty>}
      </section>
      <section className="panel">
        <Section title="Latest trainer feedback" subtitle={latestNoteSession ? `${latestNoteSession.title} · Attempt ${latestNoteSession.attempt} · ${fmtShortDate(latestNote.createdAt)}` : "Notes from your trainer"} />
        {latestNote ? <>
          <figure className="feedback"><blockquote>{latestNote.text}</blockquote><figcaption><Avatar text={initials(latestNote.author)} /><div><b>{latestNote.author}</b><div className="row-sub">{accountRoleLabels[latestNote.authorRole] || "Trainer"}</div></div></figcaption></figure>
          <div className="flex gap8 mt16" style={{ flexWrap: "wrap" }}>
            <a className="btn ghost sm" href={`#/session/${latestNote.sessionId}`}>Open attempt <Icon name="arrow" /></a>
            {latestNoteSession?.module && <a className="btn ghost sm" href={`#/learner/training?room=${latestNoteSession.module}`}>Review room steps</a>}
          </div>
        </> : <Empty>No trainer feedback yet.</Empty>}
      </section>
    </div>
  </>;
}
