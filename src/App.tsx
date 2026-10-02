import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AccessesProvider } from './context/AccessesContext';
import { SettingsProvider } from './context/SettingsContext';
import { AccessesPage } from './pages/AccessesPage';
import { CondominiumDetailPage } from './pages/CondominiumDetailPage';
import { CondominiumsPage } from './pages/CondominiumsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <SettingsProvider>
      <AccessesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<AccessesPage />} />
              <Route path="condominios" element={<CondominiumsPage />} />
              <Route path="condominios/:id" element={<CondominiumDetailPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AccessesProvider>
    </SettingsProvider>
  );
}
