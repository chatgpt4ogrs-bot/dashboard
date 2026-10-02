import { Building2, LayoutGrid, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Acessos', icon: LayoutGrid },
  { path: '/condominios', label: 'Condomínios', icon: Building2 },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];
