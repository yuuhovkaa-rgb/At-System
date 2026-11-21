import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout, { baseOf } from '@/layouts/AppLayout';
import { Role } from '@/types';
import ForgotPassword from '@/pages/ForgotPassword';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import { AdminDashboard, MonitorDashboard, StudentDashboard } from '@/pages/Dashboards';
import { StudentsPage, StudentDetails } from '@/pages/Students';
import { ClassesPage, MonitorsPage, MyClass } from '@/pages/Classes';
import { AttendanceOverview, TakeAttendance } from '@/pages/Attendance';
import { ReportsPage, AnalyticsPage } from '@/pages/Reports';
import { UsersPage, AuditLogsPage, SystemSettings } from '@/pages/AdminPages';
import { AnnouncementsPage, CorrectionsPage } from '@/pages/Comms';
import { MyAttendance, AttendanceCalendar, AttendanceHistory, MySchedule } from '@/pages/StudentPages';
import { ProfilePage, SettingsPage } from '@/pages/Account';

/** Client-side guard for UX only: the backend enforces every permission independently. */
function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={baseOf(user.role)} replace />;
  return <>{children}</>;
}
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? baseOf(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/admin" element={<Guard role="ADMIN"><AppLayout /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsPage />} /><Route path="students/:id" element={<StudentDetails />} />
        <Route path="classes" element={<ClassesPage />} /><Route path="monitors" element={<MonitorsPage />} />
        <Route path="attendance" element={<AttendanceOverview />} /><Route path="corrections" element={<CorrectionsPage />} />
        <Route path="reports" element={<ReportsPage />} /><Route path="analytics" element={<AnalyticsPage />} />
        <Route path="users" element={<UsersPage />} /><Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} /><Route path="settings" element={<SystemSettings />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="/monitor" element={<Guard role="MONITOR"><AppLayout /></Guard>}>
        <Route index element={<MonitorDashboard />} />
        <Route path="class" element={<MyClass />} />
        <Route path="students" element={<StudentsPage />} /><Route path="students/:id" element={<StudentDetails />} />
        <Route path="take-attendance" element={<TakeAttendance />} /><Route path="history" element={<AttendanceOverview />} />
        <Route path="reports" element={<ReportsPage />} /><Route path="corrections" element={<CorrectionsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="profile" element={<ProfilePage />} /><Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/student" element={<Guard role="STUDENT"><AppLayout /></Guard>}>
        <Route index element={<StudentDashboard />} />
        <Route path="attendance" element={<MyAttendance />} /><Route path="calendar" element={<AttendanceCalendar />} />
        <Route path="history" element={<AttendanceHistory />} /><Route path="schedule" element={<MySchedule />} />
        <Route path="corrections" element={<CorrectionsPage />} /><Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="profile" element={<ProfilePage />} /><Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
