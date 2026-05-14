import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, DollarSign, CheckSquare, Building2, Menu, BarChart2, MessageCircle, Mail, Plug } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import './App.css'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import ContactDetail from './pages/ContactDetail'
import Deals from './pages/Deals'
import DealDetail from './pages/DealDetail'
import Tasks from './pages/Tasks'
import Companies from './pages/Companies'
import Login from './pages/Login'
import Reports from './pages/Reports'
import WhatsApp from './pages/WhatsApp'
import EmailSettings from './pages/EmailSettings'
import Integrations from './pages/Integrations'
import GlobalSearch from './components/GlobalSearch'
import NotificationBell from './components/NotificationBell'
import AIChatPanel from './components/AIChatPanel'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Carregando...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function Sidebar({ open }) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pipeline', icon: DollarSign, label: 'Funil de Vendas' },
    { to: '/contacts', icon: Users, label: 'Contatos' },
    { to: '/companies', icon: Building2, label: 'Empresas' },
    { to: '/tasks', icon: CheckSquare, label: 'Tarefas' },
    { to: '/reports', icon: BarChart2, label: 'Relatórios' },
    { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
    { to: '/email-settings', icon: Mail, label: 'Email' },
    { to: '/integrations', icon: Plug, label: 'Integrações' },
  ]

  return (
    <aside className={`sidebar ${open ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="logo">SageCRM</div>
      </div>
      <nav className="sidebar-nav">
        {links.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`nav-item ${location.pathname === to ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="avatar">{user?.name?.charAt(0) || '?'}</div>
          <span>{user?.name || 'Usuário'}</span>
          <button onClick={logout} className="btn-icon" style={{ marginLeft: 'auto' }} title="Sair">
            <span style={{ fontSize: 16 }}>⏻</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

function AppLayout() {
  const [sidebarOpen] = useState(true)

  return (
    <div className="app-container">
      <Sidebar open={sidebarOpen} />
      <main className="main-content">
        <header className="top-bar">
          <button className="toggle-btn"><Menu size={20} /></button>
          <div style={{ flex: 1 }} />
          <GlobalSearch />
          <NotificationBell />
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/pipeline" element={<Deals />} />
            <Route path="/pipeline/:id" element={<DealDetail />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/email-settings" element={<EmailSettings />} />
            <Route path="/integrations" element={<Integrations />} />
          </Routes>
        </div>
      </main>
      <AIChatPanel />
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
