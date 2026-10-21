import { useEffect } from "react";
import { icons } from "./icons";
import { PASS_MARK } from "../content/catalog";
import { assetUrl, colors } from "../lib/visual";
import { RECORDINGS_LIVE } from "../config/features";
import { useApp } from "../lib/context";

const tone = (color) => colors[color] || color;
const clamp = (value) => Math.max(0, Math.min(100, value));

export function Icon({ name, className = "" }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons[name] || icons.info }} />;
}

export function Logo() {
  return <span className="brand" aria-label="SIMQO"><span className="brand-word">SIM<span className="brand-accent">QO</span></span></span>;
}

// The company that owns the product.
export function Owner({ className = "" }) {
  return <span className={`owner-badge ${className}`}>by <img src={assetUrl("linchpin.png")} alt="Linchpin" /></span>;
}

export function PctBar({ value, color = "blue", tiny = false }) {
  const pct = clamp(value);
  return <div className={`progress ${tiny ? "tinybar" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ "--value": `${pct}%`, "--bar": tone(color) }} /></div>;
}

export function Prog({ value, color = "blue" }) {
  return <div className="progress-track"><PctBar value={value} color={color} /><b className="pct" style={{ color: tone(color) }}>{value}%</b></div>;
}

export function Chip({ children, color = "gray" }) {
  return <span className={`chip ${color}`}>{children}</span>;
}

export const ResultChip = ({ result }) => <Chip color={result === "Pass" ? "mint" : result === "Fail" ? "red" : "yellow"}>{result}</Chip>;
export const RecordingChip = ({ status }) => (RECORDINGS_LIVE
  ? <Chip color={status === "Ready" ? "blue" : status === "Processing" ? "purple" : "gray"}>{status}</Chip>
  : <Chip color="purple">Coming soon</Chip>);

// Small play button for the Recording column of session tables. It opens the
// session review at its recording, without opening the row's own link.
export function RecordingPlay({ onOpen, status }) {
  const label = RECORDINGS_LIVE ? `Watch recording (${status})` : "Watch recording";
  return <button className="rec-play" type="button" title={label} aria-label={label} onClick={(event) => { event.stopPropagation(); onOpen(); }} onKeyDown={(event) => event.stopPropagation()}><Icon name="play" /></button>;
}

// A video frame with a play button, shown where a video is not linked yet.
// Pressing play explains that the video is not available instead of doing nothing.
export function VideoPlaceholder({ image, caption, label = caption, message, minHeight }) {
  const { toast } = useApp();
  return <div className="video-box" style={{ ...(minHeight ? { minHeight } : {}), ...(image ? { backgroundImage: `url('${assetUrl(image)}')` } : {}) }}>
    <button className="video-play" type="button" onClick={() => toast(message)} aria-label={`Play ${label.toLowerCase()}`}><Icon name="play" className="ico-lg" /></button>
    {caption && <div className="video-caption"><Icon name="video" className="ico-sm" /> {caption}</div>}
  </div>;
}

// Shown wherever session video would appear until recordings are enabled.
export function RecordingSoon({ image, minHeight = 232 }) {
  return <VideoPlaceholder image={image} minHeight={minHeight} caption="Session recording" message="Session recordings are not available yet. Results and step-by-step scores are already shown." />;
}

export function Thumb({ image, alt = "Training room image" }) {
  return <img className="thumb" src={assetUrl(image)} alt={alt} loading="lazy" />;
}

export function Kpi({ label, value, detail, icon, color }) {
  return <div className="kpi"><span className="kpi-icon" style={{ "--accent": tone(color) }}><Icon name={icon} className="ico-lg" /></span><div style={{ minWidth: 0 }}><div className="kpi-label">{label}</div><div className="kpi-num">{value}</div><div className="kpi-note">{detail}</div></div></div>;
}

export function Section({ title, subtitle, action }) {
  return <div className="section-head"><div><h3 className="panel-title">{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

export function Heading({ title, description, action, eyebrow = "WORKSPACE" }) {
  return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function Avatar({ text, className = "" }) {
  return <span className={`avatar ${className}`}>{text}</span>;
}

export function ScoreBar({ value, mark = PASS_MARK, ok = value >= mark }) {
  return <div className="sbar" role="img" aria-label={`${value}%${mark != null ? `, pass mark ${mark}%` : ""}`}><i className={ok ? "" : "below"} style={{ width: `${clamp(value)}%` }} />{mark != null && <span className="sbar-mark" style={{ left: `${mark}%` }} title={`Pass mark ${mark}%`} />}</div>;
}

export function ScoreRow({ label, sub, value, tag, mark = PASS_MARK, ok }) {
  return <div className="score-row"><div className="progress-line"><span>{label}{sub && <> <span className="row-sub">· {sub}</span></>}</span><span className="score-val"><b>{value}%</b>{tag}</span></div><ScoreBar value={value} mark={mark} ok={ok ?? value >= (mark ?? 0)} /></div>;
}

export function SkillsBlock({ data }) {
  return data.map(([title, value, color]) => <div className="skill-item" key={title}><div className="progress-line"><div className="flex gap8" style={{ alignItems: "center" }}><span className="color-swatch" style={{ "--swatch": tone(color) }} /><span>{title}</span></div><b style={{ color: tone(color) }}>{value}%</b></div><PctBar value={value} color={color} /></div>);
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Sparkline({ values, firstLabel = "6 weeks ago", lastLabel = "This week" }) {
  if (values.length < 2) return <Empty>One data point so far ({values[0]}%). The trend appears after the next session.</Empty>;
  const w = 260, h = 80, p = 8, min = Math.min(...values) - 3, max = Math.max(...values) + 3;
  const x = (i) => p + (i * (w - 2 * p)) / (values.length - 1);
  const y = (v) => h - p - ((v - min) / (max - min)) * (h - 2 * p);
  return <>
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Average score over ${values.length} points, from ${values[0]}% to ${values.at(-1)}%`}>
      <line className="spark-grid" x1={p} x2={w - p} y1={y(values[0])} y2={y(values[0])} />
      <polyline className="spark-line" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {values.map((v, i) => <circle key={i} className={`spark-dot ${i === values.length - 1 ? "last" : ""}`} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 3}><title>{`Point ${i + 1}: ${v}%`}</title></circle>)}
      <text className="spark-label" x={x(values.length - 1) - 8} y={y(values.at(-1)) - 9} textAnchor="end">{values.at(-1)}%</text>
      <text className="spark-label muted" x={x(0) + 2} y={y(values[0]) - 9}>{values[0]}%</text>
    </svg>
    <div className="spark-axis"><span>{firstLabel}</span><span>{lastLabel}</span></div>
  </>;
}

export function StepDetail({ detail, issue }) {
  return <div className="step-detail">
    {issue && <div className="step-issue"><Icon name="warning" className="ico-sm" /> {issue}</div>}
    <h4>Actions</h4><ol>{detail.sub.map((item) => <li key={item}>{item}</li>)}</ol>
    {detail.criteria?.length > 0 && <><h4>Pass criteria</h4><ul className="criteria">{detail.criteria.map((item) => <li key={item}>{item}</li>)}</ul></>}
    {detail.errors?.length > 0 && <><h4>Common errors</h4><ul className="errors">{detail.errors.map((item) => <li key={item}>{item}</li>)}</ul></>}
  </div>;
}

export function Modal({ onClose, label = "Dialog", children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}>{children}</section></div>;
}

export function ModalHead({ title, onClose }) {
  return <div className="flex-between"><h2>{title}</h2><button className="btn ghost icon-only" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>;
}
