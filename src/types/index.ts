export interface Access {
  id: string;
  name: string;
  url: string;
  description?: string;
  category?: string;
  /** Data URL da imagem personalizada; quando ausente, usa o favicon do site. */
  image?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccessInput = Pick<Access, 'name' | 'url' | 'description' | 'category' | 'image' | 'favorite'>;

export type Theme = 'dark' | 'light' | 'system';

export type Language = 'pt' | 'en';

export interface Settings {
  theme: Theme;
  language: Language;
  openInNewTab: boolean;
  sidebarCollapsed: boolean;
}
