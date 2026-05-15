import { NavLink } from 'react-router-dom';
import { Button, Nav, NavItem } from 'reactstrap';
import {
  BarChart3,
  BookOpen,
  Bot,
  FolderGit2,
  GitBranch,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Settings,
  TerminalSquare,
  Wrench
} from 'lucide-react';
import { InlineError } from '../ui/InlineError.jsx';

const navGroups = [
  {
    label: 'Codex',
    items: [
      { to: '/dashboard', label: 'Overview', icon: BookOpen },
      { to: '/agents', label: 'Subagents', icon: Bot },
      { to: '/capabilities', label: 'Skills', icon: Puzzle }
    ]
  },
  {
    label: 'Workflow',
    items: [
      { to: '/sessions', label: 'Sessions', icon: GitBranch },
      { to: '/execution', label: 'Execution', icon: Wrench },
      { to: '/activity', label: 'Signals', icon: TerminalSquare },
      { to: '/analytics', label: 'Usage', icon: BarChart3 }
    ]
  },
  {
    label: 'Local Setup',
    items: [
      { to: '/workspaces', label: 'Workspaces', icon: FolderGit2 },
      { to: '/profiles', label: 'Profiles', icon: Settings },
      { to: '/system', label: 'System', icon: ShieldCheck }
    ]
  }
];

export function Shell({ loading, refreshing, error, reload, children }) {
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
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <NavItem key={item.to}>
                  <NavLink to={item.to}>
                    <item.icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                </NavItem>
              ))}
            </div>
          ))}
        </Nav>
      </aside>

      <div className="workspace">
        <header className="header">
          <div>
            <h1>Codex Dashboard</h1>
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
