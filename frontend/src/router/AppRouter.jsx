// AppRouter — application routes + auth wiring.
//
// Public /login; every other page is guarded by ProtectedRoute (no token →
// redirect /login). A 401 anywhere clears the token and client-side-navigates
// to /login via the api client's unauthorized handler.
import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { AuthProvider } from '../auth/AuthProvider.jsx'
import { clearToken } from '../auth/store.js'
import { setUnauthorizedHandler } from '../api/client.js'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import Layout from '../components/Layout.jsx'
import LoginPage from '../pages/Login.jsx'
import DashboardPage from '../pages/Dashboard.jsx'
import SearchPage from '../pages/Search.jsx'
import PantonePage from '../pages/Pantone.jsx'
import FormulasPage from '../pages/Formulas.jsx'
import InventoryPage from '../pages/Inventory.jsx'
import PantoneDetailPage from '../pages/PantoneDetail.jsx'

// Secondary pages are lazy-loaded to keep the primary plant-floor workflow
// (Search → Pantone → Formulas → Inventory) in the initial bundle.
const InventoryAlertsPage = lazy(() => import('../pages/InventoryAlerts.jsx'))
const InventoryTransactionPage = lazy(() =>
  import('../pages/InventoryTransaction.jsx')
)
const DesignsPage = lazy(() => import('../pages/Designs.jsx'))
const AdminUsersPage = lazy(() => import('../pages/AdminUsers.jsx'))
const SampleRegistrationPage = lazy(() =>
  import('../pages/SampleRegistration.jsx')
)
const SamplesListPage = lazy(() => import('../pages/SamplesList.jsx'))

function UnauthorizedRedirector() {
  const navigate = useNavigate()
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      navigate('/login')
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])
  return null
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UnauthorizedRedirector />
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              Cargando…
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/pantone" element={<PantonePage />} />
              <Route path="/pantone/:id" element={<PantoneDetailPage />} />
              <Route path="/formulas" element={<FormulasPage />} />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route path="/inventario/alertas" element={<InventoryAlertsPage />} />
              <Route
                path="/inventario/transaccion"
                element={<InventoryTransactionPage />}
              />
              <Route path="/designs" element={<DesignsPage />} />
              <Route path="/usuarios" element={<AdminUsersPage />} />
              {/* The nav "Muestras" destination browses the list; the create form
                  stays under /muestras and is reachable via its "Nueva muestra." */}
              <Route path="/muestras/lista" element={<SamplesListPage />} />
              <Route path="/muestras" element={<SampleRegistrationPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
