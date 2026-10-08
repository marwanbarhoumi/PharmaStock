import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/common/protected-route'
import { RoleGate } from '@/components/common/role-gate'
import { AuthProvider } from '@/contexts/auth-context'
import { LocaleProvider } from '@/contexts/locale-context'
import { RootLayout } from '@/layouts/root-layout'
import { AuditLogsPage } from '@/pages/audit-logs-page'
import { BatchDetailPage } from '@/pages/batch-detail-page'
import { BatchesPage } from '@/pages/batches-page'
import { CategoriesPage } from '@/pages/categories-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { LoginPage } from '@/pages/login-page'
import { MedicineDetailPage } from '@/pages/medicine-detail-page'
import { MedicinesPage } from '@/pages/medicines-page'
import { NotificationsPage } from '@/pages/notifications-page'
import { PurchaseCreatePage } from '@/pages/purchase-create-page'
import { PurchaseDetailPage } from '@/pages/purchase-detail-page'
import { PurchasesPage } from '@/pages/purchases-page'
import { RegisterPage } from '@/pages/register-page'
import { ReportsPage } from '@/pages/reports-page'
import { SaleCreatePage } from '@/pages/sale-create-page'
import { SaleDetailPage } from '@/pages/sale-detail-page'
import { SalesPage } from '@/pages/sales-page'
import { StockPage } from '@/pages/stock-page'
import { SuppliersPage } from '@/pages/suppliers-page'

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <RootLayout>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route path="/" element={<Protected><DashboardPage /></Protected>} />
              <Route
                path="/reports"
                element={
                  <Protected>
                    <RoleGate
                      allow={['ADMIN', 'PHARMACIST']}
                      messageKey="reports.forbidden"
                    >
                      <ReportsPage />
                    </RoleGate>
                  </Protected>
                }
              />
              <Route path="/medicines" element={<Protected><MedicinesPage /></Protected>} />
              <Route path="/medicines/:id" element={<Protected><MedicineDetailPage /></Protected>} />
              <Route path="/categories" element={<Protected><CategoriesPage /></Protected>} />
              <Route path="/suppliers" element={<Protected><SuppliersPage /></Protected>} />
              <Route path="/batches" element={<Protected><BatchesPage /></Protected>} />
              <Route path="/batches/:id" element={<Protected><BatchDetailPage /></Protected>} />
              <Route path="/stock" element={<Protected><StockPage /></Protected>} />
              <Route path="/sales" element={<Protected><SalesPage /></Protected>} />
              <Route path="/sales/new" element={<Protected><SaleCreatePage /></Protected>} />
              <Route path="/sales/:id" element={<Protected><SaleDetailPage /></Protected>} />
              <Route
                path="/purchases"
                element={
                  <Protected>
                    <RoleGate allow={['ADMIN', 'PHARMACIST']}>
                      <PurchasesPage />
                    </RoleGate>
                  </Protected>
                }
              />
              <Route
                path="/purchases/new"
                element={
                  <Protected>
                    <RoleGate allow={['ADMIN', 'PHARMACIST']}>
                      <PurchaseCreatePage />
                    </RoleGate>
                  </Protected>
                }
              />
              <Route
                path="/purchases/:id"
                element={
                  <Protected>
                    <RoleGate allow={['ADMIN', 'PHARMACIST']}>
                      <PurchaseDetailPage />
                    </RoleGate>
                  </Protected>
                }
              />
              <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
              <Route
                path="/audit-logs"
                element={
                  <Protected>
                    <RoleGate allow={['ADMIN']}>
                      <AuditLogsPage />
                    </RoleGate>
                  </Protected>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RootLayout>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  )
}
