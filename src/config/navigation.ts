import { Building2, LayoutDashboard, LayoutGrid, Settings, type LucideIcon } from 'lucide-react';
import type { Messages } from '../i18n/pt';

export interface NavItem {
  path: string;
  labelKey: keyof Messages['nav'];
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'home', icon: LayoutDashboard },
  { path: '/acessos', labelKey: 'accesses', icon: LayoutGrid },
  { path: '/condominios', labelKey: 'condominiums', icon: Building2 },
  { path: '/configuracoes', labelKey: 'settings', icon: Settings },
];
