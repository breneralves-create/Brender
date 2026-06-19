import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'

// Pages
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Leads } from './pages/Leads'
import { Funil } from './pages/Funil'
import { Conversas } from './pages/Conversas'
import { Configuracoes } from './pages/Configuracoes'
import { DocumentacaoAPI } from './pages/DocumentacaoAPI'

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/leads" element={
        <ProtectedRoute>
          <Leads />
        </ProtectedRoute>
      } />
      
      <Route path="/funil" element={
        <ProtectedRoute>
          <Funil />
        </ProtectedRoute>
      } />
      
      <Route path="/conversas" element={
        <ProtectedRoute>
          <Conversas />
        </ProtectedRoute>
      } />
      
      <Route path="/configuracoes" element={
        <ProtectedRoute adminOnly>
          <Configuracoes />
        </ProtectedRoute>
      } />
      
      <Route path="/documentacao-api" element={
        <ProtectedRoute adminOnly>
          <DocumentacaoAPI />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
