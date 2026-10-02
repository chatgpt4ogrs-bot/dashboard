export interface Access {
  id: string;
  name: string;
  url: string;
  description?: string;
  category?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccessInput = Pick<Access, 'name' | 'url' | 'description' | 'category' | 'favorite'>;

export type Theme = 'dark' | 'light' | 'system';

export interface Settings {
  theme: Theme;
  openInNewTab: boolean;
  sidebarCollapsed: boolean;
}
