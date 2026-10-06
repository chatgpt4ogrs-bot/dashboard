import { SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n';

const TABS: { path: string; labelKey: 'general' | 'users'; icon: LucideIcon; end?: boolean }[] = [
  { path: '/configuracoes', labelKey: 'general', icon: SlidersHorizontal, end: true },
  { path: '/configuracoes/usuarios', labelKey: 'users', icon: Users },
];

export function SettingsLayout() {
  const { t } = useI18n();
  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">{t.settings.title}</h1>
          <p className="page__subtitle">{t.settings.subtitle}</p>
        </div>
      </header>

      <nav className="tabs" aria-label={t.settings.sectionsLabel}>
        {TABS.map(({ path, labelKey, icon: Icon, end }) => (
          <NavLink key={path} to={path} end={end} className={({ isActive }) => `tabs__item${isActive ? ' tabs__item--active' : ''}`}>
            <Icon size={15} /> {t.settings[labelKey]}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
