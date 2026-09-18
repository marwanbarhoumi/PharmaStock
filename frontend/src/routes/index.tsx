import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/common/protected-route'
import { AuthProvider } from '@/contexts/auth-context'
import { RootLayout } from '@/layouts/root-layout'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { RegisterPage } from '@/pages/register-page'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RootLayout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RootLayout>
      </AuthProvider>
    </BrowserRouter>
  )
}
