import { Icon, Logo, PctBar } from "../components/ui";
import { colors } from "../lib/visual";
import { ThemeToggle } from "../components/ThemeToggle";
import { COMPANY } from "../config/company";

const features = [
  ["headset", "VR training", "Practice realistic pharmaceutical workflows.", "yellow"],
  ["chart", "Progress tracking", "Understand improvement across repeated attempts.", "blue"],
  ["clipboard", "Step-level assessments", "Go from overall results into rooms and procedures.", "orange"],
  ["video", "Session recordings", "Review video evidence and provide informed feedback.", "purple"],
];
const howItWorks = [
  ["Explore", "Follow a clear learning path through departments, rooms, and tasks."],
  ["Practice", "Complete VR sessions at your own pace, as many times as assigned."],
  ["Understand", "See assessed steps, critical errors, and areas that need attention."],
  ["Improve", "Review recordings and trainer feedback before the next attempt."],
];
const personas = [
  ["learner", "Learner", "Track progress, attempts, and personal feedback.", "blue", "book"],
  ["trainer", "Trainer", "Review sessions and coach confidently.", "orange", "clipboard"],
  ["manager", "Training Manager", "Manage programs, cohorts, and completion.", "purple", "users"],
  ["admin", "System Admin", "Oversee people, data, integrations, and video.", "yellow", "settings"],
];
const competencies = [["Aseptic technique", 91, "blue"], ["Equipment handling", 79, "yellow"], ["Procedural compliance", 86, "purple"], ["Safety awareness", 73, "orange"]];

export default function Landing({ signedIn }) {
  const enter = signedIn ? "#/" : "#/login";
  return <>
    <header className="site-header"><div className="site-inner">
      <a href="#/landing"><Logo /></a>
      <nav className="site-links"><a href="#features">Platform</a><a href="#how-it-works">How it works</a><a href="#roles">For teams</a><a href="#recordings">Recordings</a></nav>
      <div className="site-actions"><ThemeToggle className="btn ghost sm icon-only" /><a className="btn ghost sm" href={enter}>{signedIn ? "Workspace" : "Sign in"}</a><a className="btn primary sm" href={enter}>Get started <Icon name="arrow" /></a></div>
    </div></header>

    <section className="marketing-hero"><div className="site-container hero-grid">
      <div className="hero-copy">
        <div className="eyebrow">IMMERSIVE TRAINING • MEASURABLE PROGRESS</div>
        <h1>Real skills.<br /><span>Real impact.</span></h1>
        <p>Pharmaceutical training that goes beyond theory. Practice in VR, improve with every attempt, and see exactly where skills grow.</p>
        <div className="hero-actions"><a className="btn primary" href={enter}>Explore the platform <Icon name="arrow" /></a><a className="btn ghost" href="#recordings">See how it works <Icon name="play" /></a></div>
        <div className="feature-tags">
          <div className="feature-tag"><span className="tag-icon"><Icon name="headset" /></span><div>Immersive VR<br /><span>Industry scenarios</span></div></div>
          <div className="feature-tag"><span className="tag-icon"><Icon name="chart" /></span><div>Clear progress<br /><span>Every learner, every attempt</span></div></div>
          <div className="feature-tag"><span className="tag-icon"><Icon name="video" /></span><div>Session evidence<br /><span>Recordings and feedback</span></div></div>
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-person" role="img" aria-label="Pharmaceutical trainee wearing VR headset" />
        <div className="mockup">
          <div className="mock-title"><span>Training overview</span><span className="chip yellow">{COMPANY}</span></div>
          <div className="mock-tiles"><div className="mock-tile"><strong>248</strong><span>Learners</span></div><div className="mock-tile"><strong style={{ color: "var(--yellow)" }}>82%</strong><span>Completion</span></div><div className="mock-tile"><strong style={{ color: "var(--purple)" }}>86%</strong><span>Avg. score</span></div></div>
          <div className="mock-sect"><div className="mock-graph">{[35, 63, 49, 84, 70, 92].map((v, i) => <i key={i} style={{ height: `${v}%` }} />)}</div><div className="mock-list"><div className="mock-list-row">Aseptic manufacturing <b>86%</b></div><div className="mock-list-row">Cleanroom gowning <b>92%</b></div><div className="mock-list-row">Equipment setup <b>75%</b></div></div></div>
        </div>
      </div>
    </div></section>

    <section className="marketing-section" id="features"><div className="site-container">
      <div className="section-kicker">THE PLATFORM</div>
      <h2 className="marketing-title">Everything trainees need.<br />Nothing they don&apos;t.</h2>
      <p className="marketing-desc mb22">A focused learning management experience with the depth required for industrial VR training — designed around progress, practical performance, and evidence.</p>
      <div className="grid cols4">{features.map(([icon, title, text, color]) => <article className="feature-card" key={title}><div className="feature-ico" style={{ color: colors[color], background: `color-mix(in srgb,${colors[color]} 14%,transparent)` }}><Icon name={icon} className="ico-lg" /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>

    <section className="marketing-section" id="how-it-works"><div className="site-container">
      <div className="section-kicker">HOW IT WORKS</div>
      <h2 className="marketing-title">From first attempt to<br />real-world readiness.</h2>
      <div className="steps mt22">{howItWorks.map(([title, text], i) => <div className="step" key={title}><div className="step-number">{i + 1}</div><h3>{title}</h3><p>{text}</p></div>)}</div>
    </div></section>

    <section className="marketing-section" id="roles"><div className="site-container">
      <div className="section-kicker">ROLE-BASED WORKSPACES</div>
      <h2 className="marketing-title">One platform.<br />Four focused experiences.</h2>
      <div className="grid cols4 mt22">{personas.map(([role, name, text, color, icon]) => <a key={role} href={signedIn ? "#/" : "#/login"} className="persona-card" style={{ "--glow": colors[color], "--tone": colors[color] }}><Icon name={icon} className="ico-lg" /><h3>{name}</h3><p>{text}</p><span className="link">Open workspace <Icon name="arrow" /></span></a>)}</div>
    </div></section>

    <section className="marketing-section" id="recordings"><div className="site-container"><div className="grid cols2" style={{ alignItems: "center" }}>
      <div><div className="section-kicker">SESSION EVIDENCE</div><h2 className="marketing-title">See the attempt.<br />Understand the result.</h2><p className="marketing-desc">Each attempt has its own assessment, recording state, room-level results, and trainer feedback. Nothing gets overwritten when learners improve.</p><a className="btn primary" href={enter}>Explore session review <Icon name="arrow" /></a></div>
      <div className="panel feature-preview">
        <div className="video-poster"><span className="play-disc"><Icon name="play" className="ico-lg" /></span><div className="recording-controls"><PctBar value={48} color="yellow" /><span className="small">12:36 / 26:00</span></div></div>
        <div><div className="panel-title mb16">Competency scores</div>{competencies.map(([name, value, color]) => <div className="skill-item" key={name}><div className="progress-line"><span>{name}</span><b>{value}%</b></div><PctBar value={value} color={color} /></div>)}</div>
      </div>
    </div></div></section>

    <footer className="site-footer"><div className="site-container footer-line">
      <div><Logo /><div className="small mt12">VR-powered pharmaceutical training. © {new Date().getFullYear()} VR Pharma. All rights reserved.</div></div>
      <div><a href="#features">Platform</a><a href="#roles">Workspaces</a><a href={enter}>Sign in</a></div>
    </div></footer>
  </>;
}
