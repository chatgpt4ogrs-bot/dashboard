import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AccessesProvider } from './context/AccessesContext';
import { SettingsProvider } from './context/SettingsContext';
import { AccessesPage } from './pages/AccessesPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <SettingsProvider>
      <AccessesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<AccessesPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AccessesProvider>
    </SettingsProvider>
  );
}
