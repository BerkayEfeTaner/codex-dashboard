import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/layout/Shell.jsx';
import { useSummary } from './hooks/useSummary.js';

const OverviewPage = lazy(() => import('./pages/dashboard/OverviewPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/data/AnalyticsPage.jsx'));
const WorkspacesPage = lazy(() => import('./pages/data/WorkspacesPage.jsx'));
const AgentsPage = lazy(() => import('./pages/ai/AgentsPage.jsx'));
const CapabilitiesPage = lazy(() => import('./pages/ai/CapabilitiesPage.jsx'));
const ActivityPage = lazy(() => import('./pages/data/ActivityPage.jsx'));
const ExecutionPage = lazy(() => import('./pages/data/ExecutionPage.jsx'));
const ProfilesPage = lazy(() => import('./pages/admin/ProfilesPage.jsx'));
const SessionsPage = lazy(() => import('./pages/data/SessionsPage.jsx'));
const SystemPage = lazy(() => import('./pages/admin/SystemPage.jsx'));

function PageLoader() {
  return <div className="panel">Loading page...</div>;
}

export default function App() {
  const summaryState = useSummary();

  return (
    <Shell {...summaryState}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<OverviewPage summary={summaryState.summary} loading={summaryState.loading} />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/capabilities" element={<CapabilitiesPage />} />
          <Route path="/execution" element={<ExecutionPage summary={summaryState.summary} />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/system" element={<SystemPage summary={summaryState.summary} />} />
          <Route path="/release" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
