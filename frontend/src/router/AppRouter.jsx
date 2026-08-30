// AppRouter — application routes + auth wiring.
//
// Public /login; every other page is guarded by ProtectedRoute (no token →
// redirect /login). A 401 anywhere clears the token and client-side-navigates
// to /login via the api client's unauthorized handler.
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { AuthProvider } from '../auth/AuthProvider.jsx'
import { clearToken } from '../auth/store.js'
import { setUnauthorizedHandler } from '../api/client.js'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import Layout from '../components/Layout.jsx'
import LoginPage from '../pages/Login.jsx'
import SearchPage from '../pages/Search.jsx'
import PantonePage from '../pages/Pantone.jsx'
import FormulasPage from '../pages/Formulas.jsx'
import InventoryPage from '../pages/Inventory.jsx'
import DesignsPage from '../pages/Designs.jsx'
import AdminUsersPage from '../pages/AdminUsers.jsx'
import SampleRegistrationPage from '../pages/SampleRegistration.jsx'

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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/search" element={<SearchPage />} />
            <Route path="/pantone" element={<PantonePage />} />
            <Route path="/formulas" element={<FormulasPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/designs" element={<DesignsPage />} />
            <Route path="/usuarios" element={<AdminUsersPage />} />
            <Route path="/muestras" element={<SampleRegistrationPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
