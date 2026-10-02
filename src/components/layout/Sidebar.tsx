import { Layers, PanelLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate }: SidebarProps) {
  const classes = ['sidebar', collapsed && 'sidebar--collapsed', mobileOpen && 'sidebar--open'].filter(Boolean).join(' ');

  return (
    <aside className={classes} aria-label="Menu principal">
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Layers size={18} />
          </span>
          <span className="sidebar__title">Centralizador</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
          >
            <Icon size={18} className="sidebar__icon" />
            <span className="sidebar__label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <span className="sidebar__label">Centralizador de Acessos · v0.1</span>
      </div>
    </aside>
  );
}
