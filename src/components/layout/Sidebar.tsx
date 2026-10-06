import { Layers, LogOut, PanelLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useI18n } from '../../i18n';
import { LanguageSelector } from '../ui/LanguageSelector';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const { t } = useI18n();

  const handleLogout = async () => {
    if (await confirm({ title: t.nav.logout, message: t.nav.logoutConfirm, confirmLabel: t.nav.logout, tone: 'primary' })) logout();
  };

  const classes = ['sidebar', collapsed && 'sidebar--collapsed', mobileOpen && 'sidebar--open'].filter(Boolean).join(' ');

  return (
    <aside className={classes} aria-label={t.nav.mainMenu}>
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Layers size={18} />
          </span>
          <span className="sidebar__title">{t.app.name}</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggle}
          title={collapsed ? t.nav.expand : t.nav.collapse}
          aria-label={collapsed ? t.nav.expand : t.nav.collapse}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ path, labelKey, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onNavigate}
            title={collapsed ? t.nav[labelKey] : undefined}
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
          >
            <Icon size={18} className="sidebar__icon" />
            <span className="sidebar__label">{t.nav[labelKey]}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        {user && (
          <div className="sidebar__user">
            <span className="sidebar__avatar" title={collapsed ? user.email : undefined}>
              {user.email.charAt(0).toUpperCase()}
            </span>
            <span className="sidebar__user-info sidebar__label">
              <span className="sidebar__user-email">{user.email}</span>
              <span className="sidebar__user-role">{t.roles[user.role]}</span>
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--sm sidebar__logout"
              onClick={handleLogout}
              title={t.nav.logout}
              aria-label={t.nav.logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <div className="sidebar__footer-row">
          <span className="sidebar__label sidebar__version">{t.app.version}</span>
          <LanguageSelector direction="up" compact={collapsed} />
        </div>
      </div>
    </aside>
  );
}
