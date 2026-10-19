import { useState } from "react";
import { Avatar, Icon, Logo } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import { useApp } from "../lib/context";
import { roleLabels } from "../lib/model";
import { initials } from "../lib/format";
import { COMPANY } from "../config/company";
import { navItems } from "../lib/nav";

function notificationText(view, model) {
  if (view === "trainer" || view === "manager") {
    const pending = model.pendingReviews().length;
    if (pending) return `${pending} session${pending === 1 ? "" : "s"} waiting for trainer review.`;
  }
  if (view === "learner") {
    const fresh = model.recentNotes.length;
    if (fresh) return `${fresh} new trainer feedback note${fresh === 1 ? "" : "s"} this week.`;
  }
  return "You’re all caught up. No new notifications.";
}

export function AppShell({ page, children }) {
  const { view, model, toast, logout } = useApp();
  const [open, setOpen] = useState(false);
  const me = model.me;
  return <div className="app-shell">
    <header className="app-top">
      <div className="flex gap12" style={{ alignItems: "center" }}>
        <button className="btn ghost icon-only mobile-toggle" aria-label="Open navigation" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
        <a href="#/landing" aria-label="VR Pharma home"><Logo /></a>
      </div>
      <div className="top-actions">
        <ThemeToggle />
        <button className="top-icon" aria-label="Notifications" data-action="notifications" onClick={() => toast(notificationText(view, model))}><Icon name="bell" /></button>
        <div className="profile-area">
          <Avatar text={initials(me.name)} />
          <span className="top-user-name small"><b>{me.name}</b><br /><span className="muted tiny">{roleLabels[view]} · {COMPANY}</span></span>
        </div>
      </div>
    </header>
    <div className={`mobile-shade ${open ? "on" : ""}`} onClick={() => setOpen(false)} />
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="nav-label">Workspace</div>
      {navItems[view].map(([id, label, icon]) => <a key={id} href={`#/${view}/${id}`} onClick={() => setOpen(false)} className={`nav-item ${id === page ? "active" : ""}`} aria-current={id === page ? "page" : undefined}>
        <Icon name={icon} />{label}{view === "trainer" && id === "queue" && <span className="nav-tag">{model.pendingReviews().length}</span>}
      </a>)}
      <div className="sidebar-bottom">
        <a href="#/landing" className="nav-item"><Icon name="external" />Public website</a>
        <a href="#/login" className="nav-item" onClick={(event) => { event.preventDefault(); logout(); }}><Icon name="logout" />Sign out</a>
      </div>
    </aside>
    <main className="app-content">{children}</main>
  </div>;
}
