import { LayoutGrid, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Acessos', icon: LayoutGrid },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];
