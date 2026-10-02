import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { accessStorage } from '../services/storage';
import type { Access, AccessInput } from '../types';
import { createId } from '../utils/text';

interface AccessesContextValue {
  accesses: Access[];
  addAccess: (input: AccessInput) => void;
  updateAccess: (id: string, input: AccessInput) => void;
  removeAccess: (id: string) => void;
  toggleFavorite: (id: string) => void;
  replaceAccesses: (accesses: Access[]) => void;
}

const AccessesContext = createContext<AccessesContextValue | null>(null);

export function AccessesProvider({ children }: { children: ReactNode }) {
  const [accesses, setAccesses] = useState<Access[]>(() => accessStorage.load());

  useEffect(() => {
    accessStorage.save(accesses);
  }, [accesses]);

  const addAccess = useCallback((input: AccessInput) => {
    const now = new Date().toISOString();
    setAccesses((prev) => [...prev, { ...input, id: createId(), createdAt: now, updatedAt: now }]);
  }, []);

  const updateAccess = useCallback((id: string, input: AccessInput) => {
    setAccesses((prev) =>
      prev.map((access) => (access.id === id ? { ...access, ...input, updatedAt: new Date().toISOString() } : access)),
    );
  }, []);

  const removeAccess = useCallback((id: string) => {
    setAccesses((prev) => prev.filter((access) => access.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setAccesses((prev) =>
      prev.map((access) => (access.id === id ? { ...access, favorite: !access.favorite } : access)),
    );
  }, []);

  const replaceAccesses = useCallback((next: Access[]) => setAccesses(next), []);

  const value = useMemo(
    () => ({ accesses, addAccess, updateAccess, removeAccess, toggleFavorite, replaceAccesses }),
    [accesses, addAccess, updateAccess, removeAccess, toggleFavorite, replaceAccesses],
  );

  return <AccessesContext.Provider value={value}>{children}</AccessesContext.Provider>;
}

export function useAccesses(): AccessesContextValue {
  const context = useContext(AccessesContext);
  if (!context) throw new Error('useAccesses deve ser usado dentro de <AccessesProvider>');
  return context;
}
