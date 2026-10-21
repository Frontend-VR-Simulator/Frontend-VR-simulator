import { Icon, RecordingPlay, ResultChip } from "./ui";
import { colors, scoreColor } from "../lib/visual";
import { openOnKey } from "../lib/interaction";
import { goto } from "../lib/router";
import { withTab } from "../lib/model";

export function SearchInput({ value, onChange, placeholder, label, width = 195 }) {
  return <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} style={{ maxWidth: width, minHeight: 36 }} />;
}

export function SessionsTable({ sessions }) {
  if (!sessions.length) return <div className="empty">No sessions match this view.</div>;
  return <div className="table-wrap"><table className="data-table">
    <thead><tr><th>ROOM / LEARNER</th><th>DATE</th><th>DURATION</th><th>SCORE</th><th>RECORDING</th><th>RESULT</th><th /></tr></thead>
    <tbody>{sessions.map((session) => {
      const open = () => goto(session.href);
      return <tr key={session.href} className="clickable" tabIndex={0} onClick={open} onKeyDown={openOnKey(open)}>
        <td><div className="row-heading">{session.title}</div><div className="row-sub">{session.learner} · Attempt {session.attempt}</div></td>
        <td>{session.date}<div className="row-sub">{session.time}</div></td>
        <td>{session.minutes} min</td>
        <td><b style={{ color: colors[scoreColor(session.score)] }}>{session.score}%</b></td>
        <td><RecordingPlay status={session.recording} onOpen={() => goto(withTab(session.href, "recording"))} /></td>
        <td><ResultChip result={session.result} /></td>
        <td className="pill-arrow"><Icon name="chevron" /></td>
      </tr>;
    })}</tbody>
  </table></div>;
}
