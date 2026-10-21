import { AppShell } from "../components/AppShell";
import { navItems } from "../lib/nav";
import { useApp } from "../lib/context";
import LearnerHome from "./learner/LearnerHome";
import LearnerTraining from "./learner/LearnerTraining";
import LearnerSessions from "./learner/LearnerSessions";
import LearnerProgress from "./learner/LearnerProgress";
import { LearnersPage, SessionsPage, TrainerAnalytics, TrainerHome, TrainerQueue } from "./trainer/TrainerPages";
import { ManagerAssignments, ManagerHome, ManagerPrograms, ManagerReports } from "./manager/ManagerPages";
import { AdminAudit, AdminHome, AdminIntegrations, AdminRecordings, AdminUsers } from "./admin/AdminPages";
import RoomsPage from "./RoomsPage";
import SessionReview from "./SessionReview";

const pages = {
  learner: { overview: LearnerHome, training: LearnerTraining, sessions: LearnerSessions, progress: LearnerProgress },
  trainer: { overview: TrainerHome, queue: TrainerQueue, learners: LearnersPage, recordings: (props) => <SessionsPage onlyRecordings {...props} />, analytics: TrainerAnalytics, rooms: RoomsPage, sessions: SessionsPage },
  manager: { overview: ManagerHome, programs: ManagerPrograms, learners: (props) => <LearnersPage manager {...props} />, assignments: ManagerAssignments, reports: ManagerReports, rooms: RoomsPage, sessions: SessionsPage },
  admin: { overview: AdminHome, users: AdminUsers, integrations: AdminIntegrations, recordings: AdminRecordings, audit: AdminAudit, sessions: SessionsPage },
};

export default function Workspace({ route }) {
  const { view } = useApp();
  const [first, second] = route.parts;
  if (first === "session") {
    return <AppShell page={view === "trainer" ? "queue" : "sessions"}><SessionReview id={second} room={route.query.get("room")} tab={route.query.get("tab")} /></AppShell>;
  }
  const page = pages[view][second] ? second : "overview";
  const Page = pages[view][page];
  const navPage = navItems[view].some(([id]) => id === page) ? page : null;
  return <AppShell page={navPage}><Page query={route.query} key={`${page}-${route.query.toString()}`} /></AppShell>;
}
