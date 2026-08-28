// ProtectedRoute — route guard. Renders the protected content only when a
// valid access token exists; otherwise redirects to /login.
import { Navigate } from 'react-router-dom'

import { getToken } from '../auth/store.js'

export default function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />
}
