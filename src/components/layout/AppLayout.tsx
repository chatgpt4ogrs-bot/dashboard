import { Layers, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useI18n } from '../../i18n';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, isMobile]);

  const handleToggle = () => {
    if (isMobile) setMobileOpen(false);
    else updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed });
  };

  return (
    <div className="app">
      <Sidebar
        collapsed={!isMobile && settings.sidebarCollapsed}
        mobileOpen={isMobile && mobileOpen}
        onToggle={handleToggle}
        onNavigate={() => setMobileOpen(false)}
      />

      {isMobile && mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <main className="main">
        {isMobile && (
          <header className="topbar">
            <button type="button" className="icon-btn" onClick={() => setMobileOpen(true)} aria-label={t.nav.openMenu}>
              <Menu size={20} />
            </button>
            <span className="topbar__title">
              <Layers size={16} /> {t.app.name}
            </span>
          </header>
        )}
        <Outlet />
      </main>
    </div>
  );
}
