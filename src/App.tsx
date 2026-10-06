import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { SetupGate } from './components/setup/SetupGate';
import { AccessesProvider } from './context/AccessesContext';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { SettingsProvider } from './context/SettingsContext';
import { I18nProvider } from './i18n';
import { AccessesPage } from './pages/AccessesPage';
import { CondominiumDetailPage } from './pages/CondominiumDetailPage';
import { CondominiumsPage } from './pages/CondominiumsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { UsersPage } from './pages/settings/UsersPage';

export function App() {
  return (
    <SettingsProvider>
      <I18nProvider>
        <SetupGate>
          <AuthProvider>
            <AccessesProvider>
              <ConfirmProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="login" element={<LoginPage />} />
                    <Route
                      element={
                        <RequireAuth>
                          <AppLayout />
                        </RequireAuth>
                      }
                    >
                      <Route index element={<DashboardPage />} />
                      <Route path="acessos" element={<AccessesPage />} />
                      <Route path="condominios" element={<CondominiumsPage />} />
                      <Route path="condominios/:id" element={<CondominiumDetailPage />} />
                      <Route path="equipamentos/:id" element={<EquipmentDetailPage />} />
                      <Route path="configuracoes" element={<SettingsLayout />}>
                        <Route index element={<SettingsPage />} />
                        <Route path="usuarios" element={<UsersPage />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </ConfirmProvider>
            </AccessesProvider>
          </AuthProvider>
        </SetupGate>
      </I18nProvider>
    </SettingsProvider>
  );
}
