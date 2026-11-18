import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Briefcase, ClipboardList, MessageSquareText, Users, BarChart3,
  HelpCircle, UserRound, CalendarClock, ListChecks, Building2,
} from 'lucide-react';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import Notifications from './pages/shared/Notifications';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import Profile from './pages/candidate/Profile';
import Resume from './pages/candidate/Resume';
import Jobs from './pages/candidate/Jobs';
import Applications from './pages/candidate/Applications';
import Schedule from './pages/candidate/Schedule';
import Feedback from './pages/candidate/Feedback';
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard';
import RecruiterProfile from './pages/recruiter/RecruiterProfile';
import JobsList from './pages/recruiter/JobsList';
import JobForm from './pages/recruiter/JobForm';
import JobPipeline from './pages/recruiter/JobPipeline';
import ApplicationDetail from './pages/recruiter/ApplicationDetail';
import GDSessions from './pages/recruiter/GDSessions';
import RecruiterSchedule from './pages/recruiter/RecruiterSchedule';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/Users';
import Questions from './pages/admin/Questions';
import Topics from './pages/admin/Topics';
import AdminJobs from './pages/admin/AdminJobs';
import FullPageLoader from './components/FullPageLoader';
import { useAuth, homePathFor } from './context/AuthContext';

// Heavy pages (video, camera AI, charts) load only when opened
const GDRoom = lazy(() => import('./pages/shared/GDRoom'));
const AptitudeTest = lazy(() => import('./pages/candidate/AptitudeTest'));
const Interview = lazy(() => import('./pages/candidate/Interview'));
const Reports = lazy(() => import('./pages/recruiter/Reports'));

const candidateLinks = [
  { to: '/candidate', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidate/jobs', label: 'Find jobs', icon: Briefcase },
  { to: '/candidate/applications', label: 'My applications', icon: ClipboardList },
  { to: '/candidate/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/candidate/resume', label: 'My resume', icon: FileText },
  { to: '/candidate/feedback', label: 'Feedback', icon: MessageSquareText },
  { to: '/candidate/profile', label: 'Profile', icon: UserRound },
];

const recruiterLinks = [
  { to: '/recruiter', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/recruiter/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/recruiter/gd', label: 'Group discussions', icon: Users },
  { to: '/recruiter/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/recruiter/reports', label: 'Reports', icon: BarChart3 },
  { to: '/recruiter/profile', label: 'Company profile', icon: Building2 },
];

const adminLinks = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/admin/questions', label: 'Question bank', icon: ListChecks },
  { to: '/admin/topics', label: 'GD topics', icon: HelpCircle },
];

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}

const only = (roles, element) => (
  <ProtectedRoute roles={roles}>
    <Suspense fallback={<FullPageLoader text="Loading…" />}>{element}</Suspense>
  </ProtectedRoute>
);

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>

      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      {/* Full-screen assessment pages */}
      <Route path="/candidate/aptitude/:applicationId" element={only(['CANDIDATE'], <AptitudeTest />)} />
      <Route path="/candidate/interview/:applicationId" element={only(['CANDIDATE'], <Interview />)} />
      <Route path="/gd/:sessionId" element={only(['CANDIDATE', 'RECRUITER'], <GDRoom />)} />

      <Route path="/candidate" element={only(['CANDIDATE'], <DashboardLayout links={candidateLinks} roleLabel="Candidate" basePath="/candidate" />)}>
        <Route index element={<CandidateDashboard />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="applications" element={<Applications />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="resume" element={<Resume />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="/recruiter" element={only(['RECRUITER'], <DashboardLayout links={recruiterLinks} roleLabel="Recruiter" basePath="/recruiter" />)}>
        <Route index element={<RecruiterDashboard />} />
        <Route path="jobs" element={<JobsList />} />
        <Route path="jobs/new" element={<JobForm />} />
        <Route path="jobs/:id" element={<JobPipeline />} />
        <Route path="jobs/:id/edit" element={<JobForm />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="gd" element={<GDSessions />} />
        <Route path="schedule" element={<RecruiterSchedule />} />
        <Route path="reports" element={<Suspense fallback={null}><Reports /></Suspense>} />
        <Route path="profile" element={<RecruiterProfile />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="/admin" element={only(['ADMIN'], <DashboardLayout links={adminLinks} roleLabel="Admin" basePath="/admin" />)}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="questions" element={<Questions />} />
        <Route path="topics" element={<Topics />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
