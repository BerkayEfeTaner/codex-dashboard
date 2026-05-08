import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell.jsx';
import { useSummary } from './hooks/useSummary.js';

const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage.jsx'));
const AgentsPage = lazy(() => import('./pages/AgentsPage.jsx'));
const OrchestrationPage = lazy(() => import('./pages/OrchestrationPage.jsx'));
const CapabilitiesPage = lazy(() => import('./pages/CapabilitiesPage.jsx'));
const ActivityPage = lazy(() => import('./pages/ActivityPage.jsx'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage.jsx'));
const DatabasesPage = lazy(() => import('./pages/DatabasesPage.jsx'));
const SessionsPage = lazy(() => import('./pages/SessionsPage.jsx'));
const SystemPage = lazy(() => import('./pages/SystemPage.jsx'));
const ReleasePage = lazy(() => import('./pages/ReleasePage.jsx'));

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
          <Route path="/orchestration" element={<OrchestrationPage />} />
          <Route path="/capabilities" element={<CapabilitiesPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/databases" element={<DatabasesPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/system" element={<SystemPage summary={summaryState.summary} />} />
          <Route path="/release" element={<ReleasePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
