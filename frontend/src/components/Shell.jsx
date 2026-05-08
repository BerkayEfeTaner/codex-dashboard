import { NavLink } from 'react-router-dom';
import { Button, Nav, NavItem } from 'reactstrap';
import {
  BarChart3,
  Bot,
  Database,
  FolderGit2,
  Gauge,
  GitBranch,
  Network,
  PackageCheck,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Settings,
  TerminalSquare
} from 'lucide-react';
import { InlineError } from './InlineError.jsx';

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/workspaces', label: 'Workspaces', icon: FolderGit2 },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/orchestration', label: 'Orchestration', icon: Network },
  { to: '/capabilities', label: 'Capabilities', icon: Puzzle },
  { to: '/activity', label: 'Activity', icon: TerminalSquare },
  { to: '/profiles', label: 'Profiles', icon: Settings },
  { to: '/databases', label: 'Databases', icon: Database },
  { to: '/sessions', label: 'Sessions', icon: GitBranch },
  { to: '/system', label: 'System', icon: ShieldCheck },
  { to: '/release', label: 'Release', icon: PackageCheck }
];

export function Shell({ summary, loading, refreshing, error, reload, children }) {
  return (
    <div className="app-shell tw-min-h-screen">
      <aside className="sidebar tw-shrink-0">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>Codex</strong>
            <span>Dashboard</span>
          </div>
        </div>
        <Nav tag="nav" aria-label="Dashboard navigation" className="dashboard-nav">
          {navItems.map((item) => (
            <NavItem key={item.to}>
              <NavLink to={item.to}>
                <item.icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </NavItem>
          ))}
        </Nav>
      </aside>

      <div className="workspace">
        <header className="header">
          <div>
            <h1>Codex Dashboard</h1>
            <p>{summary?.codexHome || 'Loading Codex data...'}</p>
          </div>
          <Button className="icon-button" type="button" onClick={reload} disabled={loading || refreshing} aria-label="Refresh">
            <RefreshCw size={18} aria-hidden="true" />
          </Button>
        </header>

        <InlineError title="API error" message={error} />

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
